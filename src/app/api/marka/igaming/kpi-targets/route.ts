import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess,
  resolveBrandId,
  hasOrgCapability,
  writeAudit,
} from "@/lib/org-access";
import { fetchBrandKpiTargets, saveBrandKpiTarget } from "@/lib/db/brand-igaming-repo";
import { writeBrandIgamingAudit } from "@/lib/brand-igaming-audit";
import type { BrandKpiTarget } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMonth(v: string | null | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ targets: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const url = new URL(req.url);
  const requested = url.searchParams.get("brandId")?.trim() || undefined;
  const month = url.searchParams.get("month")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;

  const brandId = resolveBrandId(session, requested);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  try {
    const targets = await fetchBrandKpiTargets(brandId, isMonth(month) ? month : undefined);
    return NextResponse.json({ targets });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "KPI hedefleri alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "KPI hedef düzenleme yetkisi yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<BrandKpiTarget> | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const month = String(body.month ?? "").trim();
  if (!isMonth(month)) {
    return NextResponse.json({ error: "month formatı YYYY-MM olmalı" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const isNew = !(typeof body.id === "string" && /^bkt-/i.test(body.id));
  const id = isNew ? `bkt-${crypto.randomUUID().slice(0, 10)}` : (body.id as string);
  const target: BrandKpiTarget = {
    id,
    brandId,
    month,
    targetFtd: Math.max(0, Math.floor(Number(body.targetFtd) || 0)),
    targetRegistrations: Math.max(0, Math.floor(Number(body.targetRegistrations) || 0)),
    targetDepositAmount: Math.max(0, Number(body.targetDepositAmount) || 0),
    targetNgr: Number(body.targetNgr) || 0,
    targetContentDeliveries: Math.max(0, Math.floor(Number(body.targetContentDeliveries) || 0)),
    targetAffiliateRoi:
      body.targetAffiliateRoi != null ? Number(body.targetAffiliateRoi) : undefined,
    notes: String(body.notes ?? "").trim(),
    updatedBy: session.userId,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };

  try {
    const saved = await saveBrandKpiTarget(target);
    await writeBrandIgamingAudit(session, brandId, isNew ? "kpi_target_created" : "kpi_target_updated", {
      entityType: "brand_kpi_targets",
      entityId: saved.id,
      detail: `month=${month}`,
    });
    await writeAudit(
      session,
      isNew ? "brand_kpi_target_created" : "brand_kpi_target_updated",
      `target=${saved.id} brand=${brandId} month=${month}`,
    );
    return NextResponse.json({ target: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "KPI hedefi kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
