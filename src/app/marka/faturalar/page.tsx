"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText, Plus, Loader2, RefreshCcw, Trash2, Pencil, Wallet, Download, Search,
  Send, CheckCircle2, AlertTriangle, Receipt,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, NumberInput, FormGrid, FormActions } from "@/components/ui/field";
import { downloadProfessionalCsv, numberedDetailSection, summarySection } from "@/lib/professional-csv";
import { fetchCrm } from "@/lib/crm-api";
import { fetchAccounting, saveInvoice, deleteAccounting } from "@/lib/brand-accounting-api";
import {
  INVOICE_STATUS_LABELS,
  type AccCurrency, type BrandInvoice, type InvoiceStatus,
} from "@/types/brand-accounting";
import type { CrmContact } from "@/types/crm";

const CUR_SYMBOL: Record<AccCurrency, string> = { USD: "$", EUR: "€", TRY: "₺" };
const CUR_OPTS = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "TRY", label: "TRY (₺)" },
];
const STATUS_CLS: Record<InvoiceStatus, string> = {
  draft: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
  sent: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-300",
  paid: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  overdue: "border-red-300 bg-red-50 text-red-600 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
  cancelled: "border-zinc-300 bg-zinc-50 text-zinc-500 line-through dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-500",
};

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const withTax = (i: BrandInvoice) => i.amount * (1 + i.taxPct / 100);
const daysFromToday = (date: string) =>
  Math.round((new Date(`${todayStr()}T00:00:00`).getTime() - new Date(`${date}T00:00:00`).getTime()) / 86400000);

/** Görüntüleme amaçlı: vade geçmiş + gönderildi → gecikmiş. */
const effectiveStatus = (i: BrandInvoice): InvoiceStatus =>
  i.status === "sent" && i.dueDate && i.dueDate < todayStr() ? "overdue" : i.status;

type InvoiceForm = {
  id: string;
  number: string;
  contactId: string;
  title: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  amount: number;
  taxPct: number;
  currency: AccCurrency;
  notes: string;
};

const emptyInvoice: InvoiceForm = {
  id: "", number: "", contactId: "", title: "",
  status: "draft", issueDate: todayStr(), dueDate: "",
  amount: 0, taxPct: 0, currency: "USD", notes: "",
};

