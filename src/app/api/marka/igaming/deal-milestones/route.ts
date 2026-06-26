import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId, hasOrgCapability, writeAudit } from "@/lib/org-access";
import { fetchBrandDealMilestones, upsertBrandDealMilestone } from "@/lib/db/brand-igaming-repo";
import { upsertLedgerEntry } from "@/lib/db/brand-accounting-repo";
import type { BrandDealMilestone } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ milestones: [] });
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
    const milestones = await fetchBrandDealMilestones(brandId, dealId);
    return NextResponse.json({ milestones });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kilometre taşları alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yok" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "crm") && !hasOrgCapability(session, "finance") && session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });

  const requested = String(body.brandId ?? "").trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requested) ?? "";
  const dealId = String(body.dealId ?? "").trim();
  const title = String(body.title ?? "").trim();
  if (!brandId || !dealId || !title) {
    return NextResponse.json({ error: "brandId, dealId, title gerekli" }, { status: 400 });
  }

  const milestone: BrandDealMilestone = {
    id: typeof body.id === "string" && body.id ? body.id : `ms-${crypto.randomUUID().slice(0, 12)}`,
    brandId,
    dealId,
    title,
    dueDate: body.dueDate ? String(body.dueDate) : undefined,
    kpiType: body.kpiType ? String(body.kpiType) : undefined,
    kpiTarget: body.kpiTarget != null ? Number(body.kpiTarget) : undefined,
    kpiActual: body.kpiActual != null ? Number(body.kpiActual) : undefined,
    paymentAmount: body.paymentAmount != null ? Number(body.paymentAmount) : undefined,
    status: (["pending", "met", "missed", "paid"] as const).includes(body.status as BrandDealMilestone["status"])
      ? (body.status as BrandDealMilestone["status"])
      : "pending",
  };

  try {
    let saved = await upsertBrandDealMilestone(milestone);

    if (body.action === "record-payment" && saved.paymentAmount && saved.paymentAmount > 0) {
      const entryDate = new Date().toISOString().slice(0, 10);
      await upsertLedgerEntry({
        id: `led-ms-${saved.id}`,
        brandId,
        entryDate,
        direction: "expense",
        category: "influencer",
        description: `Anlaşma milestone: ${saved.title}`,
        amount: saved.paymentAmount,
        currency: "USD",
        source: "deal_milestone",
        refId: saved.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saved = await upsertBrandDealMilestone({ ...saved, status: "paid" });
      await writeAudit(session, "deal_milestone_paid", `milestone=${saved.id} amount=${saved.paymentAmount}`);
    } else {
      await writeAudit(session, "deal_milestone_saved", `id=${saved.id}`);
    }

    return NextResponse.json({ milestone: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kayıt başarısız" }, { status: 500 });
  }
}
