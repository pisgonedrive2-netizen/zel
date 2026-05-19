import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isRapidApiEnabled } from "@/lib/env";
import {
  SOCIAL_PLANS,
  calcBatchSize,
  currentMonthKey,
  type SocialPlatform,
} from "./config";
import { getApiRefreshSettings } from "./settings";
import { notifyApiRefreshIssues } from "./notify-alerts";
import { detectPlatform } from "./platform-detect";
import { fetchMetricsForLink, type FetchedMetrics } from "./clients";
import { getMonthlyUsage, incrementUsage } from "./quota";

interface BrandLinkRow {
  id: string;
  brand_id: string;
  platform: string;
  url: string;
  handle: string;
  status: "active" | "inactive";
  auto_track: boolean | null;
  last_views: number | null;
  last_checked_at: string | null;
  check_count: number | null;
  error_count: number | null;
  external_ref: string | null;
}

export interface LinkRefreshResult {
  linkId: string;
  ok: boolean;
  platform: SocialPlatform | null;
  metrics?: FetchedMetrics;
  delta?: number;
  error?: string;
}

export interface PlatformRunSummary {
  platform: SocialPlatform;
  attempted: number;
  succeeded: number;
  failed: number;
  quotaBefore: number;
  quotaAfter: number;
  monthlyLimit: number;
  results: LinkRefreshResult[];
}

const PLATFORMS: SocialPlatform[] = ["youtube", "instagram", "tiktok"];

/**
 * Bir platform için en uzun süredir kontrol edilmemiş aktif & auto_track
 * linkleri döner (oldest-first round-robin).
 */
async function pickLinksForPlatform(
  platform: SocialPlatform,
  limit: number
): Promise<BrandLinkRow[]> {
  const labels = labelsForPlatform(platform);
  if (labels.length === 0 || limit <= 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_links")
    .select(
      "id, brand_id, platform, url, handle, status, auto_track, last_views, last_checked_at, check_count, error_count, external_ref"
    )
    .in("platform", labels)
    .eq("status", "active")
    .eq("auto_track", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`brand_links pick: ${error.message}`);
  return (data ?? []) as BrandLinkRow[];
}

/** Son cron çalışmasından bu yana yeterli saat geçmediyse atla. */
async function shouldSkipDueToInterval(
  platform: SocialPlatform,
  intervalHours: number,
  triggeredBy: "cron" | "manual"
): Promise<boolean> {
  if (triggeredBy !== "cron") return false;
  const { data } = await getSupabaseAdmin()
    .from("api_refresh_runs")
    .select("started_at")
    .eq("platform", platform)
    .eq("triggered_by", "cron")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.started_at) return false;
  const hours = (Date.now() - new Date(String(data.started_at)).getTime()) / 3_600_000;
  return hours < intervalHours;
}

/** BrandLink.platform (Türkçe dropdown) → kanonik platform slug. */
function labelsForPlatform(platform: SocialPlatform): string[] {
  if (platform === "youtube") return ["YouTube", "Youtube", "youtube"];
  if (platform === "instagram") return ["Instagram", "instagram"];
  if (platform === "tiktok") return ["TikTok", "Tiktok", "tiktok"];
  return [];
}

async function recordSnapshot(linkId: string, views: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const id = `s-auto-${linkId.slice(0, 8)}-${today.replace(/-/g, "")}`;
  // Upsert by id — aynı gün otomatik refresh için aynı satırı günceller.
  const { error } = await getSupabaseAdmin().from("link_snapshots").upsert(
    {
      id,
      link_id: linkId,
      date: today,
      views,
      notes: "auto",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`link_snapshots: ${error.message}`);
}

async function persistLinkUpdate(
  row: BrandLinkRow,
  metrics: FetchedMetrics,
  externalRef: string
): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10);
  const updates: Record<string, unknown> = {
    last_checked_at: new Date().toISOString(),
    check_count: (row.check_count ?? 0) + 1,
    last_check_error: null,
    external_ref: externalRef,
  };
  let delta: number | null = null;
  if (metrics.views != null) {
    updates.last_views = metrics.views;
    updates.last_snapshot_date = today;
    delta = (row.last_views ?? 0) === 0 ? null : metrics.views - (row.last_views ?? 0);
  }
  if (metrics.likes != null) updates.last_likes = metrics.likes;
  if (metrics.comments != null) updates.last_comments = metrics.comments;
  if (metrics.shares != null) updates.last_shares = metrics.shares;

  const { error } = await getSupabaseAdmin()
    .from("brand_links")
    .update(updates)
    .eq("id", row.id);
  if (error) throw new Error(`brand_links update: ${error.message}`);

  if (metrics.views != null) {
    await recordSnapshot(row.id, metrics.views);
  }
  return delta;
}