export default function MarkaFaturalarPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);

  const [invoices, setInvoices] = useState<BrandInvoice[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InvoiceForm>(emptyInvoice);
  const [busy, setBusy] = useState(false);
  const [linePreview, setLinePreview] = useState("Örnek kalem: Affiliate komisyon · 1 × $500");

  const [cur, setCur] = useState<AccCurrency>("USD");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"issue" | "due">("issue");

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

  useEffect(() => { void load(); }, [load]);

  const contactName = useCallback((cid?: string) => contacts.find((c) => c.id === cid)?.name ?? "—", [contacts]);

  const currencies = useMemo(() => {
    const set = new Set<AccCurrency>();
    for (const i of invoices) set.add(i.currency);
    return [...set];
  }, [invoices]);

  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(cur)) setCur(currencies[0]);
  }, [currencies, cur]);

  // Seçili para birimi için toplamlar (KDV dahil)
  const totals = useMemo(() => {
    const scoped = invoices.filter((i) => i.currency === cur);
    const sum = (arr: BrandInvoice[]) => arr.reduce((a, i) => a + withTax(i), 0);
    const active = scoped.filter((i) => i.status !== "cancelled");
    const paid = scoped.filter((i) => i.status === "paid");
    const pending = scoped.filter((i) => (i.status === "sent" || i.status === "draft") && effectiveStatus(i) !== "overdue");
    const overdue = scoped.filter((i) => effectiveStatus(i) === "overdue");
    return {
      count: active.length,
      total: sum(active),
      paid: sum(paid),
      pending: sum(pending),
      overdue: sum(overdue),
      overdueCount: overdue.length,
    };
  }, [invoices, cur]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = invoices.filter((i) => {
      if (statusFilter !== "all" && effectiveStatus(i) !== statusFilter) return false;
      if (s && !(i.title.toLowerCase().includes(s) || i.number.toLowerCase().includes(s) || contactName(i.contactId).toLowerCase().includes(s))) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sortBy === "due") {
        const da = a.dueDate ?? "9999-12-31";
        const db = b.dueDate ?? "9999-12-31";
        return da.localeCompare(db);
      }
      return b.issueDate.localeCompare(a.issueDate);
    });
    return out;
  }, [invoices, statusFilter, q, sortBy, contactName]);

  const openNew = () => { setForm({ ...emptyInvoice, currency: cur }); setOpen(true); };
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
      await saveInvoice({ ...i, brandId, contactId: i.contactId || undefined, dueDate: i.dueDate || undefined, status });
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

  const exportCsv = () => {
    if (rows.length === 0) return;
    downloadProfessionalCsv({
      filename: `faturalar-${brand?.shortName ?? brandId}-${todayStr()}`,
      metadata: {
        Marka: brand?.name ?? "",
        "Fatura sayısı": String(rows.length),
        Olusturma: new Date().toLocaleString("tr-TR"),
      },
      sections: [
        summarySection("Özet", [
          { metric: "Aktif fatura tutarı", value: totals.total, unit: cur },
          { metric: "Ödenen", value: totals.paid, unit: cur },
          { metric: "Bekleyen", value: totals.pending, unit: cur },
          { metric: "Gecikmiş", value: totals.overdue, unit: cur },
        ], `Para birimi: ${cur}`),
        numberedDetailSection(
          "Faturalar",
          ["No", "Başlık", "Kontak", "Durum", "Düzenleme", "Vade", "Tutar (net)", "KDV %", "Tutar (KDV dahil)", "Birim"],
          rows.map((i) => [
            i.number,
            i.title,
            contactName(i.contactId),
            INVOICE_STATUS_LABELS[effectiveStatus(i)],
            i.issueDate,
            i.dueDate ?? "",
            i.amount,
            i.taxPct,
            withTax(i),
            i.currency,
          ]),
        ),
      ],
    });
  };

  const totalCards: { label: string; value: string; cls: string; icon: React.ReactNode; sub?: string }[] = [
    { label: "Toplam fatura", value: `${CUR_SYMBOL[cur]}${fmt(totals.total)}`, cls: "text-foreground", icon: <Receipt size={13} className="text-muted-foreground" />, sub: `${totals.count} aktif fatura` },
    { label: "Ödenen", value: `${CUR_SYMBOL[cur]}${fmt(totals.paid)}`, cls: "text-green-600 dark:text-green-400", icon: <CheckCircle2 size={13} className="text-green-600 dark:text-green-400" /> },
    { label: "Bekleyen", value: `${CUR_SYMBOL[cur]}${fmt(totals.pending)}`, cls: "text-amber-600 dark:text-amber-400", icon: <Send size={13} className="text-amber-600 dark:text-amber-400" /> },
    { label: "Gecikmiş", value: `${CUR_SYMBOL[cur]}${fmt(totals.overdue)}`, cls: "text-red-600 dark:text-red-400", icon: <AlertTriangle size={13} className="text-red-600 dark:text-red-400" />, sub: totals.overdueCount > 0 ? `${totals.overdueCount} fatura` : undefined },
  ];

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <FileText size={22} /> Faturalar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{brand?.name} fatura yönetimi ve vade takibi</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/marka/muhasebe" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <Wallet size={14} /> Muhasebe
            </Link>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && (
              <Button size="sm" className="gap-1.5" onClick={openNew}><Plus size={14} /> Fatura oluştur</Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {currencies.length > 1 && (
          <div className="flex justify-end">
            <Select
              value={cur}
              onChange={(e) => setCur(e.target.value as AccCurrency)}
              className="!w-auto !py-1 text-xs"
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          </div>
        )}

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {totalCards.map((c) => (
            <Card key={c.label}>
              <CardContent className="py-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.icon} {c.label}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${c.cls}`}>{c.value}</p>
                {c.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Fatura listesi</CardTitle>
            <CardDescription>{invoices.length} fatura · vadesi geçenler vurgulanır</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="No / başlık / kontak ara…" className="pl-8" />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="!w-auto"
                options={[{ value: "all", label: "Tüm durumlar" }, ...(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] }))]}
              />
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="!w-auto"
                options={[{ value: "issue", label: "Düzenleme tarihi" }, { value: "due", label: "Vade tarihi" }]}
              />
            </div>

            {loading && invoices.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 size={22} className="mx-auto animate-spin opacity-50" /></div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <FileText size={28} className="opacity-30" />
                <p className="text-sm">{invoices.length === 0 ? "Henüz fatura yok." : "Filtrelere uyan fatura yok."}</p>
                {!readOnly && invoices.length === 0 && (
                  <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}><Plus size={14} /> İlk faturayı oluştur</Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {["No", "Başlık", "Kontak", "Vade", "Tutar", "Durum", ...(readOnly ? [] : [""])].map((h, idx) => (
                      <th key={h || `act-${idx}`} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rows.map((i) => {
                      const eff = effectiveStatus(i);
                      const isOverdue = eff === "overdue";
                      const overdueDays = isOverdue && i.dueDate ? daysFromToday(i.dueDate) : 0;
                      const dueDays = !isOverdue && i.dueDate && i.status !== "paid" && i.status !== "cancelled" ? -daysFromToday(i.dueDate) : null;
                      return (
                        <tr key={i.id} className={`border-b border-border/60 transition-colors hover:bg-accent/15 ${isOverdue ? "bg-red-500/[0.04]" : ""}`}>
                          <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{i.number || "—"}</td>
                          <td className="px-3 py-3 text-foreground">{i.title || "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{contactName(i.contactId)}</td>
                          <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                            {i.dueDate ? (
                              <div className="flex flex-col">
                                <span className={isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{i.dueDate}</span>
                                {isOverdue ? (
                                  <span className="text-[10px] font-medium text-red-600 dark:text-red-400">{overdueDays} gün gecikti</span>
                                ) : dueDays != null && dueDays >= 0 ? (
                                  <span className="text-[10px] text-muted-foreground">{dueDays === 0 ? "bugün" : `${dueDays} gün kaldı`}</span>
                                ) : null}
                              </div>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3 font-semibold tabular-nums whitespace-nowrap">
                            {CUR_SYMBOL[i.currency]}{fmt(withTax(i))}
                            {i.taxPct > 0 && <span className="ml-1 text-[10px] text-muted-foreground">(KDV %{i.taxPct})</span>}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={`text-[10px] ${STATUS_CLS[eff]}`}>{INVOICE_STATUS_LABELS[eff]}</Badge>
                          </td>
                          {!readOnly && (
                            <td className="px-3 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                {i.status === "draft" && (
                                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => void setStatus(i, "sent")} title="Gönderildi olarak işaretle">
                                    <Send size={12} /> Gönder
                                  </Button>
                                )}
                                {(eff === "sent" || eff === "overdue") && (
                                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] text-green-700 dark:text-green-400" onClick={() => void setStatus(i, "paid")} title="Ödendi olarak işaretle">
                                    <CheckCircle2 size={12} /> Ödendi
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(i)} aria-label="Düzenle"><Pencil size={14} /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(i)} aria-label="Sil"><Trash2 size={14} /></Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!readOnly && (
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
                <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as AccCurrency }))} options={CUR_OPTS} />
              </Field>
            </FormGrid>
            {form.amount > 0 && (
              <p className="text-[12px] text-muted-foreground">
                KDV dahil toplam: <span className="font-medium tabular-nums text-foreground">{CUR_SYMBOL[form.currency]}{fmt(form.amount * (1 + form.taxPct / 100))}</span>
              </p>
            )}
            <Field label="Notlar"><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
            <Field label="Fatura kalemleri" hint="Kayıt sonrası kalem detayı eklenebilir (brand_invoice_lines)">
              <Input value={linePreview} onChange={(e) => setLinePreview(e.target.value)} placeholder="Açıklama · adet × birim fiyat" />
            </Field>
            <FormActions onCancel={() => setOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
          </form>
        </Modal>
      )}
    </MarkaPageGuard>
  );
}
