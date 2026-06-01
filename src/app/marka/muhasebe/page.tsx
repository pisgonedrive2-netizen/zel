"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet, Plus, Loader2, RefreshCcw, Trash2, Pencil, ArrowDownCircle, ArrowUpCircle,
  Zap, FileText, Download, Search, TrendingUp, TrendingDown,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, NumberInput, FormGrid, FormActions } from "@/components/ui/field";
import { downloadProfessionalCsv, numberedDetailSection, summarySection } from "@/lib/professional-csv";
import {
  fetchAccounting, saveLedgerEntry, deleteAccounting, syncAccounting,
} from "@/lib/brand-accounting-api";
import {
  LEDGER_SOURCE_LABELS, LEDGER_EXPENSE_CATEGORIES, LEDGER_INCOME_CATEGORIES,
  type AccCurrency, type BrandLedgerEntry, type LedgerDirection,
} from "@/types/brand-accounting";

const CUR_SYMBOL: Record<AccCurrency, string> = { USD: "$", EUR: "€", TRY: "₺" };
const CUR_OPTS = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "TRY", label: "TRY (₺)" },
];
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
const ym = (d: string) => d.slice(0, 7);

type EntryForm = {
  id: string;
  entryDate: string;
  direction: LedgerDirection;
  category: string;
  description: string;
  amount: number;
  currency: AccCurrency;
};

const emptyEntry: EntryForm = {
  id: "",
  entryDate: new Date().toISOString().slice(0, 10),
  direction: "expense",
  category: "",
  description: "",
  amount: 0,
  currency: "USD",
};

