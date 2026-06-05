import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import {
  fetchBrandDepartmentBudgets,
  upsertBrandDepartmentBudget,
} from "@/lib/db/brand-igaming-repo";
import type { BrandDepartmentBudget } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ budgets: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  const month = req.nextUrl.searchParams.get("month")?.trim() || undefined;
  const budgets = await fetchBrandDepartmentBudgets(brandId, month);
  return NextResponse.json({ budgets });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandDepartmentBudget> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const departmentId = String(body.departmentId ?? "").trim();
  const month = String(body.month ?? "").trim();
  if (!departmentId || !month) {
    return NextResponse.json({ error: "departmentId ve month gerekli" }, { status: 400 });
  }
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bdb-"));
  const budget: BrandDepartmentBudget = {
    id: isNew ? `bdb-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    departmentId,
    month,
    plannedAmount: Number(body.plannedAmount) || 0,
    actualAmount: Number(body.actualAmount) || 0,
    currency: body.currency ?? "USD",
  };
  const saved = await upsertBrandDepartmentBudget(budget);
  return NextResponse.json({ budget: saved });
}
