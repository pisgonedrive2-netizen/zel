import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isRapidApiEnabled } from "@/lib/env";
import { SOCIAL_PLANS } from "./config";
import { resolveLinkDetection } from "./platform-detect";
import { fetchMetricsForLink } from "./clients";
import { getMonthlyUsage, incrementUsage } from "./quota";

interface BrandPostRow {
  id: string;
  brand_id: string;
  employee_id: string | null;
  platform: string;
  url: string;
  external_ref: string | null;
  last_views: number | null;
  check_count: number | null;
}

/** Client'a uygulanacak metrik yaması (camelCase). */
export interface BrandPostMetricsPatch {
  lastViews?: number;
  lastLikes?: number;
  lastComments?: number;
  lastShares?: number;
  lastCheckedAt?: string;
  lastCheckError?: string;
  externalRef?: string;
  checkCount?: number;
}

export interface BrandPostRefreshResult {
  postId: string;
  ok: boolean;
  error?: string;
  views?: number | null;
  delta?: number;
  patch?: BrandPostMetricsPatch;
}

/** Çağıran tarafın yetki bağlamı — route session'ından türetilir. */
export interface BrandPostRefreshAuth {
  /** admin / auditor: her postu yenileyebilir. */
  isAdmin?: boolean;
  /** Marka kullanıcısının birincil markası. */
  brandId?: string;
  /** Marka kullanıcısının erişebildiği tüm marka id'leri (multi-tenant). */
  brandIds?: string[];
  /** Yayıncının çalışan id'si (kendi postları için). */
  employeeId?: string;
}

const POST_COLUMNS =
  "id, brand_id, employee_id, platform, url, external_ref, last_views, check_count";

function canRefresh(row: BrandPostRow, auth: BrandPostRefreshAuth): boolean {
  if (auth.isAdmin) return true;
  const ownsBrand =
    (auth.brandId != null && row.brand_id === auth.brandId) ||
    (Array.isArray(auth.brandIds) && auth.brandIds.includes(row.brand_id));
  const ownsEmployee =
    auth.employeeId != null && row.employee_id != null && row.employee_id === auth.employeeId;
  return ownsBrand || ownsEmployee;
}

/**
 * Tek bir marka postu (brand_posts) için izlenme çeker. Marka linki refresh'i ve
 * haftalık reel refresh'i ile aynı RapidAPI çekirdeğini ve aylık kotayı kullanır.
 * Sonuç brand_posts satırına son-ölçüm (last_*) kolonlarına yazılır; mevcut
 * views/likes/comments alanlarına dokunulmaz. Client state'ine uygulanmak üzere
 * `patch` döner.
 */
export async function refreshPostMetrics(
  postId: string,
  auth: BrandPostRefreshAuth = {}
): Promise<BrandPostRefreshResult> {
  if (!isRapidApiEnabled()) {
    return { postId, ok: false, error: "RAPIDAPI_KEY eksik — izlenme çekilemiyor." };
  }
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("brand_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .single();
  if (error || !data) {
    return { postId, ok: false, error: error?.message ?? "Post bulunamadı" };
  }
  const row = data as BrandPostRow;

  // Yetki: admin/auditor her zaman; marka kullanıcısı yalnız kendi markasının
  // postu; yayıncı yalnızca kendi (employeeId) postu.
  if (!canRefresh(row, auth)) {
    return { postId, ok: false, error: "Bu post için yetkiniz yok" };
  }

  const detected = resolveLinkDetection({
    url: row.url,
    platform: row.platform,
    externalRef: row.external_ref ?? undefined,
  });
  if (!detected) {
    const now = new Date().toISOString();
    await persistError(postId, "URL platform tespiti başarısız (yalnızca Instagram / TikTok / YouTube)").catch(
      () => undefined
    );
    return {
      postId,
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
      postId,
      ok: false,
      error: `Bu ayki güvenli kota (${safeLimit}) doldu — sonra tekrar deneyin.`,
    };
  }

  try {
    const metrics = await fetchMetricsForLink(detected);
    await incrementUsage(detected.platform, 1);
    const now = new Date().toISOString();
    const previousViews = row.last_views;
    const patch: BrandPostMetricsPatch = {
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
      .from("brand_posts")
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
      .eq("id", postId);
    if (upErr) throw new Error(upErr.message);

    const delta =
      previousViews != null && metrics.views != null ? metrics.views - previousViews : undefined;
    return { postId, ok: true, views: metrics.views, delta, patch };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    const now = new Date().toISOString();
    await persistError(postId, msg).catch(() => undefined);
    return {
      postId,
      ok: false,
      error: msg,
      patch: { lastCheckedAt: now, lastCheckError: msg.slice(0, 240) },
    };
  }
}

async function persistError(postId: string, msg: string): Promise<void> {
  await getSupabaseAdmin()
    .from("brand_posts")
    .update({
      last_checked_at: new Date().toISOString(),
      last_check_error: msg.slice(0, 240),
    })
    .eq("id", postId);
}
