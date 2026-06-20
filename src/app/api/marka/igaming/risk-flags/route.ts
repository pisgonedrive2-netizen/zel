import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, ensureOrgCapability, resolveBrandId, writeAudit } from "@/lib/org-access";
import {
  deleteBrandRiskFlag,
  fetchBrandRiskFlags,
  findBrandRiskFlagById,
  upsertBrandRiskFlag,
} from "@/lib/db/brand-igaming-repo";
import type { BrandRiskFlag } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLAG_TYPES = [
  "deposit_spike", "withdrawal_spike", "duplicate_device", "incentive_abuse", "other",
] as const;
const SEVERITIES = ["low", "medium", "high"] as const;

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ flags: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  try {
    const flags = await fetchBrandRiskFlags(brandId);
    return NextResponse.json({ ok: true, flags });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Risk bayrakları yüklenemedi" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandRiskFlag> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "compliance");
  if (capGuard) return capGuard;
  const isNew = !(typeof body.id === "string" && body.id.startsWith("brf-"));
  const flag: BrandRiskFlag = {
    id: isNew ? `brf-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    flagType: FLAG_TYPES.includes(body.flagType as typeof FLAG_TYPES[number]) ? body.flagType! : "other",
    severity: SEVERITIES.includes(body.severity as typeof SEVERITIES[number]) ? body.severity! : "medium",
    detectedAt: body.detectedAt || new Date().toISOString().slice(0, 10),
    resolvedAt: body.resolvedAt || undefined,
    notes: body.notes ?? "",
    score: body.score != null ? Number(body.score) : undefined,
    source: body.source ?? "manual",
  };
  try {
    const saved = await upsertBrandRiskFlag(flag);
    await writeAudit(session, isNew ? "brand_risk_flag_created" : "brand_risk_flag_updated", `flag=${saved.id}`);
    return NextResponse.json({ flag: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kaydedilemedi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandRiskFlag> & { id?: string; resolve?: boolean } | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const existing = await findBrandRiskFlagById(id);
  if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  const guard = ensureBrandAccess(session, existing.brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "compliance");
  if (capGuard) return capGuard;
  const resolvedAt = body?.resolve
    ? new Date().toISOString()
    : body?.resolvedAt === null
      ? undefined
      : body?.resolvedAt ?? existing.resolvedAt;
  const saved = await upsertBrandRiskFlag({ ...existing, ...body, id, brandId: existing.brandId, resolvedAt });
  return NextResponse.json({ flag: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const existing = await findBrandRiskFlagById(id);
  if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  const guard = ensureBrandAccess(session, existing.brandId, "write");
  if (guard) return guard;
  const capGuard = ensureOrgCapability(session, "compliance");
  if (capGuard) return capGuard;
  await deleteBrandRiskFlag(id);
  return NextResponse.json({ ok: true });
}
