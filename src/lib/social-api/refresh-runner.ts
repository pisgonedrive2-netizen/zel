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
import { resolveLinkDetection } from "./platform-detect";
import { fetchMetricsForLink, type FetchedMetrics } from "./clients";
import { persistLinkMetricsUpdate, type PersistedLinkMetrics } from "./link-persist";
import { linkUpdateFromPersisted, type LinkMetricsStoreUpdate } from "./link-store-sync";
import { getMonthlyUsage, incrementUsage } from "./quota";
import { setBulkRefreshJobCurrent } from "./bulk-job-state";

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
  refresh_count_total: number | null;
}

export interface LinkRefreshResult {
  linkId: string;
  ok: boolean;
  platform: SocialPlatform | null;
  metrics?: FetchedMetrics;
  delta?: number;
  error?: string;
  linkUpdate?: LinkMetricsStoreUpdate;
}

export interface BulkRefreshSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  skippedQuota: number;
  results: LinkRefreshResult[];
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
/** Tüm aktif, API ile ölçülebilir linkler (auto_track şart değil). */
async function pickAllActiveLinksForPlatform(
  platform: SocialPlatform
): Promise<BrandLinkRow[]> {
  const labels = labelsForPlatform(platform);
  if (labels.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_links")
    .select(
      "id, brand_id, platform, url, handle, status, auto_track, last_views, last_checked_at, check_count, error_count, external_ref, refresh_count_total"
    )
    .in("platform", labels)
    .eq("status", "active")
    .order("last_checked_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`brand_links pick all: ${error.message}`);
  const rows = (data ?? []) as BrandLinkRow[];
  return rows.filter((row) => {
    const detected = resolveLinkDetection({
      url: row.url,
      platform: row.platform,
      handle: row.handle,
      externalRef: row.external_ref ?? undefined,
    });
    return detected?.platform === platform;
  });
}

async function pickLinksForPlatform(
  platform: SocialPlatform,
  limit: number
): Promise<BrandLinkRow[]> {
  const labels = labelsForPlatform(platform);
  if (labels.length === 0 || limit <= 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_links")
    .select(
      "id, brand_id, platform, url, handle, status, auto_track, last_views, last_checked_at, check_count, error_count, external_ref, refresh_count_total"
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

async function persistLinkError(row: BrandLinkRow, errMsg: string): Promise<void> {
  // Hata tipini belirle: quota / not_supported / error
  const lower = errMsg.toLowerCase();
  const status: "quota" | "not_supported" | "error" =
    lower.includes("quota") || lower.includes("kota")
      ? "quota"
      : lower.includes("not supported") || lower.includes("desteklen")
        ? "not_supported"
        : "error";

  const { error } = await getSupabaseAdmin()
    .from("brand_links")
    .update({
      last_checked_at: new Date().toISOString(),
      last_check_error: errMsg.slice(0, 240),
      error_count: (row.error_count ?? 0) + 1,
      last_refresh_status: status,
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
  opts: {
    triggeredBy: "cron" | "manual";
    userId?: string;
    cronIntervalHours?: number;
    /** Snapshot'ın hangi tarihe yazılacağı (geçmiş ay yenilemesi için). */
    targetDate?: string;
  } = {
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
    const detected = resolveLinkDetection({
      url: row.url,
      platform: row.platform,
      handle: row.handle,
      externalRef: row.external_ref ?? undefined,
    });
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
      const persisted = await persistLinkMetricsUpdate({
        linkId: row.id,
        metrics,
        externalRef: detected.externalRef,
        previousViews: row.last_views,
        checkCount: row.check_count,
        refreshCountTotal: row.refresh_count_total,
        targetDate: opts.targetDate,
      });
      const delta = persisted.delta;
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
export async function runAllPlatformsRefresh(opts: {
  triggeredBy: "cron" | "manual";
  userId?: string;
  /** Snapshot'ın hangi tarihe yazılacağı (geçmiş ay yenilemesi için). */
  targetDate?: string;
} = { triggeredBy: "cron" }): Promise<PlatformRunSummary[]> {
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

function toLinkUpdate(linkId: string, persisted: PersistedLinkMetrics): LinkMetricsStoreUpdate {
  return linkUpdateFromPersisted(linkId, persisted);
}

async function refreshLinkRow(
  row: BrandLinkRow,
  opts: { userId?: string; recordRun?: boolean; targetDate?: string }
): Promise<LinkRefreshResult> {
  const detected = resolveLinkDetection({
    url: row.url,
    platform: row.platform,
    handle: row.handle,
    externalRef: row.external_ref ?? undefined,
  });
  if (!detected) {
    return { linkId: row.id, ok: false, platform: null, error: "URL desteklenmiyor" };
  }

  const usage = await getMonthlyUsage(detected.platform);
  const safeLimit = Math.floor(
    SOCIAL_PLANS[detected.platform].monthlyLimit * SOCIAL_PLANS[detected.platform].safeFraction
  );
  if (usage.requestsUsed >= safeLimit) {
    return {
      linkId: row.id,
      ok: false,
      platform: detected.platform,
      error: `Bu ayki güvenli kota (${safeLimit}) doldu`,
    };
  }

  const runId =
    opts.recordRun !== false
      ? await startRun(detected.platform, "manual", opts.userId).catch(() => null)
      : null;
  try {
    const metrics = await fetchMetricsForLink(detected);
    await incrementUsage(detected.platform, 1);
    const persisted = await persistLinkMetricsUpdate({
      linkId: row.id,
      metrics,
      externalRef: detected.externalRef,
      previousViews: row.last_views,
      checkCount: row.check_count,
      refreshCountTotal: row.refresh_count_total,
      targetDate: opts.targetDate,
    });
    if (runId) {
      await finishRun(runId, { attempted: 1, succeeded: 1, failed: 0, results: [] });
    }
    return {
      linkId: row.id,
      ok: true,
      platform: detected.platform,
      metrics,
      delta: persisted.delta,
      linkUpdate: toLinkUpdate(row.id, persisted),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    const now = new Date().toISOString();
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
    return {
      linkId: row.id,
      ok: false,
      platform: detected.platform,
      error: msg,
      linkUpdate: { lastCheckedAt: now, lastCheckError: msg.slice(0, 240) },
    };
  }
}

/**
 * Yüklü tüm aktif linkleri tek seferde kontrol eder (YouTube, Instagram, TikTok).
 * auto_track bayrağına bakmaz; kota dolunca kalan linkleri atlar.
 */
export async function refreshAllLinksBulk(opts: {
  userId?: string;
  brandId?: string;
  /** Sadece hatalı / yenilenmemiş linkleri yeniden dene. */
  failedOnly?: boolean;
  /** Sadece belirli link ID'lerini yenile. */
  linkIds?: string[];
  /** Snapshot'ın hangi tarihe yazılacağı (geçmiş ay için YYYY-MM-DD). */
  targetDate?: string;
  /** UI poll için job id (in-memory state'i günceller). */
  jobId?: string;
} = {}): Promise<BulkRefreshSummary> {
  if (!isRapidApiEnabled()) {
    throw new Error("RAPIDAPI_KEY eksik — otomatik yenileme devre dışı.");
  }
  const summary: BulkRefreshSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skippedQuota: 0,
    results: [],
  };

  const platformRunIds: Partial<Record<SocialPlatform, string>> = {};

  for (const platform of PLATFORMS) {
    let links = await pickAllActiveLinksForPlatform(platform);
    if (opts.brandId) {
      links = links.filter((l) => l.brand_id === opts.brandId);
    }
    if (opts.linkIds && opts.linkIds.length > 0) {
      const ids = new Set(opts.linkIds);
      links = links.filter((l) => ids.has(l.id));
    }
    if (opts.failedOnly) {
      // Hata kayıtlı VEYA son 24 saat içinde kontrol edilmemiş linkler
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      links = links.filter((l) => {
        const hadError = (l.error_count ?? 0) > 0 && (l.last_views == null || l.last_views === 0);
        const stale = !l.last_checked_at || new Date(l.last_checked_at).getTime() < cutoff;
        return hadError || stale;
      });
    }
    if (links.length === 0) continue;

    const usage = await getMonthlyUsage(platform);
    const safeLimit = Math.floor(
      SOCIAL_PLANS[platform].monthlyLimit * SOCIAL_PLANS[platform].safeFraction
    );
    let remaining = Math.max(0, safeLimit - usage.requestsUsed);

    const runId = await startRun(platform, "manual", opts.userId).catch(() => null);
    if (runId) platformRunIds[platform] = runId;

    let platformSucceeded = 0;
    let platformFailed = 0;

    for (const row of links) {
      if (remaining <= 0) {
        summary.skippedQuota += 1;
        summary.results.push({
          linkId: row.id,
          ok: false,
          platform,
          error: "Kota doldu — atlandı",
        });
        continue;
      }
      summary.attempted += 1;
      if (opts.jobId) {
        setBulkRefreshJobCurrent(opts.jobId, {
          linkId: row.id,
          platform,
          handle: row.handle ?? row.url ?? row.id,
          index: summary.attempted,
          total: links.length,
        });
      }
      const result = await refreshLinkRow(row, { userId: opts.userId, recordRun: false, targetDate: opts.targetDate });
      summary.results.push(result);
      if (result.ok) {
        summary.succeeded += 1;
        platformSucceeded += 1;
        remaining -= 1;
      } else if (result.error?.includes("kota")) {
        summary.skippedQuota += 1;
        platformFailed += 1;
        remaining = 0;
      } else {
        summary.failed += 1;
        platformFailed += 1;
      }
    }

    if (runId) {
      await finishRun(runId, {
        attempted: platformSucceeded + platformFailed,
        succeeded: platformSucceeded,
        failed: platformFailed,
        results: [],
        errorSummary: platformFailed > 0 ? `${platformFailed} link hata (toplu)` : "",
      }).catch(() => undefined);
    }
  }

  return summary;
}

/** Tek link manuel refresh — admin UI'da "Şimdi yenile" butonu için. */
export async function refreshSingleLink(linkId: string, opts: { userId?: string; targetDate?: string } = {}): Promise<LinkRefreshResult> {
  if (!isRapidApiEnabled()) {
    return { linkId, ok: false, platform: null, error: "RAPIDAPI_KEY eksik" };
  }
  const { data, error } = await getSupabaseAdmin()
    .from("brand_links")
    .select(
      "id, brand_id, platform, url, handle, status, auto_track, last_views, last_checked_at, check_count, error_count, external_ref, refresh_count_total"
    )
    .eq("id", linkId)
    .single();
  if (error || !data) return { linkId, ok: false, platform: null, error: error?.message ?? "Link bulunamadı" };
  return refreshLinkRow(data as BrandLinkRow, opts);
}

export async function getCurrentMonth(): Promise<string> {
  return currentMonthKey();
}
