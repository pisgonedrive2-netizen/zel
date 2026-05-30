import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AccCurrency, BrandInvoice, BrandLedgerEntry, InvoiceStatus, LedgerDirection, LedgerSource,
} from "@/types/brand-accounting";

const str = (v: unknown, d = ""): string => (v == null ? d : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

const CURRENCY: readonly AccCurrency[] = ["USD", "EUR", "TRY"];
const DIRECTION: readonly LedgerDirection[] = ["income", "expense"];
const SOURCE: readonly LedgerSource[] = ["manual", "affiliate_payout", "crm_deal", "staff_cost", "invoice"];
const INVOICE_STATUS: readonly InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];

// ── Ledger ───────────────────────────────────────────────────────────────
function ledgerFromRow(r: Record<string, unknown>): BrandLedgerEntry {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    entryDate: str(r.entry_date),
    direction: pick(r.direction, DIRECTION, "expense"),
    category: str(r.category, "general"),
    description: str(r.description),
    amount: num(r.amount),
    currency: pick(r.currency, CURRENCY, "USD"),
    source: pick(r.source, SOURCE, "manual"),
    refId: r.ref_id ? str(r.ref_id) : undefined,
    createdBy: r.created_by ? str(r.created_by) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function ledgerToRow(e: BrandLedgerEntry) {
  return {
    id: e.id,
    brand_id: e.brandId,
    entry_date: e.entryDate,
    direction: e.direction,
    category: e.category,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    source: e.source,
    ref_id: e.refId ?? null,
    created_by: e.createdBy ?? null,
  };
}

export async function fetchLedger(brandIds: string[]): Promise<BrandLedgerEntry[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_ledger_entries").select("*").in("brand_id", brandIds).order("entry_date", { ascending: false });
  if (error) throw new Error(`brand_ledger_entries: ${error.message}`);
  return (data ?? []).map((r) => ledgerFromRow(r as Record<string, unknown>));
}

export async function upsertLedgerEntry(e: BrandLedgerEntry): Promise<BrandLedgerEntry> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_ledger_entries").upsert(ledgerToRow(e), { onConflict: "id" }).select("*").maybeSingle();
  if (error) throw new Error(`brand_ledger_entries: ${error.message}`);
  if (!data) throw new Error("brand_ledger_entries: upsert sonuç dönmedi.");
  return ledgerFromRow(data as Record<string, unknown>);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(`brand_ledger_entries: ${error.message}`);
}

/** Otomatik kaynak girişlerini ekler; (brand,source,ref) tekil olduğu için tekrarlar yoksayılır. */
export async function insertAutoLedgerEntries(entries: BrandLedgerEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const { data, error } = await getSupabaseAdmin()
    .from("brand_ledger_entries")
    .upsert(entries.map(ledgerToRow), { onConflict: "brand_id,source,ref_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`brand_ledger_entries(auto): ${error.message}`);
  return (data ?? []).length;
}

// ── Invoices ─────────────────────────────────────────────────────────────
function invoiceFromRow(r: Record<string, unknown>): BrandInvoice {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    number: str(r.number),
    contactId: r.contact_id ? str(r.contact_id) : undefined,
    title: str(r.title),
    status: pick(r.status, INVOICE_STATUS, "draft"),
    issueDate: str(r.issue_date),
    dueDate: r.due_date ? str(r.due_date) : undefined,
    amount: num(r.amount),
    taxPct: num(r.tax_pct),
    currency: pick(r.currency, CURRENCY, "USD"),
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function invoiceToRow(i: BrandInvoice) {
  return {
    id: i.id,
    brand_id: i.brandId,
    number: i.number,
    contact_id: i.contactId ?? null,
    title: i.title,
    status: i.status,
    issue_date: i.issueDate,
    due_date: i.dueDate ?? null,
    amount: i.amount,
    tax_pct: i.taxPct,
    currency: i.currency,
    notes: i.notes,
  };
}

export async function fetchInvoices(brandIds: string[]): Promise<BrandInvoice[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_invoices").select("*").in("brand_id", brandIds).order("issue_date", { ascending: false });
  if (error) throw new Error(`brand_invoices: ${error.message}`);
  return (data ?? []).map((r) => invoiceFromRow(r as Record<string, unknown>));
}

export async function upsertInvoice(i: BrandInvoice): Promise<BrandInvoice> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_invoices").upsert(invoiceToRow(i), { onConflict: "id" }).select("*").maybeSingle();
  if (error) throw new Error(`brand_invoices: ${error.message}`);
  if (!data) throw new Error("brand_invoices: upsert sonuç dönmedi.");
  return invoiceFromRow(data as Record<string, unknown>);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_invoices").delete().eq("id", id);
  if (error) throw new Error(`brand_invoices: ${error.message}`);
}

export async function countInvoicesForBrand(brandId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("brand_invoices").select("id", { count: "exact", head: true }).eq("brand_id", brandId);
  if (error) throw new Error(`brand_invoices count: ${error.message}`);
  return count ?? 0;
}
