import type { BrandInvoice, BrandLedgerEntry } from "@/types/brand-accounting";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${fallback} (${res.status})`);
  return data;
}

export async function fetchAccounting(
  brandId?: string
): Promise<{ ledger: BrandLedgerEntry[]; invoices: BrandInvoice[] }> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`/api/marka/muhasebe${qs}`, { credentials: "include", cache: "no-store" });
  return jsonOrThrow<{ ledger: BrandLedgerEntry[]; invoices: BrandInvoice[] }>(res, "Muhasebe verisi alınamadı");
}

export async function saveLedgerEntry(input: Partial<BrandLedgerEntry>): Promise<BrandLedgerEntry> {
  const res = await fetch("/api/marka/muhasebe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "ledger" }),
  });
  const data = await jsonOrThrow<{ entry: BrandLedgerEntry }>(res, "Kayıt kaydedilemedi");
  return data.entry;
}

export async function saveInvoice(input: Partial<BrandInvoice>): Promise<BrandInvoice> {
  const res = await fetch("/api/marka/muhasebe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "invoice" }),
  });
  const data = await jsonOrThrow<{ invoice: BrandInvoice }>(res, "Fatura kaydedilemedi");
  return data.invoice;
}

export async function deleteAccounting(kind: "ledger" | "invoice", id: string): Promise<void> {
  const res = await fetch(`/api/marka/muhasebe?kind=${kind}&id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Silme başarısız");
}

export async function syncAccounting(
  brandId?: string
): Promise<{ candidates: number; inserted: number }> {
  const res = await fetch("/api/marka/muhasebe/sync", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId }),
  });
  return jsonOrThrow<{ candidates: number; inserted: number }>(res, "Senkronizasyon başarısız");
}
