import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, ensureOrgCapability, resolveBrandId, writeAudit } from "@/lib/org-access";
import { deleteBrandCampaign, fetchBrandCampaigns, findBrandCampaignById, upsertBrandCampaign } from "@/lib/db/brand-igaming-repo";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BrandCampaign } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["bonus", "tournament", "landing", "promo", "affiliate"] as const;
const STATUS = ["draft", "active", "paused", "ended"] as const;

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ campaigns: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  try {
    const campaigns = await fetchBrandCampaigns(brandId);
    return NextResponse.json({ ok: true, campaigns });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kampanyalar yüklenemedi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandCampaign> & { action?: string } | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;

  if (body.action === "sync-affiliate") {
    const capGuard = ensureOrgCapability(session, "bonus_ops");
    if (capGuard) return capGuard;
    try {
      const [campaigns, { data: partners }] = await Promise.all([
        fetchBrandCampaigns(brandId),
        getSupabaseAdmin().from("affiliate_partners").select("id, name, external_ref, notes").eq("brand_id", brandId),
      ]);
      const partnerList = (partners ?? []) as Array<{
        id: string;
        name: string;
        external_ref?: string | null;
        notes?: string | null;
      }>;
      const linked: Array<{ campaignId: string; campaignName: string; partnerId: string; partnerName: string; promoCode: string }> = [];
      const orphanCampaigns: string[] = [];
      for (const c of campaigns) {
        const code = (c.promoCode ?? "").trim().toLowerCase();
        if (!code || c.status === "ended") continue;
        const match = partnerList.find((p) => {
          const ref = (p.external_ref ?? "").trim().toLowerCase();
          const notes = (p.notes ?? "").toLowerCase();
          return ref === code || notes.includes(code) || p.name.toLowerCase().includes(code);
        });
        if (match) {
          linked.push({
            campaignId: c.id,
            campaignName: c.name,
            partnerId: match.id,
            partnerName: match.name,
            promoCode: c.promoCode!,
          });
        } else {
          orphanCampaigns.push(c.name);
        }
      }
      await writeAudit(session, "campaign_affiliate_sync", `linked=${linked.length} orphan=${orphanCampaigns.length}`);
      return NextResponse.json({ ok: true, linked, orphanCampaigns });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Senkron başarısız" }, { status: 500 });
    }
  }

  const capGuard = ensureOrgCapability(session, "bonus_ops");
  if (capGuard) return capGuard;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name gerekli" }, { status: 400 });
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bc-"));
  const campaign: BrandCampaign = {
    id: isNew ? `bc-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    name,
    campaignType: TYPES.includes(body.campaignType as typeof TYPES[number]) ? body.campaignType! : "bonus",
    promoCode: body.promoCode?.trim() || undefined,
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
    rules: body.rules ?? {},
    status: STATUS.includes(body.status as typeof STATUS[number]) ? body.status! : "draft",
    budgetUsd: body.budgetUsd,
    notes: body.notes ?? "",
  };
  try {
    const saved = await upsertBrandCampaign(campaign);
    await writeAudit(session, isNew ? "brand_campaign_created" : "brand_campaign_updated", `campaign=${saved.id}`);
    return NextResponse.json({ campaign: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kaydedilemedi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandCampaign> & { id?: string } | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const existing = await findBrandCampaignById(id);
  if (!existing) return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
  const guard = ensureBrandAccess(session, existing.brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "bonus_ops");
  if (capGuard) return capGuard;
  const saved = await upsertBrandCampaign({ ...existing, ...body, id, brandId: existing.brandId });
  return NextResponse.json({ campaign: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const existing = await findBrandCampaignById(id);
  if (!existing) return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
  const guard = ensureBrandAccess(session, existing.brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "bonus_ops");
  if (capGuard) return capGuard;
  await deleteBrandCampaign(id);
  await writeAudit(session, "brand_campaign_deleted", `campaign=${id}`);
  return NextResponse.json({ ok: true });
}
