import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId, writeAudit } from "@/lib/org-access";
import {
  fetchBrandOperators,
  findBrandOperatorById,
  upsertBrandOperator,
} from "@/lib/db/brand-igaming-repo";
import type { BrandOperator } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = ["active", "paused", "closed"] as const;
const CURRENCY = ["USD", "EUR", "TRY"] as const;

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ operators: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  try {
    const operators = await fetchBrandOperators(brandId);
    return NextResponse.json({ ok: true, operators });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Operatörler yüklenemedi" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandOperator> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bop-"));
  const operator: BrandOperator = {
    id: isNew ? `bop-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    name: String(body.name ?? "").trim() || "Operatör",
    apiBaseUrl: body.apiBaseUrl?.trim() || undefined,
    currency: CURRENCY.includes(body.currency as typeof CURRENCY[number]) ? body.currency! : "USD",
    status: STATUS.includes(body.status as typeof STATUS[number]) ? body.status! : "active",
    notes: body.notes ?? "",
  };
  try {
    const saved = await upsertBrandOperator(operator);
    await writeAudit(session, isNew ? "brand_operator_created" : "brand_operator_updated", `operator=${saved.id}`);
    return NextResponse.json({ operator: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kaydedilemedi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandOperator> & { id?: string } | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const existing = await findBrandOperatorById(id);
  if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  const guard = ensureBrandAccess(session, existing.brandId, "write");
  if (guard) return guard;
  const saved = await upsertBrandOperator({ ...existing, ...body, id, brandId: existing.brandId });
  return NextResponse.json({ operator: saved });
}
