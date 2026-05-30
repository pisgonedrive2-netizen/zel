import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isRapidApiEnabled } from "@/lib/env";
import { SOCIAL_PLANS } from "./config";
import { resolveLinkDetection } from "./platform-detect";
import { fetchMetricsForLink } from "./clients";
import { getMonthlyUsage, incrementUsage } from "./quota";

interface WeekReelRow {
  id: string;
  employee_id: string;
  brand_id: string;
  platform: string;
  content_url: string;
  external_ref: string | null;
  last_views: number | null;
  check_count: number | null;
}

/** Client'a uygulanacak metrik yaması (camelCase). */
export interface WeekReelMetricsPatch {
  lastViews?: number;
  lastLikes?: number;
  lastComments?: number;
  lastShares?: number;
  lastCheckedAt?: string;
  lastCheckError?: string;
  externalRef?: string;
  checkCount?: number;
}

export interface WeekReelRefreshResult {
  reelId: string;
  ok: boolean;
  error?: string;
  views?: number | null;
  delta?: number;
  patch?: WeekReelMetricsPatch;
}

const REEL_COLUMNS =
  "id, employee_id, brand_id, platform, content_url, external_ref, last_views, check_count";

/**
 * Tek bir haftalık reel/gönderi için izlenme çeker. Marka linki refresh'i ile
 * aynı RapidAPI çekirdeğini ve aylık kotayı kullanır. Sonuç DB'ye yazılır ve
 * client state'ine uygulanmak üzere `patch` döner.
 */
export async function refreshWeekReel(
  reelId: string,
  opts: { employeeId?: string; isAdmin?: boolean } = {}
): Promise<WeekReelRefreshResult> {
  if (!isRapidApiEnabled()) {
    return { reelId, ok: false, error: "RAPIDAPI_KEY eksik — izlenme çekilemiyor." };
  }
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("week_brand_reels")
    .select(REEL_COLUMNS)
    .eq("id", reelId)
    .single();
  if (error || !data) {
    return { reelId, ok: false, error: error?.message ?? "Kayıt bulunamadı" };
  }
  const row = data as WeekReelRow;

  // Yetki: admin/auditor her zaman; yayıncı yalnızca kendi kaydı.
  if (!opts.isAdmin && opts.employeeId && row.employee_id !== opts.employeeId) {
    return { reelId, ok: false, error: "Bu kayıt için yetkiniz yok" };
  }

  const detected = resolveLinkDetection({
    url: row.content_url,
    platform: row.platform,
    externalRef: row.external_ref ?? undefined,
  });
  if (!detected) {
    const now = new Date().toISOString();
    await persistError(reelId, "URL platform tespiti başarısız (yalnızca Instagram / TikTok / YouTube)").catch(() => undefined);
    return {
      reelId,
      ok: false,
      error: "URL desteklenmiyor (yalnızca Instagram / TikTok / YouTube içerik linkleri)",
      patch: { lastCheckedAt: now, lastCheckError: "URL platform tespiti başarısız" },
    };
  }

  const usage = await getMonthlyUsage(detected.platform);
  const plan = SOCIAL_PLANS[detected.platform];
  const safeLimit = Math.floor(plan.monthlyLimit * plan.safeFraction);
  if (usage.requestsUsed >= safeLimit) {
    return {
      reelId,
      ok: false,
      error: `Bu ayki güvenli kota (${safeLimit}) doldu — sonra tekrar deneyin.`,
    };
  }

  try {
    const metrics = await fetchMetricsForLink(detected);
    await incrementUsage(detected.platform, 1);
    const now = new Date().toISOString();
    const previousViews = row.last_views;
    const patch: WeekReelMetricsPatch = {
      lastViews: metrics.views ?? undefined,
      lastLikes: metrics.likes ?? undefined,
      lastComments: metrics.comments ?? undefined,
      lastShares: metrics.shares ?? undefined,
      lastCheckedAt: now,
      lastCheckError: "",
      externalRef: detected.externalRef,
      checkCount: (row.check_count ?? 0) + 1,
    };
    const { error: upErr } = await db
      .from("week_brand_reels")
      .update({
        last_views: metrics.views ?? null,
        last_likes: metrics.likes ?? null,
        last_comments: metrics.comments ?? null,
        last_shares: metrics.shares ?? null,
        last_checked_at: now,
        last_check_error: null,
        external_ref: detected.externalRef,
        check_count: (row.check_count ?? 0) + 1,
      })
      .eq("id", reelId);
    if (upErr) throw new Error(upErr.message);

    const delta =
      previousViews != null && metrics.views != null ? metrics.views - previousViews : undefined;
    return { reelId, ok: true, views: metrics.views, delta, patch };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    const now = new Date().toISOString();
    await persistError(reelId, msg).catch(() => undefined);
    return {
      reelId,
      ok: false,
      error: msg,
      patch: { lastCheckedAt: now, lastCheckError: msg.slice(0, 240) },
    };
  }
}

async function persistError(reelId: string, msg: string): Promise<void> {
  await getSupabaseAdmin()
    .from("week_brand_reels")
    .update({
      last_checked_at: new Date().toISOString(),
      last_check_error: msg.slice(0, 240),
    })
    .eq("id", reelId);
}
