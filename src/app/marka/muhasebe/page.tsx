"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet, Plus, Loader2, RefreshCcw, Trash2, ArrowDownCircle, ArrowUpCircle, Zap, FileText,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, NumberInput, FormGrid, FormActions } from "@/components/ui/field";
import {
  fetchAccounting, saveLedgerEntry, deleteAccounting, syncAccounting,
} from "@/lib/brand-accounting-api";
import {
  LEDGER_SOURCE_LABELS,
  type AccCurrency, type BrandLedgerEntry, type LedgerDirection,
} from "@/types/brand-accounting";

const CUR_SYMBOL: Record<AccCurrency, string> = { USD: "$", EUR: "€", TRY: "₺" };

const emptyEntry = {
  entryDate: new Date().toISOString().slice(0, 10),
  direction: "expense" as LedgerDirection,
  category: "general",
  description: "",
  amount: 0,
  currency: "USD" as AccCurrency,
};

export default function MarkaMuhasebePage() {
  const { user, brandId, brand, canViewBrand } = useMarkaPortal();
  const [ledger, setLedger] = useState<BrandLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEntry);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const balances = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    for (const e of ledger) {
      const m = (map[e.currency] ??= { income: 0, expense: 0 });
      if (e.direction === "income") m.income += e.amount;
      else m.expense += e.amount;
    }
    return map;
  }, [ledger]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || form.amount <= 0) return;
    setBusy(true);
    try {
      await saveLedgerEntry({ brandId, ...form });
      setOpen(false);
      setForm(emptyEntry);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: BrandLedgerEntry) => {
    if (entry.source !== "manual") {
      if (!confirm("Otomatik oluşturulmuş kayıt. Yine de silinsin mi? (Tekrar senkronla ile geri gelir)")) return;
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

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Wallet size={22} /> Muhasebe
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{brand?.name} gelir/gider defteri ve bakiye</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marka/faturalar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <FileText size={14} /> Faturalar
            </Link>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void runSync()} disabled={syncing}>
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Otomatik içe aktar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyEntry); setOpen(true); }}>
              <Plus size={14} /> Kayıt ekle
            </Button>
          </div>
        </div>

        {toast && (
          <div className="rounded-lg border border-emerald-500/45 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">{toast}</div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {/* Bakiye kartları */}
        {Object.keys(balances).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(balances) as [AccCurrency, { income: number; expense: number }][]).map(([cur, b]) => {
              const net = b.income - b.expense;
              return (
                <Card key={cur}>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">Bakiye ({cur})</p>
                    <p className={`text-xl font-bold tabular-nums ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {CUR_SYMBOL[cur]}{net.toLocaleString("tr-TR")}
                    </p>
                    <div className="mt-1.5 flex gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><ArrowUpCircle size={11} /> {CUR_SYMBOL[cur]}{b.income.toLocaleString("tr-TR")}</span>
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><ArrowDownCircle size={11} /> {CUR_SYMBOL[cur]}{b.expense.toLocaleString("tr-TR")}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Defter</CardTitle>
            <CardDescription>
              Manuel girişler + affiliate ödeme, kazanılan CRM anlaşması ve personel maliyeti otomatik beslemesi
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading && ledger.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 size={22} className="mx-auto animate-spin opacity-50" /></div>
            ) : ledger.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Wallet size={28} className="opacity-30" />
                <p className="text-sm">Defter boş. Manuel kayıt ekleyin veya otomatik içe aktarın.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {["Tarih", "Açıklama", "Kategori", "Kaynak", "Tutar", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {ledger.map((e) => (
                      <tr key={e.id} className="border-b border-border/60 transition-colors hover:bg-accent/15">
                        <td className="px-3 py-3 tabular-nums text-muted-foreground whitespace-nowrap">{e.entryDate}</td>
                        <td className="px-3 py-3 text-foreground">{e.description || "—"}</td>
                        <td className="px-3 py-3"><Badge variant="outline" className="text-[10px]">{e.category}</Badge></td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{LEDGER_SOURCE_LABELS[e.source]}</td>
                        <td className={`px-3 py-3 font-semibold tabular-nums whitespace-nowrap ${e.direction === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {e.direction === "income" ? "+" : "−"}{CUR_SYMBOL[e.currency]}{e.amount.toLocaleString("tr-TR")}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(e)} aria-label="Sil">
                            <Trash2 size={14} />
                          </Button>
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

      <Modal open={open} onClose={() => setOpen(false)} title="Defter kaydı" size="md">
        <form onSubmit={submit} className="space-y-4">
          <FormGrid>
            <Field label="Tarih"><Input type="date" value={form.entryDate} onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))} /></Field>
            <Field label="Yön">
              <Select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as LedgerDirection }))}
                options={[{ value: "expense", label: "Gider" }, { value: "income", label: "Gelir" }]} />
            </Field>
            <Field label="Kategori"><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="general, reklam, ekipman…" /></Field>
            <Field label="Tutar" required><NumberInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} min={0} /></Field>
            <Field label="Para birimi">
              <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as AccCurrency }))}
                options={[{ value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "TRY", label: "TRY (₺)" }]} />
            </Field>
          </FormGrid>
          <Field label="Açıklama"><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></Field>
          <FormActions onCancel={() => setOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
