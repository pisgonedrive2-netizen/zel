import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { detectPlatform } from "@/lib/social-api/platform-detect";
import { fetchRichDetailsForLink } from "@/lib/social-api/clients";
import { getMonthlyUsage, incrementUsage } from "@/lib/social-api/quota";
import { SOCIAL_PLANS } from "@/lib/social-api/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/link-details/[id]
 *
 * Tek bir brand_link için RapidAPI'den zengin detayları getirir
 * (başlık, açıklama, kapak, yayın tarihi, yazar, etiketler, ham metrikler).
 *
 * Bu istek kotadan 1 tüketir; bu yüzden admin/auditor/brand kendi linki
 * için talep edebilir (kendi paneli üzerinden tıklatınca).
 *
 * Kota tükenmişse 429 döner — UI'da uyarı gösterilir.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    .select("id, brand_id, url, platform, owner_id")
    .eq("id", id)
    .single();
  if (error || !link) {
    return NextResponse.json({ ok: false, error: "Link bulunamadı" }, { status: 404 });
  }
  // Rol-bazlı yetki kontrolü
  if (!["admin", "auditor", "brand", "streamer"].includes(session.role)) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  // Brand: yalnızca kendi markasının linkleri
  if (session.role === "brand") {
    if (!session.brandId || link.brand_id !== session.brandId) {
      return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
    }
  }
  // Streamer: yalnızca kendi owner_id'sine bağlı linkler
  if (session.role === "streamer") {
    if (!session.employeeId || link.owner_id !== session.employeeId) {
      return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
    }
  }

  const detected = detectPlatform(
    String(link.url),
    link.platform ? String(link.platform) : undefined
  );
  if (!detected) {
    return NextResponse.json(
      { ok: false, error: "Bu URL'den otomatik veri çekilemiyor (platform desteklenmiyor)." },
      { status: 422 },
    );
  }

  // Kota kontrolü — refresh-runner ile aynı güvenli sınır (%85)
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

  try {
    const details = await fetchRichDetailsForLink(detected);
    // Yalnızca başarılı API çağrısında kotadan düş (refresh-runner ile tutarlı)
    await incrementUsage(detected.platform, 1);

    const now = new Date().toISOString();
    await db
      .from("brand_links")
      .update({
        external_ref: detected.externalRef,
        last_checked_at: now,
        last_views: details.metrics.views,
        last_likes: details.metrics.likes,
        last_comments: details.metrics.comments,
        last_shares: details.metrics.shares,
        last_check_error: null,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, details });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "API hatası";
    await db
      .from("brand_links")
      .update({ last_check_error: msg.slice(0, 500) })
      .eq("id", id);
    /* hata kaydı başarısız olsa bile 502 dönmeye devam et */
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
