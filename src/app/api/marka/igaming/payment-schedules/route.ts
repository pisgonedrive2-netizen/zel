import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import {
  fetchBrandPaymentSchedules,
  upsertBrandPaymentSchedule,
} from "@/lib/db/brand-igaming-repo";
import type { BrandPaymentSchedule } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ schedules: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  const schedules = await fetchBrandPaymentSchedules(brandId);
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandPaymentSchedule> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const dueDate = String(body.dueDate ?? "").trim();
  if (!dueDate) return NextResponse.json({ error: "dueDate gerekli" }, { status: 400 });
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bps-"));
  const schedule: BrandPaymentSchedule = {
    id: isNew ? `bps-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    dealId: body.dealId || undefined,
    dueDate,
    amountUsd: Number(body.amountUsd) || 0,
    status: body.status ?? "scheduled",
    notes: body.notes ?? "",
  };
  const saved = await upsertBrandPaymentSchedule(schedule);
  return NextResponse.json({ schedule: saved });
}
