import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess, resolveBrandId, accessibleBrandIds, hasOrgCapability, writeAudit,
} from "@/lib/org-access";
import {
  fetchLedger, fetchInvoices, upsertLedgerEntry, upsertInvoice,
  deleteLedgerEntry, deleteInvoice, countInvoicesForBrand,
} from "@/lib/db/brand-accounting-repo";
import type {
  AccCurrency, BrandInvoice, BrandLedgerEntry, InvoiceStatus, LedgerDirection,
} from "@/types/brand-accounting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCY: readonly AccCurrency[] = ["USD", "EUR", "TRY"];
const DIRECTION: readonly LedgerDirection[] = ["income", "expense"];
const INVOICE_STATUS: readonly InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}
function scopeIds(session: Awaited<ReturnType<typeof getSession>>, requested?: string): string[] {
  if (!session) return [];
  if (session.role === "brand") return requested ? [requested] : accessibleBrandIds(session);
  return requested ? [requested] : [];
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ ledger: [], invoices: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "Muhasebe görüntüleme yetkisi yok" }, { status: 403 });
  }
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const ids = scopeIds(session, requested);
  try {
    const [ledger, invoices] = await Promise.all([fetchLedger(ids), fetchInvoices(ids)]);
    return NextResponse.json({ ledger, invoices });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Muhasebe verisi alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "Muhasebe yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> & { kind?: string }) | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  try {
    if (body.kind === "invoice") {
      const isNew = !(typeof body.id === "string" && /^inv-/.test(body.id as string));
      let number = String(body.number ?? "").trim();
      if (isNew && !number) {
        const n = (await countInvoicesForBrand(brandId)) + 1;
        number = `FN-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
      }
      const invoice: BrandInvoice = {
        id: isNew ? `inv-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
        brandId,
        number,
        contactId: String(body.contactId ?? "").trim() || undefined,
        title: String(body.title ?? ""),
        status: pick(body.status, INVOICE_STATUS, "draft"),
        issueDate: String(body.issueDate ?? "").trim() || today,
        dueDate: String(body.dueDate ?? "").trim() || undefined,
        amount: Math.max(0, Number(body.amount) || 0),
        taxPct: Math.max(0, Number(body.taxPct) || 0),
        currency: pick(body.currency, CURRENCY, "USD"),
        notes: String(body.notes ?? ""),
        createdAt: (body.createdAt as string) ?? now,
        updatedAt: now,
      };
      const saved = await upsertInvoice(invoice);
      await writeAudit(session, isNew ? "brand_invoice_created" : "brand_invoice_updated", `invoice=${saved.id} brand=${brandId} status=${saved.status}`);
      return NextResponse.json({ invoice: saved });
    }

    // default: ledger entry
    const isNew = !(typeof body.id === "string" && /^le-/.test(body.id as string));
    const entry: BrandLedgerEntry = {
      id: isNew ? `le-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
      brandId,
      entryDate: String(body.entryDate ?? "").trim() || today,
      direction: pick(body.direction, DIRECTION, "expense"),
      category: String(body.category ?? "general").trim() || "general",
      description: String(body.description ?? ""),
      amount: Math.max(0, Number(body.amount) || 0),
      currency: pick(body.currency, CURRENCY, "USD"),
      source: "manual",
      refId: undefined,
      createdBy: session.userId,
      createdAt: (body.createdAt as string) ?? now,
      updatedAt: now,
    };
    const saved = await upsertLedgerEntry(entry);
    await writeAudit(session, isNew ? "brand_ledger_created" : "brand_ledger_updated", `entry=${saved.id} brand=${brandId} ${saved.direction} ${saved.amount}`);
    return NextResponse.json({ entry: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "finance")) {
    return NextResponse.json({ error: "Silme yetkisi yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "ledger";
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    if (kind === "invoice") await deleteInvoice(id);
    else await deleteLedgerEntry(id);
    await writeAudit(session, kind === "invoice" ? "brand_invoice_deleted" : "brand_ledger_deleted", `id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silme başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
