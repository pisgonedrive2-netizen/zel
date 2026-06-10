import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveLinkDetection } from "@/lib/social-api/platform-detect";
import { fetchRichDetailsForLink } from "@/lib/social-api/clients";
import { persistLinkMetricsUpdate } from "@/lib/social-api/link-persist";
import { linkUpdateFromPersisted } from "@/lib/social-api/link-store-sync";
import { getMonthlyUsage, incrementUsage } from "@/lib/social-api/quota";
import { SOCIAL_PLANS } from "@/lib/social-api/config";
import { canAccessBrandId } from "@/lib/org-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/link-details/[id]
 *
 * Tek bir brand_link için RapidAPI'den zengin detayları getirir
 * (başlık, açıklama, kapak, yayın tarihi, yazar, etiketler, ham metrikler).
 *
 * Bu istek kotadan 1 tüketir; başarılı olunca brand_links + link_snapshots
 * güncellenir — izlenme panelinde görünür.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const thumbOnly = req.nextUrl.searchParams.get("thumbOnly") === "1";
  if (!isSupabaseEnabled() || !isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "RapidAPI veya Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id gerekli" }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data: link, error } = await db
    .from("brand_links")
    .select(
      "id, brand_id, url, platform, handle, owner_id, external_ref, last_views, check_count"
    )
    .eq("id", id)
    .single();
  if (error || !link) {
    return NextResponse.json({ ok: false, error: "Link bulunamadı" }, { status: 404 });
  }
  if (!["admin", "auditor", "brand", "streamer"].includes(session.role)) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  if (session.role === "brand") {
    if (!canAccessBrandId(session, String(link.brand_id ?? ""))) {
      return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
    }
  }
  if (session.role === "streamer") {
    if (!session.employeeId || link.owner_id !== session.employeeId) {
      return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
    }
  }

  const detected = resolveLinkDetection({
    url: String(link.url ?? ""),
    platform: link.platform ? String(link.platform) : undefined,
    handle: link.handle ? String(link.handle) : undefined,
    externalRef: link.external_ref ? String(link.external_ref) : undefined,
  });
  if (!detected) {
    const plat = (link.platform ?? "").toLowerCase();
    const hint =
      plat.includes("instagram")
        ? " Instagram için tam reel/gönderi linki (…/reel/… veya …/p/…) veya profil kullanıcı adı (@handle) girin. /stories/ ve /highlights/ linkleri desteklenmez."
        : plat.includes("tiktok")
          ? " TikTok için tam video linki (…/video/…) veya @kullanıcı adı girin."
          : "";
    return NextResponse.json(
      {
        ok: false,
        error: `Bu URL'den otomatik veri çekilemiyor (platform tespiti başarısız).${hint}`,
      },
      { status: 422 },
    );
  }

  const usage = await getMonthlyUsage(detected.platform);
  const plan = SOCIAL_PLANS[detected.platform];
  const safeLimit = Math.floor(plan.monthlyLimit * plan.safeFraction);
  if (usage.requestsUsed >= safeLimit) {
    return NextResponse.json(
      {
        ok: false,
        error: `${plan.label} aylık güvenli kotası doldu (${usage.requestsUsed}/${safeLimit}). Ay sonunu bekleyin veya planınızı yükseltin.`,
        platform: detected.platform,
        quotaExhausted: true,
      },
      { status: 429 },
    );
  }

  const includePremium = req.nextUrl.searchParams.get("premium") !== "0";

  try {
    const details = await fetchRichDetailsForLink(detected, { includePremium });
    const extraCalls = details.premium?.extraApiCalls ?? 0;
    await incrementUsage(detected.platform, 1 + extraCalls);

    if (thumbOnly) {
      return NextResponse.json({
        ok: true,
        details: {
          thumbnailUrl: details.thumbnailUrl,
          title: details.title,
          platform: details.platform,
        },
      });
    }

    const persisted = await persistLinkMetricsUpdate({
      linkId: id,
      metrics: details.metrics,
      externalRef: detected.externalRef,
      previousViews: link.last_views != null ? Number(link.last_views) : null,
      checkCount: link.check_count != null ? Number(link.check_count) : 0,
      publishedAt: details.publishedAt,
    });

    return NextResponse.json({
      ok: true,
      details,
      linkUpdate: linkUpdateFromPersisted(id, persisted),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "API hatası";
    await db
      .from("brand_links")
      .update({ last_check_error: msg.slice(0, 500) })
      .eq("id", id);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        platform: detected.platform,
      },
      { status: 502 },
    );
  }
}
