import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import {
  fetchBrandIgamingProfile,
  fetchBrandPayrollRuns,
  upsertBrandPayrollRun,
} from "@/lib/db/brand-igaming-repo";
import type { BrandPayrollRun } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ runs: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  const month = req.nextUrl.searchParams.get("month")?.trim() || undefined;
  const runs = await fetchBrandPayrollRuns(brandId, month);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandPayrollRun> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const month = String(body.month ?? "").trim();
  if (!month) return NextResponse.json({ error: "month gerekli" }, { status: 400 });
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bpr-"));
  const run: BrandPayrollRun = {
    id: isNew ? `bpr-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    month,
    status: body.status ?? "draft",
    approvedBy: body.approvedBy || session.userId,
    approvedAt: body.status === "approved" || body.status === "paid" ? new Date().toISOString() : undefined,
    notes: body.notes ?? "",
  };
  const saved = await upsertBrandPayrollRun(run);
  return NextResponse.json({ run: saved });
}

// GET profile fields for marka/profil page
export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    brandId?: string;
    licenseJurisdiction?: string;
    restrictedGeos?: string[];
    igamingSettings?: Record<string, unknown>;
  } | null;
  const brandId = resolveBrandId(session, String(body?.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const { updateBrandIgamingProfile } = await import("@/lib/db/brand-igaming-repo");
  await updateBrandIgamingProfile(brandId, {
    licenseJurisdiction: body?.licenseJurisdiction,
    restrictedGeos: body?.restrictedGeos,
    igamingSettings: body?.igamingSettings,
  });
  const profile = await fetchBrandIgamingProfile(brandId);
  return NextResponse.json({ profile });
}
