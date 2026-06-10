import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, ensureOrgCapability, resolveBrandId, writeAudit } from "@/lib/org-access";
import {
  deleteBrandComplianceCheck,
  fetchBrandComplianceChecks,
  findBrandComplianceById,
  upsertBrandComplianceCheck,
} from "@/lib/db/brand-igaming-repo";
import type { BrandComplianceCheck } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["kyc", "geo_restrict", "responsible_gaming", "ad_disclosure", "license", "other"] as const;
const STATUS = ["pending", "passed", "failed", "waived"] as const;

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ checks: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  try {
    const checks = await fetchBrandComplianceChecks(brandId);
    return NextResponse.json({ ok: true, checks });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Uyumluluk verileri yüklenemedi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandComplianceCheck> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "compliance");
  if (capGuard) return capGuard;
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bcc-"));
  const check: BrandComplianceCheck = {
    id: isNew ? `bcc-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    checkType: TYPES.includes(body.checkType as typeof TYPES[number]) ? body.checkType! : "other",
    status: STATUS.includes(body.status as typeof STATUS[number]) ? body.status! : "pending",
    dueDate: body.dueDate || undefined,
    completedAt: body.completedAt || undefined,
    evidenceUrl: body.evidenceUrl?.trim() || undefined,
    notes: body.notes ?? "",
  };
  try {
    const saved = await upsertBrandComplianceCheck(check);
    await writeAudit(session, isNew ? "brand_compliance_created" : "brand_compliance_updated", `check=${saved.id}`);
    return NextResponse.json({ check: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kaydedilemedi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandComplianceCheck> & { id?: string } | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const existing = await findBrandComplianceById(id);
  if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  const guard = ensureBrandAccess(session, existing.brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "compliance");
  if (capGuard) return capGuard;
  const saved = await upsertBrandComplianceCheck({ ...existing, ...body, id, brandId: existing.brandId });
  return NextResponse.json({ check: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const existing = await findBrandComplianceById(id);
  if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  const guard = ensureBrandAccess(session, existing.brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "compliance");
  if (capGuard) return capGuard;
  await deleteBrandComplianceCheck(id);
  return NextResponse.json({ ok: true });
}
