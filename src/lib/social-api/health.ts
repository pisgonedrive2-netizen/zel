import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SOCIAL_PLANS, type SocialPlatform } from "./config";
import { isTransientApiError } from "./error-classify";
import { linkMaintenanceConcern } from "./health-summary";

/** brand_links.platform değerleri (Türkçe / slug karışık). */
export function platformLinkLabels(platform: SocialPlatform): string[] {
  if (platform === "youtube") return ["YouTube", "Youtube", "youtube"];
  if (platform === "instagram") return ["Instagram", "instagram"];
  return ["TikTok", "Tiktok", "tiktok"];
}

export interface PlatformHealth {
  platform: SocialPlatform;
  /** Kart rengi / özet (bağlantı + link durumuna göre). */
  status: "ok" | "warn" | "error" | "exhausted" | "unknown";
  /** RapidAPI probe / ping — API erişilebilir mi? */
  connectivityStatus: "ok" | "warn" | "error" | "unknown";
  lastPingAt: string | null;
  /** Kalıcı (gerçek) link hatası olan aktif takip linki sayısı — geçici throttle hariç. */
  linksWithError: number;
  /** RapidAPI hız limiti (429 vb.) nedeniyle GEÇİCİ başarısız olan link sayısı. */
  throttledLinks: number;
  /** 24 saatten eski veya hiç kontrol edilmemiş otomatik takip linkleri. */
  staleTrackedLinks: number;
  /** Eski link / bakım ihtiyacı (API bağlantısından bağımsız). */
  linkMaintenance: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  /** Son toplu çalıştırma özet hatası (link yenileme). */
  lastError: string | null;
  successCount24h: number;
  errorCount24h: number;
  staleHours: number | null;
}

const PLATFORMS: SocialPlatform[] = ["youtube", "instagram", "tiktok"];

function matchPlatform(platformLabel: string, p: SocialPlatform): boolean {
  const labels = platformLinkLabels(p);
  const lower = platformLabel.toLowerCase();
  return labels.some((l) => lower.includes(l.toLowerCase()));
}

async function countLinkIssues(): Promise<
  Record<SocialPlatform, { withError: number; throttled: number; stale: number; tracked: number }>
> {
  const out: Record<
    SocialPlatform,
    { withError: number; throttled: number; stale: number; tracked: number }
  > = {
    youtube: { withError: 0, throttled: 0, stale: 0, tracked: 0 },
    instagram: { withError: 0, throttled: 0, stale: 0, tracked: 0 },
    tiktok: { withError: 0, throttled: 0, stale: 0, tracked: 0 },
  };
  const db = getSupabaseAdmin();
  const { data: links } = await db
    .from("brand_links")
    .select("platform, last_checked_at, last_check_error, auto_track, status")
    .eq("status", "active")
    .eq("auto_track", true);

  const now = Date.now();
  for (const row of links ?? []) {
    const platStr = String((row as { platform: string }).platform);
    const p = PLATFORMS.find((x) => matchPlatform(platStr, x));
    if (!p) continue;
    out[p].tracked++;
    const err = (row as { last_check_error?: string }).last_check_error;
    if (err) {
      // Geçici hız limiti (429) link bozukluğu DEĞİL — ayrı say, "link hatası"
      // uyarısını şişirme. Bir sonraki başarılı yenilemede temizlenir.
      if (isTransientApiError(err)) out[p].throttled++;
      else out[p].withError++;
    }
    const checked = (row as { last_checked_at?: string }).last_checked_at;
    if (!checked || now - new Date(checked).getTime() > 24 * 3_600_000) {
      out[p].stale++;
    }
  }
  return out;
}

/**
 * Platform sağlığı: API bağlantısı (ping/probe) ile link yenileme hataları ayrı değerlendirilir.
 */
