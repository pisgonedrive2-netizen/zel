import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { detectPlatform } from "@/lib/social-api/platform-detect";
import { fetchRichDetailsForLink, type RichLinkDetails } from "@/lib/social-api/clients";
import { incrementUsage } from "@/lib/social-api/quota";
import { calcBatchSize } from "@/lib/social-api/config";

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
  // Brand kullanıcısı sadece kendi markasının linkini görebilsin
  if (session.role === "brand" && session.brandId && link.brand_id !== session.brandId) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  // Streamer sadece kendi ownerId'sindeki linki görebilsin
  if (session.role === "streamer" && session.employeeId && link.owner_id !== session.employeeId) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const detected = detectPlatform(String(link.url));
  if (!detected) {
    return NextResponse.json(
      { ok: false, error: "Bu URL'den otomatik veri çekilemiyor (platform desteklenmiyor)." },
      { status: 422 },
    );
  }

  // Kota kontrolü
  const calc = calcBatchSize({ platform: detected.platform, usedThisMonth: 0 });
  // calcBatchSize'ı doğru kullanmak için kullanım sayısını çek
  const { data: usageRow } = await db
    .from("api_quota_usage")
    .select("requests_used, monthly_limit")
    .eq("platform", detected.platform)
    .eq("month", new Date().toISOString().slice(0, 7))
    .maybeSingle();
  const used = (usageRow?.requests_used ?? 0) as number;
  const limit = (usageRow?.monthly_limit ?? calc.monthlyBudget) as number;
  if (used >= Math.floor(limit * 0.99)) {
    return NextResponse.json(
      {
        ok: false,
        error: `${detected.platform} aylık kotası neredeyse doldu (${used}/${limit}). Ay sonunu bekleyin veya planınızı yükseltin.`,
        platform: detected.platform,
        quotaExhausted: true,
      },
      { status: 429 },
    );
  }

  let details: RichLinkDetails;
  try {
    details = await fetchRichDetailsForLink(detected);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "API hatası",
        platform: detected.platform,
      },
      { status: 502 },
    );
  } finally {
    // Çağrı yapıldıysa kotadan düş (başarılı/başarısız fark etmez)
    await incrementUsage(detected.platform, 1).catch(() => undefined);
  }

  // brand_links üzerindeki son ölçümleri de güncelleyelim (manuel refresh effect'i)
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
}