export default function MarkaMuhasebePage() {
  const { user, brandId, brand, month, navMonth, monthTitle, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);

  const [ledger, setLedger] = useState<BrandLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EntryForm>(emptyEntry);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // P&L analiz kontrolleri
  const [cur, setCur] = useState<AccCurrency>("USD");
  const [scope, setScope] = useState<"month" | "all">("month");

  // Tablo filtreleri
  const [q, setQ] = useState("");
  const [dirFilter, setDirFilter] = useState<"all" | "income" | "expense">("all");
  const [catFilter, setCatFilter] = useState("all");
  const [monthOnly, setMonthOnly] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccounting(brandId);
      setLedger(data.ledger);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Mevcut para birimleri; seçili birim listede yoksa ilkine geç.
  const currencies = useMemo(() => {
    const set = new Set<AccCurrency>();
    for (const e of ledger) set.add(e.currency);
    return [...set];
  }, [ledger]);

  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(cur)) setCur(currencies[0]);
  }, [currencies, cur]);

  // Kategori filtre seçenekleri
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of ledger) if (e.category) set.add(e.category);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [ledger]);

  // Seçili kapsam + para birimi için P&L
  const pnl = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCat: Record<string, number> = {};
    for (const e of ledger) {
      if (e.currency !== cur) continue;
      if (scope === "month" && ym(e.entryDate) !== month) continue;
      if (e.direction === "income") {
        income += e.amount;
      } else {
        expense += e.amount;
        byCat[e.category || "Diğer"] = (byCat[e.category || "Diğer"] ?? 0) + e.amount;
      }
    }
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    return { income, expense, net: income - expense, cats };
  }, [ledger, cur, scope, month]);

  // Son 6 ay trendi (seçili para birimi)
  const trend = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const data = months.map((mm) => {
      let income = 0;
      let expense = 0;
      for (const e of ledger) {
        if (e.currency !== cur || ym(e.entryDate) !== mm) continue;
        if (e.direction === "income") income += e.amount;
        else expense += e.amount;
      }
      return { mm, income, expense };
    });
    const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
    return { data, max };
  }, [ledger, cur, month]);

  // Tablo satırları
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ledger.filter((e) => {
      if (monthOnly && ym(e.entryDate) !== month) return false;
      if (dirFilter !== "all" && e.direction !== dirFilter) return false;
      if (catFilter !== "all" && e.category !== catFilter) return false;
      if (s && !(e.description.toLowerCase().includes(s) || e.category.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [ledger, monthOnly, dirFilter, catFilter, q, month]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || form.amount <= 0) return;
    setBusy(true);
    try {
      await saveLedgerEntry({ ...form, id: form.id || undefined, brandId });
      setOpen(false);
      setForm(emptyEntry);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => { setForm({ ...emptyEntry, currency: cur }); setOpen(true); };
  const openEdit = (e: BrandLedgerEntry) => {
    setForm({
      id: e.id, entryDate: e.entryDate, direction: e.direction, category: e.category,
      description: e.description, amount: e.amount, currency: e.currency,
    });
    setOpen(true);
  };

  const remove = async (entry: BrandLedgerEntry) => {
    if (entry.source !== "manual") {
      if (!confirm("Otomatik oluşturulmuş kayıt. Yine de silinsin mi? (Tekrar senkronla ile geri gelir)")) return;
    } else if (!confirm("Bu kayıt silinsin mi?")) {
      return;
    }
    try {
      await deleteAccounting("ledger", entry.id);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  const runSync = async () => {
    if (!brandId) return;
    setSyncing(true);
    try {
      const r = await syncAccounting(brandId);
      setToast(`Senkronizasyon: ${r.inserted} yeni kayıt eklendi (${r.candidates} aday).`);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Senkronizasyon başarısız");
    } finally {
      setSyncing(false);
    }
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const income = rows.reduce((a, e) => (e.direction === "income" ? a + e.amount : a), 0);
    const expense = rows.reduce((a, e) => (e.direction === "expense" ? a + e.amount : a), 0);
    downloadProfessionalCsv({
      filename: `muhasebe-${brand?.shortName ?? brandId}-${monthOnly ? month : "tum"}`,
      metadata: {
        Marka: brand?.name ?? "",
        Kapsam: monthOnly ? monthTitle : "Tüm zamanlar",
        "Kayıt sayısı": String(rows.length),
        Olusturma: new Date().toLocaleString("tr-TR"),
      },
      sections: [
        summarySection("Özet", [
          { metric: "Toplam gelir", value: income },
          { metric: "Toplam gider", value: expense },
          { metric: "Net", value: income - expense },
        ]),
        numberedDetailSection(
          "Defter hareketleri",
          ["Tarih", "Yön", "Kategori", "Açıklama", "Kaynak", "Tutar", "Birim"],
          rows.map((e) => [
            e.entryDate,
            e.direction === "income" ? "Gelir" : "Gider",
            e.category,
            e.description,
            LEDGER_SOURCE_LABELS[e.source],
            e.amount,
            e.currency,
          ]),
        ),
      ],
    });
  };

  const catOptions = form.direction === "income" ? LEDGER_INCOME_CATEGORIES : LEDGER_EXPENSE_CATEGORIES;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Wallet size={22} /> Muhasebe
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{brand?.name} gelir/gider defteri ve kâr-zarar</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marka/faturalar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <FileText size={14} /> Faturalar
            </Link>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={13} /> CSV
            </Button>
            {!readOnly && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void runSync()} disabled={syncing}>
                {syncing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Otomatik içe aktar
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && (
              <Button size="sm" className="gap-1.5" onClick={openNew}>
                <Plus size={14} /> Kayıt ekle
              </Button>
            )}
          </div>
        </div>

        <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />

        {toast && (
          <div className="rounded-lg border border-emerald-500/45 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">{toast}</div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {/* P&L analiz başlığı + kontroller */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScope("month")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${scope === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {monthTitle}
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${scope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Tüm zamanlar
            </button>
          </div>
          {currencies.length > 1 && (
            <Select
              value={cur}
              onChange={(e) => setCur(e.target.value as AccCurrency)}
              className="!w-auto !py-1 text-xs"
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          )}
        </div>

        {/* P&L kartları */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowUpCircle size={13} className="text-green-600 dark:text-green-400" /> Toplam Gelir</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-green-600 dark:text-green-400">{CUR_SYMBOL[cur]}{fmt(pnl.income)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowDownCircle size={13} className="text-red-600 dark:text-red-400" /> Toplam Gider</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{CUR_SYMBOL[cur]}{fmt(pnl.expense)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Net (Kâr / Zarar)</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${pnl.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {pnl.net < 0 ? "−" : ""}{CUR_SYMBOL[cur]}{fmt(Math.abs(pnl.net))}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Kategori kırılımı + trend */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Gider kategorisi kırılımı</CardTitle>
              <CardDescription>{scope === "month" ? monthTitle : "Tüm zamanlar"} · {cur}</CardDescription>
            </CardHeader>
            <CardContent>
              {pnl.cats.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Bu kapsamda gider yok.</p>
              ) : (
                <div className="space-y-2.5">
                  {pnl.cats.slice(0, 8).map(([cat, amt]) => {
                    const pct = pnl.expense > 0 ? (amt / pnl.expense) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-foreground">{cat}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {CUR_SYMBOL[cur]}{fmt(amt)} · %{pct.toFixed(0)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-red-500/70 dark:bg-red-400/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Gelir / gider trendi</CardTitle>
              <CardDescription>Son 6 ay · {cur}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 pt-2" style={{ height: 130 }}>
                {trend.data.map((d) => (
                  <div key={d.mm} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-[96px] w-full items-end justify-center gap-0.5">
                      <div
                        className="w-2.5 rounded-t bg-green-500/70 dark:bg-green-400/70"
                        style={{ height: `${(d.income / trend.max) * 100}%` }}
                        title={`Gelir: ${CUR_SYMBOL[cur]}${fmt(d.income)}`}
                      />
                      <div
                        className="w-2.5 rounded-t bg-red-500/70 dark:bg-red-400/70"
                        style={{ height: `${(d.expense / trend.max) * 100}%` }}
                        title={`Gider: ${CUR_SYMBOL[cur]}${fmt(d.expense)}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.mm.slice(5)}/{d.mm.slice(2, 4)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><TrendingUp size={11} className="text-green-600 dark:text-green-400" /> Gelir</span>
                <span className="flex items-center gap-1"><TrendingDown size={11} className="text-red-600 dark:text-red-400" /> Gider</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Defter tablosu */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Defter</CardTitle>
            <CardDescription>
              Manuel girişler + affiliate ödeme, kazanılan CRM anlaşması ve personel maliyeti otomatik beslemesi
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Filtreler */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Açıklama / kategori ara…" className="pl-8" />
              </div>
              <Select
                value={dirFilter}
                onChange={(e) => setDirFilter(e.target.value as typeof dirFilter)}
                className="!w-auto"
                options={[{ value: "all", label: "Tüm yönler" }, { value: "income", label: "Gelir" }, { value: "expense", label: "Gider" }]}
              />
              <Select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="!w-auto max-w-[200px]"
                options={[{ value: "all", label: "Tüm kategoriler" }, ...allCategories.map((c) => ({ value: c, label: c }))]}
              />
              <button
                type="button"
                onClick={() => setMonthOnly((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${monthOnly ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                Sadece {monthTitle}
              </button>
            </div>

            {loading && ledger.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 size={22} className="mx-auto animate-spin opacity-50" /></div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Wallet size={28} className="opacity-30" />
                <p className="text-sm">
                  {ledger.length === 0 ? "Defter boş. Manuel kayıt ekleyin veya otomatik içe aktarın." : "Filtrelere uyan kayıt yok."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {["Tarih", "Açıklama", "Kategori", "Kaynak", "Tutar", ...(readOnly ? [] : [""])].map((h, idx) => (
                      <th key={h || `act-${idx}`} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="border-b border-border/60 transition-colors hover:bg-accent/15">
                        <td className="px-3 py-3 tabular-nums text-muted-foreground whitespace-nowrap">{e.entryDate}</td>
                        <td className="px-3 py-3 text-foreground">{e.description || "—"}</td>
                        <td className="px-3 py-3"><Badge variant="outline" className="text-[10px]">{e.category || "—"}</Badge></td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{LEDGER_SOURCE_LABELS[e.source]}</td>
                        <td className={`px-3 py-3 font-semibold tabular-nums whitespace-nowrap ${e.direction === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {e.direction === "income" ? "+" : "−"}{CUR_SYMBOL[e.currency]}{fmt(e.amount)}
                        </td>
                        {!readOnly && (
                          <td className="px-3 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {e.source === "manual" && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)} aria-label="Düzenle"><Pencil size={14} /></Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(e)} aria-label="Sil">
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!readOnly && (
        <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Defter kaydını düzenle" : "Defter kaydı"} size="md">
          <form onSubmit={submit} className="space-y-4">
            <FormGrid>
              <Field label="Tarih"><Input type="date" value={form.entryDate} onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))} /></Field>
              <Field label="Yön">
                <Select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as LedgerDirection }))}
                  options={[{ value: "expense", label: "Gider" }, { value: "income", label: "Gelir" }]} />
              </Field>
              <Field label="Kategori" hint="Listeden seçin veya kendi kategorinizi yazın">
                <Input list="ledger-cat-list" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="ör. Affiliate ödeme — CPA" />
              </Field>
              <Field label="Tutar" required><NumberInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} min={0} /></Field>
              <Field label="Para birimi">
                <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as AccCurrency }))} options={CUR_OPTS} />
              </Field>
            </FormGrid>
            <datalist id="ledger-cat-list">
              {catOptions.map((c) => <option key={c} value={c} />)}
            </datalist>
            <Field label="Açıklama"><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></Field>
            <FormActions onCancel={() => setOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
          </form>
        </Modal>
      )}
    </MarkaPageGuard>
  );
}
