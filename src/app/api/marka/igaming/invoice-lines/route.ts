import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import {
  fetchBrandInvoiceLines,
  upsertBrandInvoiceLine,
} from "@/lib/db/brand-igaming-repo";
import type { BrandInvoiceLine } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ lines: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const invoiceId = req.nextUrl.searchParams.get("invoiceId")?.trim() ?? "";
  if (!invoiceId) return NextResponse.json({ error: "invoiceId gerekli" }, { status: 400 });
  const lines = await fetchBrandInvoiceLines(invoiceId);
  return NextResponse.json({ lines });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandInvoiceLine> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const invoiceId = String(body.invoiceId ?? "").trim();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId gerekli" }, { status: 400 });
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bil-"));
  const line: BrandInvoiceLine = {
    id: isNew ? `bil-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    invoiceId,
    description: body.description ?? "",
    quantity: Number(body.quantity) || 1,
    unitPrice: Number(body.unitPrice) || 0,
    refType: body.refType || undefined,
    refId: body.refId || undefined,
    sortOrder: Number(body.sortOrder) || 0,
  };
  const saved = await upsertBrandInvoiceLine(line);
  return NextResponse.json({ line: saved });
}
