import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId, hasOrgCapability, writeAudit } from "@/lib/org-access";
import {
  fetchBrandDealTrackingLinks,
  upsertBrandDealTrackingLink,
  deleteBrandDealTrackingLink,
  syncDealTrackingAttribution,
} from "@/lib/db/brand-igaming-repo";
import type { BrandDealTrackingLink } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ links: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const url = new URL(req.url);
  const requested = url.searchParams.get("brandId")?.trim() || undefined;
  const dealId = url.searchParams.get("dealId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requested);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  try {
    const links = await fetchBrandDealTrackingLinks(brandId, dealId);
    return NextResponse.json({ links });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Takip linkleri alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yok" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "crm") && session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });

  const requested = String(body.brandId ?? "").trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requested) ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  if (body.action === "sync-attribution") {
    const dealId = String(body.dealId ?? "").trim();
    if (!dealId) return NextResponse.json({ error: "dealId gerekli" }, { status: 400 });
    try {
      const links = await syncDealTrackingAttribution(brandId, dealId);
      await writeAudit(session, "deal_tracking_sync", `deal=${dealId} brand=${brandId}`);
      return NextResponse.json({ links });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Senkron başarısız" }, { status: 500 });
    }
  }

  const dealId = String(body.dealId ?? "").trim();
  const url = String(body.url ?? "").trim();
  if (!dealId || !url) return NextResponse.json({ error: "dealId ve url gerekli" }, { status: 400 });

  const link: BrandDealTrackingLink = {
    id: typeof body.id === "string" && body.id ? body.id : `dtl-${crypto.randomUUID().slice(0, 12)}`,
    brandId,
    dealId,
    url,
    promoCode: body.promoCode ? String(body.promoCode) : undefined,
    utmSource: body.utmSource ? String(body.utmSource) : undefined,
    utmCampaign: body.utmCampaign ? String(body.utmCampaign) : undefined,
    externalRef: body.externalRef ? String(body.externalRef) : undefined,
    attributedFtd: Number(body.attributedFtd) || 0,
    attributedDeposit: Number(body.attributedDeposit) || 0,
  };

  try {
    const saved = await upsertBrandDealTrackingLink(link);
    await writeAudit(session, "deal_tracking_saved", `id=${saved.id}`);
    return NextResponse.json({ link: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kayıt başarısız" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yok" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    await deleteBrandDealTrackingLink(id);
    await writeAudit(session, "deal_tracking_deleted", `id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Silinemedi" }, { status: 500 });
  }
}