export async function getPlatformHealth(): Promise<PlatformHealth[]> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const pingSince = new Date(Date.now() - 48 * 3_600_000).toISOString();

  const [{ data: runs }, { data: pings }, linkIssues] = await Promise.all([
    db
      .from("api_refresh_runs")
      .select("platform, started_at, links_succeeded, links_failed, error_summary, notes, triggered_by")
      .gte("started_at", since)
      .order("started_at", { ascending: false }),
    db
      .from("api_refresh_runs")
      .select("platform, started_at, notes, triggered_by, links_succeeded")
      .gte("started_at", pingSince)
      .order("started_at", { ascending: false }),
    countLinkIssues(),
  ]);

  const now = Date.now();

  return PLATFORMS.map<PlatformHealth>((p) => {
    const platformRuns = (runs ?? []).filter(
      (r) => (r as { platform: string }).platform === p
    ) as Array<{
      platform: string;
      started_at: string;
      links_succeeded: number;
      links_failed: number;
      error_summary: string;
      notes?: string;
    }>;

    const totalSuccess = platformRuns.reduce((s, r) => s + (r.links_succeeded ?? 0), 0);
    const totalFail = platformRuns.reduce((s, r) => s + (r.links_failed ?? 0), 0);

    const lastSuccessRun = platformRuns.find((r) => (r.links_succeeded ?? 0) > 0);
    const lastFailRun = platformRuns.find(
      (r) => (r.links_failed ?? 0) > 0 && Boolean(r.error_summary?.trim())
    );

    const lastSuccessAt = lastSuccessRun?.started_at ?? null;
    const lastErrorAt = lastFailRun?.started_at ?? null;

    const isProbe = (r: {
      platform: string;
      notes?: string;
      triggered_by?: string;
      links_succeeded?: number;
    }) =>
      r.platform === p &&
      (r.notes === "connection_probe" ||
        (r.triggered_by === "manual" && (r.links_succeeded ?? 0) > 0));
    const lastPing = (pings ?? []).find(isProbe) as { started_at: string } | undefined;
    const lastPingAt = lastPing?.started_at ?? null;
    const connectivityStatus: PlatformHealth["connectivityStatus"] = lastPingAt
      ? "ok"
      : platformRuns.length === 0
        ? "unknown"
        : totalSuccess > 0
          ? "ok"
          : "warn";

    const issues = linkIssues[p];
    const linksWithError = issues.withError;
    const throttledLinks = issues.throttled;
    const staleTrackedLinks = issues.stale;

    const lastError =
      linksWithError > 0
        ? `${linksWithError} link son yenilemede hata`
        : throttledLinks > 0
          ? `${throttledLinks} link geçici hız limiti (429) — otomatik tekrar denenecek`
          : lastFailRun?.error_summary?.trim()
            ? lastFailRun.error_summary.slice(0, 160)
            : null;

    const staleHours = lastSuccessAt
      ? (now - new Date(lastSuccessAt).getTime()) / 3_600_000
      : null;

    let status: PlatformHealth["status"] = "unknown";
    const maintenance = linkMaintenanceConcern({
      tracked: issues.tracked,
      linksWithError,
      staleTrackedLinks,
    });

    // Genel durum: API bağlantısı + kalıcı link hataları (eski link sayısı ayrı metrik).
    if (connectivityStatus === "ok") {
      status = linksWithError > 0 ? "warn" : "ok";
    } else if (connectivityStatus === "warn") {
      status = "warn";
    } else if (connectivityStatus === "unknown") {
      if (issues.tracked === 0) {
        status = "ok";
      } else if (linksWithError > 0) {
        status = "warn";
      } else if (platformRuns.length > 0 && totalSuccess === 0 && totalFail > 0) {
        status = "warn";
      } else {
        status = "ok";
      }
    } else if (platformRuns.length > 0 && totalSuccess === 0 && totalFail > 0) {
      status = "error";
    } else {
      status = "unknown";
    }

    if (totalFail > 0 && totalSuccess === 0 && connectivityStatus === "warn") {
      status = "error";
    }

    return {
      platform: p,
      status,
      connectivityStatus,
      lastPingAt,
      linksWithError,
      throttledLinks,
      staleTrackedLinks,
      linkMaintenance: maintenance,
      lastSuccessAt,
      lastErrorAt,
      lastError,
      successCount24h: totalSuccess,
      errorCount24h: totalFail,
      staleHours,
    };
  });
}

/** Başarılı manuel ping — bağlantı kaydı + ilgili platform link hata bayraklarını temizlemez (yalnızca probe). */
export async function recordPlatformPingSuccess(platform: SocialPlatform): Promise<void> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = `ping-${platform}-${Date.now()}`;
  await db.from("api_refresh_runs").insert({
    id,
    platform,
    triggered_by: "manual",
    started_at: now,
    finished_at: now,
    links_attempted: 1,
    links_succeeded: 1,
    links_failed: 0,
    quota_used: 1,
    error_summary: "",
    notes: "connection_probe",
  });
}

function parseHeaderInt(res: Response, names: string[]): number | null {
  for (const n of names) {
    const v = res.headers.get(n);
    if (v != null && v.trim() !== "") {
      const num = Number(v);
      if (Number.isFinite(num)) return num;
    }
  }
  return null;
}

export interface PingRateLimit {
  limit: number | null;
  remaining: number | null;
  resetSeconds: number | null;
}

export async function pingPlatform(platform: SocialPlatform): Promise<{
  ok: boolean;
  status: number;
  message: string;
  latencyMs: number;
  rateLimit?: PingRateLimit;
}> {
  const { getRapidApiKey } = await import("@/lib/env");
  const plan = SOCIAL_PLANS[platform];
  const start = Date.now();
  try {
    const probePath =
      platform === "youtube"
        ? "/video/details/?id=dQw4w9WgXcQ"
        : platform === "instagram"
          ? "/profile?username=instagram"
          : "/user/info?unique_id=@tiktok";
    const res = await fetch(`https://${plan.apiHost}${probePath}`, {
      method: "GET",
      headers: {
        "x-rapidapi-host": plan.apiHost,
        "x-rapidapi-key": getRapidApiKey(),
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    const latency = Date.now() - start;
    const rateLimit: PingRateLimit = {
      limit: parseHeaderInt(res, ["x-ratelimit-requests-limit", "x-ratelimit-scraping-api-limit"]),
      remaining: parseHeaderInt(res, ["x-ratelimit-requests-remaining", "x-ratelimit-scraping-api-remaining"]),
      resetSeconds: parseHeaderInt(res, ["x-ratelimit-requests-reset", "x-ratelimit-scraping-api-reset"]),
    };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        message: text.slice(0, 200) || res.statusText,
        latencyMs: latency,
        rateLimit,
      };
    }
    return { ok: true, status: res.status, message: "OK", latencyMs: latency, rateLimit };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "?",
      latencyMs: Date.now() - start,
    };
  }
}