async function persistLinkError(row: BrandLinkRow, errMsg: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("brand_links")
    .update({
      last_checked_at: new Date().toISOString(),
      last_check_error: errMsg.slice(0, 240),
      error_count: (row.error_count ?? 0) + 1,
    })
    .eq("id", row.id);
  if (error) throw new Error(`brand_links update (error): ${error.message}`);
}

async function startRun(platform: SocialPlatform, triggeredBy: "cron" | "manual", userId?: string): Promise<string> {
  const id = `run-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await getSupabaseAdmin().from("api_refresh_runs").insert({
    id,
    platform,
    triggered_by: triggeredBy,
    triggered_by_user: userId ?? null,
  });
  if (error) throw new Error(`api_refresh_runs insert: ${error.message}`);
  return id;
}

async function finishRun(runId: string, summary: Omit<PlatformRunSummary, "platform" | "monthlyLimit" | "quotaBefore" | "quotaAfter"> & { errorSummary?: string }): Promise<void> {
  await getSupabaseAdmin()
    .from("api_refresh_runs")
    .update({
      finished_at: new Date().toISOString(),
      links_attempted: summary.attempted,
      links_succeeded: summary.succeeded,
      links_failed: summary.failed,
      quota_used: summary.succeeded,
      error_summary: summary.errorSummary ?? "",
    })
    .eq("id", runId);
}

/**
 * Tek bir platform için cron çalıştırması. Kalan kotaya göre adaptif batch
 * boyutuyla linkleri seçer, API'ye sırayla istek atar, snapshot oluşturur ve
 * kotayı artırır. Hata durumunda diğer linkler etkilenmez.
 */
export async function runPlatformRefresh(
  platform: SocialPlatform,
  opts: { triggeredBy: "cron" | "manual"; userId?: string; cronIntervalHours?: number } = {
    triggeredBy: "cron",
  }
): Promise<PlatformRunSummary> {
  if (!isRapidApiEnabled()) {
    throw new Error("RAPIDAPI_KEY eksik — otomatik yenileme devre dışı.");
  }
  const settings = await getApiRefreshSettings();
  const intervalHours = opts.cronIntervalHours ?? settings.cronIntervalHours;

  if (await shouldSkipDueToInterval(platform, intervalHours, opts.triggeredBy)) {
    const usage = await getMonthlyUsage(platform);
    return {
      platform,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      quotaBefore: usage.requestsUsed,
      quotaAfter: usage.requestsUsed,
      monthlyLimit: SOCIAL_PLANS[platform].monthlyLimit,
      results: [],
    };
  }

  const usage = await getMonthlyUsage(platform);
  const { batchSize } = calcBatchSize({
    platform,
    usedThisMonth: usage.requestsUsed,
    cronIntervalHours: intervalHours,
  });
  const summary: PlatformRunSummary = {
    platform,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    quotaBefore: usage.requestsUsed,
    quotaAfter: usage.requestsUsed,
    monthlyLimit: SOCIAL_PLANS[platform].monthlyLimit,
    results: [],
  };
  if (batchSize === 0) {
    return summary; // kota tükendi — kayıt da açmıyoruz
  }
  const runId = await startRun(platform, opts.triggeredBy, opts.userId);
  const links = await pickLinksForPlatform(platform, batchSize);
  const errors: string[] = [];

  for (const row of links) {
    summary.attempted += 1;
    const detected = detectPlatform(row.url, row.platform);
    if (!detected || detected.platform !== platform) {
      const msg = "URL platform tespiti başarısız";
      summary.failed += 1;
      summary.results.push({ linkId: row.id, ok: false, platform, error: msg });
      await persistLinkError(row, msg).catch(() => undefined);
      errors.push(`${row.id}: ${msg}`);
      continue;
    }
    try {
      const metrics = await fetchMetricsForLink(detected);
      // Kotayı API başarılı dönerse artır
      await incrementUsage(platform, 1);
      summary.quotaAfter += 1;
      const delta = await persistLinkUpdate(row, metrics, detected.externalRef);
      summary.succeeded += 1;
      summary.results.push({
        linkId: row.id,
        ok: true,
        platform,
        metrics,
        delta: delta ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      summary.failed += 1;
      summary.results.push({ linkId: row.id, ok: false, platform, error: msg });
      await persistLinkError(row, msg).catch(() => undefined);
      errors.push(`${row.id}: ${msg}`);
    }
  }
  await finishRun(runId, {
    attempted: summary.attempted,
    succeeded: summary.succeeded,
    failed: summary.failed,
    results: summary.results,
    errorSummary: errors.slice(0, 3).join(" | "),
  });
  return summary;
}

/** Cron entry point — tüm platformları sırayla çalıştırır. */
export async function runAllPlatformsRefresh(opts: { triggeredBy: "cron" | "manual"; userId?: string } = { triggeredBy: "cron" }): Promise<PlatformRunSummary[]> {
  const settings = await getApiRefreshSettings();
  const out: PlatformRunSummary[] = [];
  for (const p of PLATFORMS) {
    try {
      const s = await runPlatformRefresh(p, {
        ...opts,
        cronIntervalHours: settings.cronIntervalHours,
      });
      out.push(s);
    } catch (err) {
      out.push({
        platform: p,
        attempted: 0,
        succeeded: 0,
        failed: 0,
        quotaBefore: 0,
        quotaAfter: 0,
        monthlyLimit: SOCIAL_PLANS[p].monthlyLimit,
        results: [
          {
            linkId: "(skipped)",
            ok: false,
            platform: p,
            error: err instanceof Error ? err.message : "?",
          },
        ],
      });
    }
  }
  if (opts.triggeredBy === "cron") {
    await notifyApiRefreshIssues(out).catch(() => undefined);
  }
  return out;
}

/** Tek link manuel refresh — admin UI'da "Şimdi yenile" butonu için. */
export async function refreshSingleLink(linkId: string, opts: { userId?: string } = {}): Promise<LinkRefreshResult> {
  if (!isRapidApiEnabled()) {
    return { linkId, ok: false, platform: null, error: "RAPIDAPI_KEY eksik" };
  }
  const { data, error } = await getSupabaseAdmin()
    .from("brand_links")
    .select(
      "id, brand_id, platform, url, handle, status, auto_track, last_views, last_checked_at, check_count, error_count, external_ref"
    )
    .eq("id", linkId)
    .single();
  if (error || !data) return { linkId, ok: false, platform: null, error: error?.message ?? "Link bulunamadı" };
  const row = data as BrandLinkRow;
  const detected = detectPlatform(row.url, row.platform);
  if (!detected) return { linkId, ok: false, platform: null, error: "URL desteklenmiyor" };

  // Manuel refresh için de aylık kota dolmuşsa engelle.
  const usage = await getMonthlyUsage(detected.platform);
  const safeLimit = Math.floor(SOCIAL_PLANS[detected.platform].monthlyLimit * SOCIAL_PLANS[detected.platform].safeFraction);
  if (usage.requestsUsed >= safeLimit) {
    return {
      linkId,
      ok: false,
      platform: detected.platform,
      error: `Bu ayki güvenli kota (${safeLimit}/${SOCIAL_PLANS[detected.platform].monthlyLimit}) doldu`,
    };
  }
  const runId = await startRun(detected.platform, "manual", opts.userId).catch(() => null);
  try {
    const metrics = await fetchMetricsForLink(detected);
    await incrementUsage(detected.platform, 1);
    const delta = await persistLinkUpdate(row, metrics, detected.externalRef);
    if (runId) {
      await finishRun(runId, {
        attempted: 1,
        succeeded: 1,
        failed: 0,
        results: [],
      });
    }
    return { linkId, ok: true, platform: detected.platform, metrics, delta: delta ?? undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    await persistLinkError(row, msg).catch(() => undefined);
    if (runId) {
      await finishRun(runId, {
        attempted: 1,
        succeeded: 0,
        failed: 1,
        results: [],
        errorSummary: msg,
      });
    }
    return { linkId, ok: false, platform: detected.platform, error: msg };
  }
}

export async function getCurrentMonth(): Promise<string> {
  return currentMonthKey();
}
