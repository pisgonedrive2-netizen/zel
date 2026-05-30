"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText, Plus, Loader2, RefreshCcw, Trash2, Pencil, Wallet,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { useStore } from "@/store/store";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, NumberInput, FormGrid, FormActions } from "@/components/ui/field";
import { fetchCrm } from "@/lib/crm-api";
import {
  fetchAccounting, saveInvoice, deleteAccounting,
} from "@/lib/brand-accounting-api";
import {
  INVOICE_STATUS_LABELS,
  type AccCurrency, type BrandInvoice, type InvoiceStatus,
} from "@/types/brand-accounting";
import type { CrmContact } from "@/types/crm";

const CUR_SYMBOL: Record<AccCurrency, string> = { USD: "$", EUR: "€", TRY: "₺" };
const STATUS_CLS: Record<InvoiceStatus, string> = {
  draft: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
  sent: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-300",
  paid: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  overdue: "border-red-300 bg-red-50 text-red-600 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
  cancelled: "border-zinc-300 bg-zinc-50 text-zinc-500 line-through dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-500",
};

const emptyInvoice = {
  id: "", number: "", contactId: "", title: "",
  status: "draft" as InvoiceStatus,
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "", amount: 0, taxPct: 0, currency: "USD" as AccCurrency, notes: "",
};

export default function MarkaFaturalarPage() {
  const { user, brandId, brand, canViewBrand } = useMarkaPortal();
  const [invoices, setInvoices] = useState<BrandInvoice[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyInvoice);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [acc, crm] = await Promise.all([
        fetchAccounting(brandId),
        fetchCrm(brandId).catch(() => ({ contacts: [] as CrmContact[], deals: [] })),
      ]);
      setInvoices(acc.invoices);
      setContacts(crm.contacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const contactName = useCallback((cid?: string) => contacts.find((c) => c.id === cid)?.name ?? "—", [contacts]);

  const totals = useMemo(() => {
    const withTax = (i: BrandInvoice) => i.amount * (1 + i.taxPct / 100);
    const paid = invoices.filter((i) => i.status === "paid");
    const open = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
    return {
      paid: paid.reduce((a, i) => a + withTax(i), 0),
      open: open.reduce((a, i) => a + withTax(i), 0),
    };
  }, [invoices]);

  const openNew = () => { setForm(emptyInvoice); setOpen(true); };
  const openEdit = (i: BrandInvoice) => {
    setForm({
      id: i.id, number: i.number, contactId: i.contactId ?? "", title: i.title, status: i.status,
      issueDate: i.issueDate, dueDate: i.dueDate ?? "", amount: i.amount, taxPct: i.taxPct, currency: i.currency, notes: i.notes,
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) return;
    setBusy(true);
    try {
      await saveInvoice({ ...form, id: form.id || undefined, brandId, contactId: form.contactId || undefined, dueDate: form.dueDate || undefined });
      setOpen(false);
      setForm(emptyInvoice);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (i: BrandInvoice, status: InvoiceStatus) => {
    if (!brandId) return;
    try {
      await saveInvoice({ ...i, brandId, status });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    }
  };

  const remove = async (i: BrandInvoice) => {
    if (!confirm(`${i.number || i.title} faturası silinsin mi?`)) return;
    try {
      await deleteAccounting("invoice", i.id);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <FileText size={22} /> Faturalar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{brand?.name} fatura yönetimi</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/marka/muhasebe" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <Wallet size={14} /> Muhasebe
            </Link>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openNew}><Plus size={14} /> Fatura oluştur</Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Ödenen (KDV dahil, $)</p><p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">${totals.paid.toLocaleString("tr-TR")}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Açık / bekleyen (KDV dahil, $)</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">${totals.open.toLocaleString("tr-TR")}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Fatura listesi</CardTitle>
            <CardDescription>{invoices.length} fatura</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading && invoices.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 size={22} className="mx-auto animate-spin opacity-50" /></div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <FileText size={28} className="opacity-30" />
                <p className="text-sm">Henüz fatura yok.</p>
                <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}><Plus size={14} /> İlk faturayı oluştur</Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {["No", "Başlık", "Kontak", "Tarih", "Tutar", "Durum", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id} className="border-b border-border/60 transition-colors hover:bg-accent/15">
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{i.number || "—"}</td>
                        <td className="px-3 py-3 text-foreground">{i.title || "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground">{contactName(i.contactId)}</td>
                        <td className="px-3 py-3 tabular-nums text-muted-foreground whitespace-nowrap">{i.issueDate}{i.dueDate ? ` → ${i.dueDate}` : ""}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums whitespace-nowrap">
                          {CUR_SYMBOL[i.currency]}{(i.amount * (1 + i.taxPct / 100)).toLocaleString("tr-TR")}
                          {i.taxPct > 0 && <span className="ml-1 text-[10px] text-muted-foreground">(KDV %{i.taxPct})</span>}
                        </td>
                        <td className="px-3 py-3">
                          <Select
                            value={i.status}
                            onChange={(e) => void setStatus(i, e.target.value as InvoiceStatus)}
                            className={`!py-1 text-[11px] ${STATUS_CLS[i.status]}`}
                            options={(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] }))}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(i)} aria-label="Düzenle"><Pencil size={14} /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(i)} aria-label="Sil"><Trash2 size={14} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Faturayı düzenle" : "Yeni fatura"} size="md">
        <form onSubmit={submit} className="space-y-4">
          <FormGrid>
            <Field label="Fatura no" hint="Boşsa otomatik üretilir"><Input value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} placeholder="FN-2026-0001" /></Field>
            <Field label="Başlık"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="Kontak">
              <Select value={form.contactId} onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
                options={[{ value: "", label: "—" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} />
            </Field>
            <Field label="Durum">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InvoiceStatus }))}
                options={(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] }))} />
            </Field>
            <Field label="Düzenleme tarihi"><Input type="date" value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} /></Field>
            <Field label="Vade tarihi"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
            <Field label="Tutar (KDV hariç)" required><NumberInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} min={0} /></Field>
            <Field label="KDV (%)"><NumberInput value={form.taxPct} onChange={(v) => setForm((f) => ({ ...f, taxPct: v }))} min={0} /></Field>
            <Field label="Para birimi">
              <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as AccCurrency }))}
                options={[{ value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "TRY", label: "TRY (₺)" }]} />
            </Field>
          </FormGrid>
          <Field label="Notlar"><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
          <FormActions onCancel={() => setOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
