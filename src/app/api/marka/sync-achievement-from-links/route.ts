import { NextRequest, NextResponse } from "next/server";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { weekBrandReelFromRow } from "@/lib/db/mappers";
import { isoToLocalDateOnly } from "@/lib/data";
import { fetchMetricsForLink } from "@/lib/social-api/clients";
import { persistLinkMetricsUpdate } from "@/lib/social-api/link-persist";
import {
  ensureWeekBrandReelFromBrandLink,
  type BrandLinkAchievementRow,
} from "@/lib/social-api/link-achievement-sync";
import { resolveLinkDetection } from "@/lib/social-api/platform-detect";
import { incrementUsage, getMonthlyUsage } from "@/lib/social-api/quota";
import { SOCIAL_PLANS } from "@/lib/social-api/config";
import type { WeekBrandReel } from "@/store/store";
import { notifyBrandContentPublished } from "@/lib/marka-brand-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_API_LINKS = 35;

const EMPTY_METRICS = {
  views: null,
  likes: null,
  comments: null,
  shares: null,
} as const;

function detectContentLink(row: BrandLinkAchievementRow) {
  return resolveLinkDetection({
    url: row.url,
    platform: row.platform,
    handle: row.handle,
    externalRef: row.external_ref ?? undefined,
  });
}

/**
 * POST /api/marka/sync-achievement-from-links?brandId=&employeeId=
 *
 * Marka kapsamındaki aktif içerik linklerini senkronlar (yalnızca owner_id atanmış).
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const requestedBrand = req.nextUrl.searchParams.get("brandId")?.trim();
  const brandId = resolveBrandId(session, requestedBrand);
  if (!brandId) {
    return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  }

  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;

  const filterEmployeeId = req.nextUrl.searchParams.get("employeeId")?.trim() || undefined;

  const db = getSupabaseAdmin();
  let linkQuery = db
    .from("brand_links")
    .select(
      "id, brand_id, platform, url, handle, owner_id, external_ref, last_snapshot_date, last_views, check_count, refresh_count_total, status"
    )
    .eq("brand_id", brandId)
    .eq("status", "active")
    .not("owner_id", "is", null);

  if (filterEmployeeId) {
    linkQuery = linkQuery.eq("owner_id", filterEmployeeId);
  }

  const { data: links, error: linkErr } = await linkQuery;
  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  const contentLinks = ((links ?? []) as BrandLinkAchievementRow[]).filter((row) => {
    const det = detectContentLink(row);
    return det?.kind === "video";
  });

  const summary = {
    attempted: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
    localOnly: 0,
    errors: [] as string[],
  };

  for (const link of contentLinks) {
    const { data: existingReel } = await db
      .from("week_brand_reels")
      .select("id, published_at")
      .eq("brand_link_id", link.id)
      .maybeSingle();

    if (existingReel?.id) continue;

    const detected = detectContentLink(link);
    if (!detected) continue;

    try {
      const ensured = await ensureWeekBrandReelFromBrandLink({
        link,
        metrics: { ...EMPTY_METRICS },
        externalRef: detected.externalRef,
      });
      if (ensured) {
        summary.localOnly += 1;
        summary.synced += 1;
      }
    } catch (err) {
      summary.failed += 1;
      const msg = err instanceof Error ? err.message : "Kayıt hatası";
      summary.errors.push(`${link.handle || link.id}: ${msg.slice(0, 80)}`);
    }
  }

  if (!isRapidApiEnabled()) {
    const allReels = await loadBrandReels(db, brandId, filterEmployeeId);
    if (summary.synced > 0) {
      void notifyBrandContentPublished({
        brandId,
        synced: summary.synced,
        monthYm: new Date().toISOString().slice(0, 7),
        employeeId: filterEmployeeId,
      });
    }
    return NextResponse.json({
      ok: true,
      reels: allReels,
      summary,
      warning: "RAPIDAPI_KEY yok — yalnızca yerel (snapshot) tarihleri yazıldı.",
    });
  }

  let apiCalls = 0;
  for (const link of contentLinks) {
    if (apiCalls >= MAX_API_LINKS) break;

    const detected = detectContentLink(link);
    if (!detected) continue;

    const { data: existingReel } = await db
      .from("week_brand_reels")
      .select("id, published_at")
      .eq("brand_link_id", link.id)
      .maybeSingle();

    if (existingReel?.published_at && isoToLocalDateOnly(String(existingReel.published_at))) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;
    apiCalls += 1;

    const usage = await getMonthlyUsage(detected.platform);
    const safeLimit = Math.floor(
      SOCIAL_PLANS[detected.platform].monthlyLimit *
        SOCIAL_PLANS[detected.platform].safeFraction
    );
    if (usage.requestsUsed >= safeLimit) {
      summary.skipped += 1;
      summary.errors.push(`${link.id}: kota dolu (${detected.platform})`);
      continue;
    }

    try {
      const metrics = await fetchMetricsForLink(detected);
      await incrementUsage(detected.platform, 1);
      await persistLinkMetricsUpdate({
        linkId: link.id,
        metrics,
        externalRef: detected.externalRef,
        previousViews: link.last_views != null ? Number(link.last_views) : null,
        checkCount: link.check_count != null ? Number(link.check_count) : 0,
        refreshCountTotal:
          link.refresh_count_total != null ? Number(link.refresh_count_total) : 0,
        publishedAt: metrics.publishedAt,
      });
      summary.synced += 1;
    } catch (err) {
      summary.failed += 1;
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      summary.errors.push(`${link.handle || link.id}: ${msg.slice(0, 120)}`);
    }
  }

  const allReels = await loadBrandReels(db, brandId, filterEmployeeId);

  if (summary.synced > 0) {
    const monthYm = new Date().toISOString().slice(0, 7);
    void notifyBrandContentPublished({
      brandId,
      synced: summary.synced,
      monthYm,
      employeeId: filterEmployeeId,
    });
  }

  return NextResponse.json({
    ok: true,
    reels: allReels,
    summary,
  });
}

async function loadBrandReels(
  db: ReturnType<typeof getSupabaseAdmin>,
  brandId: string,
  employeeId?: string
): Promise<WeekBrandReel[]> {
  let q = db.from("week_brand_reels").select("*").eq("brand_id", brandId);
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data } = await q;
  return (data ?? []).map((r) => weekBrandReelFromRow(r as Record<string, unknown>));
}
