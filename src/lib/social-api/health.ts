import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SOCIAL_PLANS, type SocialPlatform } from "./config";

export interface PlatformHealth {
  platform: SocialPlatform;
  status: "ok" | "warn" | "error" | "exhausted" | "unknown";
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  successCount24h: number;
  errorCount24h: number;
  /** Saat cinsinden son başarılı çağrıdan beri geçen süre (yoksa null). */
  staleHours: number | null;
}

/**
 * Tüm platformlar için sağlık özeti döner.
 *
 * Mantık:
 *   - api_refresh_runs'a son 24 saatte yazılmış kayıtlardan başarı/başarısızlık
 *     dağılımı çıkarılır.
 *   - brand_links'te `last_check_error` dolu olan satırlar son hatayı verir.
 *   - status:
 *       error      → son 24 saatte 0 başarı + >=1 başarısız çalıştırma
 *       warn       → son başarı 36 saatten eski VEYA son 24 saatte hata oranı %50+
 *       exhausted  → quota güvenli sınıra ulaştı (refresh-runner kotaya göre 0 batch döner)
 *       ok         → son 24 saatte en az 1 başarı, hata yok ya da düşük oran
 *       unknown    → hiç çalıştırma kaydı yok (yeni kurulum)
 */
export async function getPlatformHealth(): Promise<PlatformHealth[]> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data: runs } = await db
    .from("api_refresh_runs")
    .select("platform, started_at, links_succeeded, links_failed, error_summary")
    .gte("started_at", since)
    .order("started_at", { ascending: false });

  // Son hata mesajı için brand_links içinden çek
  const { data: errLinks } = await db
    .from("brand_links")
    .select("platform, last_check_error, last_checked_at")
    .not("last_check_error", "is", null)
    .order("last_checked_at", { ascending: false })
    .limit(30);

  const platforms: SocialPlatform[] = ["youtube", "instagram", "tiktok"];
  const now = Date.now();

  return platforms.map<PlatformHealth>((p) => {
    const platformRuns = (runs ?? []).filter((r) => (r as { platform: string }).platform === p) as Array<{
      platform: string;
      started_at: string;
      links_succeeded: number;
      links_failed: number;
      error_summary: string;
    }>;

    const totalSuccess = platformRuns.reduce((s, r) => s + (r.links_succeeded ?? 0), 0);
    const totalFail = platformRuns.reduce((s, r) => s + (r.links_failed ?? 0), 0);

    const lastSuccessRun = platformRuns.find((r) => (r.links_succeeded ?? 0) > 0);
    const lastFailRun = platformRuns.find((r) => (r.links_failed ?? 0) > 0);

    const labelsForPlatform = (() => {
      if (p === "youtube") return ["YouTube", "Youtube", "youtube"];
      if (p === "instagram") return ["Instagram", "instagram"];
      return ["TikTok", "Tiktok", "tiktok"];
    })();
    const matchingErr = (errLinks ?? []).find((e) => labelsForPlatform.includes(String((e as { platform: string }).platform)));
    const lastError = matchingErr ? String((matchingErr as { last_check_error: string }).last_check_error) : lastFailRun?.error_summary ?? null;

    const lastSuccessAt = lastSuccessRun?.started_at ?? null;
    const lastErrorAt = lastFailRun?.started_at ?? null;
    const staleHours = lastSuccessAt
      ? (now - new Date(lastSuccessAt).getTime()) / 3_600_000
      : null;

    let status: PlatformHealth["status"] = "unknown";
    if (platformRuns.length > 0) {
      if (totalSuccess === 0 && totalFail > 0) status = "error";
      else if ((staleHours != null && staleHours > 36) || (totalFail > 0 && totalFail / (totalFail + totalSuccess) >= 0.5))
        status = "warn";
      else status = "ok";
    }

    return {
      platform: p,
      status,
      lastSuccessAt,
      lastErrorAt,
      lastError,
      successCount24h: totalSuccess,
      errorCount24h: totalFail,
      staleHours,
    };
  });
}

/**
 * Tek bir platform için minimal bir ping isteği yapar (test çağrısı).
 * Bu çağrı kotadan 1 tüketir; manuel olarak çağrılır (admin "test et" butonu).
 */
export async function pingPlatform(platform: SocialPlatform): Promise<{
  ok: boolean;
  status: number;
  message: string;
  latencyMs: number;
}> {
  const { getRapidApiKey } = await import("@/lib/env");
  const plan = SOCIAL_PLANS[platform];
  const start = Date.now();
  try {
    // Çok düşük maliyetli, deterministik bir endpoint ile probe
    const probePath =
      platform === "youtube"
        ? "/video/details/?id=dQw4w9WgXcQ" // canlı bir video id
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
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        message: text.slice(0, 200) || res.statusText,
        latencyMs: latency,
      };
    }
    return { ok: true, status: res.status, message: "OK", latencyMs: latency };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "?",
      latencyMs: Date.now() - start,
    };
  }
}
