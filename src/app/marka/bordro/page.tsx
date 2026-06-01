"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet, Loader2, RefreshCcw, Plus, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, Clock, Download, TrendingDown, TrendingUp, Coins,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, NumberInput, FormGrid } from "@/components/ui/field";
import { fetchStaff } from "@/lib/brand-personnel-api";
import {
  fetchPayrollItems, savePayrollItem, deletePayrollItem, markStaffPayrollPaid,
} from "@/lib/brand-payroll-api";
import {
  downloadProfessionalCsv, summarySection, numberedDetailSection,
} from "@/lib/professional-csv";
import {
  STAFF_CURRENCY_SYMBOL,
  PAYROLL_ITEM_TYPE_LABELS,
  PAYROLL_DEDUCTION_TYPES,
  type BrandPayrollItem,
  type BrandStaff,
  type PayrollItemType,
  type StaffCurrency,
} from "@/types/brand-personnel";

const money = (cur: StaffCurrency, amt: number) =>
  `${STAFF_CURRENCY_SYMBOL[cur]}${Math.round(amt).toLocaleString("tr-TR")}`;

const isDeduction = (t: PayrollItemType) => (PAYROLL_DEDUCTION_TYPES as readonly string[]).includes(t);

/** Personelin sabit maaş bileşeni (kırılım yoksa monthlyCost'a düşer). */
function staffBaseComp(s: BrandStaff): number {
  const breakdown = (s.baseSalary ?? 0) + (s.rentSupport ?? 0) + (s.mealAllowance ?? 0);
  return breakdown > 0 ? breakdown : s.monthlyCost;
}

type CurrencyTotals = { gross: number; deduction: number; net: number; paid: number; pending: number };

const PAYROLL_TYPE_OPTIONS = (Object.entries(PAYROLL_ITEM_TYPE_LABELS) as [PayrollItemType, string][]).map(
  ([value, label]) => ({ value, label })
);

const emptyItemForm = {
  type: "bonus" as PayrollItemType,
  amount: 0,
  description: "",
  currency: "USD" as StaffCurrency,
};

export default function MarkaBordroPage() {
  const { user, brandId, brand, canViewBrand, isAdminView, month, navMonth, monthTitle } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);

  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [items, setItems] = useState<BrandPayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemForms, setItemForms] = useState<Record<string, typeof emptyItemForm>>({});
  const [busyStaff, setBusyStaff] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, it] = await Promise.all([
        fetchStaff(brandId),
        fetchPayrollItems(brandId, month).catch(() => [] as BrandPayrollItem[]),
      ]);
      setStaff(s);
      setItems(it);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId, month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const activeStaff = useMemo(
    () => staff.filter((s) => s.status === "active"),
    [staff]
  );

  const itemsByStaff = useMemo(() => {
    const map = new Map<string, BrandPayrollItem[]>();
    for (const it of items) {
      const arr = map.get(it.staffId);
      if (arr) arr.push(it);
      else map.set(it.staffId, [it]);
    }
    return map;
  }, [items]);

  /** Bir personelin ay özeti: brüt, kesinti, net, ödeme durumu. */
  const staffSummary = useCallback(
    (s: BrandStaff) => {
      const its = itemsByStaff.get(s.id) ?? [];
      const base = staffBaseComp(s);
      let earnings = 0;
      let deductions = 0;
      for (const it of its) {
        if (isDeduction(it.type)) deductions += it.amount;
        else earnings += it.amount;
      }
      const gross = base + earnings;
      const net = gross - deductions;
      const paidState: "paid" | "partial" | "none" =
        its.length > 0 ? (its.every((it) => it.paid) ? "paid" : "partial") : "none";
      return { base, earnings, deductions, gross, net, items: its, paidState };
    },
    [itemsByStaff]
  );

  const totals = useMemo(() => {
    const map = new Map<StaffCurrency, CurrencyTotals>();
    const ensure = (cur: StaffCurrency): CurrencyTotals => {
      let t = map.get(cur);
      if (!t) {
        t = { gross: 0, deduction: 0, net: 0, paid: 0, pending: 0 };
        map.set(cur, t);
      }
      return t;
    };
    for (const s of activeStaff) {
      const { gross, deductions, net, paidState } = staffSummary(s);
      const t = ensure(s.currency);
      t.gross += gross;
      t.deduction += deductions;
      t.net += net;
      if (paidState === "paid") t.paid += net;
      else t.pending += net;
    }
    return Array.from(map.entries());
  }, [activeStaff, staffSummary]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itemForm = (s: BrandStaff) => itemForms[s.id] ?? { ...emptyItemForm, currency: s.currency };
  const setItemForm = (id: string, patch: Partial<typeof emptyItemForm>) =>
    setItemForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyItemForm), ...patch } }));

  const addItem = async (s: BrandStaff) => {
    const f = itemForm(s);
    if (!brandId || f.amount <= 0) return;
    setBusyStaff(s.id);
    try {
      await savePayrollItem({
        brandId,
        staffId: s.id,
        month,
        type: f.type,
        amount: f.amount,
        currency: f.currency,
        description: f.description.trim(),
        paid: false,
      });
      setItemForms((prev) => ({ ...prev, [s.id]: { ...emptyItemForm, currency: s.currency } }));
      setToast("Bordro kalemi eklendi");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kalem eklenemedi");
    } finally {
      setBusyStaff(null);
    }
  };

  const toggleItemPaid = async (it: BrandPayrollItem) => {
    if (!brandId) return;
    try {
      await savePayrollItem({ ...it, paid: !it.paid });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    }
  };

  const removeItem = async (it: BrandPayrollItem) => {
    if (!confirm("Bordro kalemi silinsin mi?")) return;
    try {
      await deletePayrollItem(it.id);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  const toggleStaffPaid = async (s: BrandStaff, paid: boolean) => {
    if (!brandId) return;
    setBusyStaff(s.id);
    try {
      await markStaffPayrollPaid(brandId, s.id, month, paid);
      setToast(paid ? `${s.name} bordrosu ödendi olarak işaretlendi` : `${s.name} bordrosu beklemede`);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    } finally {
      setBusyStaff(null);
    }
  };

  const exportCsv = () => {
    const detailRows = activeStaff.map((s) => {
      const sum = staffSummary(s);
      return [
        s.name,
        s.role || "—",
        s.currency,
        Math.round(sum.base),
        Math.round(sum.earnings),
        Math.round(sum.deductions),
        Math.round(sum.net),
        sum.paidState === "paid" ? "Ödendi" : sum.paidState === "partial" ? "Kısmi" : "Bekliyor",
      ];
    });
    const summaryRows = totals.flatMap(([cur, t]) => [
      { metric: `Toplam brüt (${cur})`, value: Math.round(t.gross), unit: cur },
      { metric: `Toplam kesinti (${cur})`, value: Math.round(t.deduction), unit: cur },
      { metric: `Toplam net (${cur})`, value: Math.round(t.net), unit: cur },
      { metric: `Ödenen (${cur})`, value: Math.round(t.paid), unit: cur },
      { metric: `Bekleyen (${cur})`, value: Math.round(t.pending), unit: cur },
    ]);
    downloadProfessionalCsv({
      filename: `bordro_${brand?.name ?? brandId}_${month}.csv`,
      metadata: {
        Marka: brand?.name ?? brandId ?? "",
        Ay: monthTitle,
        "Aktif personel": String(activeStaff.length),
        Olusturma: new Date().toLocaleString("tr-TR"),
      },
      sections: [
        summarySection("Para birimine göre toplamlar", summaryRows),
        numberedDetailSection(
          "Personel bordrosu",
          ["Ad", "Rol", "Birim", "Baz", "Kazanç", "Kesinti", "Net", "Durum"],
          detailRows,
        ),
      ],
    });
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Wallet size={22} /> Bordro
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand?.name} · {monthTitle} · {activeStaff.length} aktif personel
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={activeStaff.length === 0}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
          </div>
        </div>

        <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />

        {toast && (
          <div className="rounded-lg border border-emerald-500/45 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">{toast}</div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {/* Para birimi bazlı toplamlar */}
        {totals.length > 0 && (
          <div className="space-y-3">
            {totals.map(([cur, t]) => (
              <div key={cur} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard icon={<Coins size={18} />} tone="primary" label={`Toplam brüt (${cur})`} value={money(cur, t.gross)} />
                <KpiCard icon={<TrendingDown size={18} />} tone="red" label={`Toplam kesinti (${cur})`} value={money(cur, t.deduction)} />
                <KpiCard icon={<TrendingUp size={18} />} tone="green" label={`Toplam net (${cur})`} value={money(cur, t.net)} />
                <KpiCard
                  icon={<CheckCircle2 size={18} />}
                  tone="amber"
                  label={`Ödenen / bekleyen (${cur})`}
                  value={money(cur, t.paid)}
                  sub={`Bekleyen: ${money(cur, t.pending)}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Personel listesi */}
        {loading && staff.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 size={22} className="mx-auto animate-spin opacity-50" />
              <p className="mt-2 text-sm">Yükleniyor…</p>
            </CardContent>
          </Card>
        ) : activeStaff.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Wallet size={28} className="opacity-30" />
              <p className="text-sm">Bu markada aktif personel yok. Bordro için önce personel ekleyin.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeStaff.map((s) => {
              const sum = staffSummary(s);
              const open = expanded.has(s.id);
              const f = itemForm(s);
              return (
                <Card key={s.id}>
                  <CardContent className="p-0">
                    {/* Satır başlığı */}
                    <button
                      onClick={() => toggleExpand(s.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                      aria-expanded={open}
                    >
                      {open ? <ChevronDown size={16} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {s.avatar || s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{s.name}</p>
                        {s.role && <p className="truncate text-xs text-muted-foreground">{s.role}</p>}
                      </div>
                      <div className="hidden shrink-0 gap-5 text-right text-xs sm:flex">
                        <Metric label="Baz" value={money(s.currency, sum.base)} />
                        <Metric label="Kazanç" value={money(s.currency, sum.earnings)} tone={sum.earnings > 0 ? "green" : undefined} />
                        <Metric label="Kesinti" value={money(s.currency, sum.deductions)} tone={sum.deductions > 0 ? "red" : undefined} />
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-muted-foreground">Net</p>
                        <p className="font-bold tabular-nums text-foreground">{money(s.currency, sum.net)}</p>
                      </div>
                      <PaidBadge state={sum.paidState} />
                    </button>

                    {/* Detay */}
                    {open && (
                      <div className="border-t border-border/60 px-4 py-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {monthTitle} bordro kalemleri ({sum.items.length})
                          </p>
                          {!readOnly && sum.items.length > 0 && (
                            <Button
                              size="sm"
                              variant={sum.paidState === "paid" ? "outline" : "default"}
                              className="h-7 gap-1.5"
                              disabled={busyStaff === s.id}
                              onClick={() => void toggleStaffPaid(s, sum.paidState !== "paid")}
                            >
                              {sum.paidState === "paid" ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                              {sum.paidState === "paid" ? "Beklemeye al" : "Ödendi işaretle"}
                            </Button>
                          )}
                        </div>

                        {/* Maaş bileşeni satırı */}
                        <div className="mb-2 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                          <span className="text-muted-foreground">Sabit maaş bileşeni</span>
                          <span className="font-medium tabular-nums">{money(s.currency, sum.base)}</span>
                        </div>

                        {sum.items.length === 0 ? (
                          <p className="py-2 text-center text-xs text-muted-foreground">Bu ay için ek kalem yok.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {sum.items.map((it) => {
                              const ded = isDeduction(it.type);
                              return (
                                <div key={it.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                                  <Badge variant="outline" className="shrink-0 text-[10px]">{PAYROLL_ITEM_TYPE_LABELS[it.type]}</Badge>
                                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{it.description || "—"}</span>
                                  <span className={`shrink-0 font-medium tabular-nums ${ded ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                                    {ded ? "−" : "+"}{money(it.currency, it.amount)}
                                  </span>
                                  {readOnly ? (
                                    <span className="shrink-0">
                                      {it.paid ? <CheckCircle2 size={15} className="text-green-600" /> : <Clock size={15} className="text-muted-foreground" />}
                                    </span>
                                  ) : (
                                    <>
                                      <button onClick={() => void toggleItemPaid(it)} className="shrink-0" title={it.paid ? "Ödendi (geri al)" : "Ödendi işaretle"}>
                                        {it.paid ? <CheckCircle2 size={15} className="text-green-600" /> : <Clock size={15} className="text-muted-foreground hover:text-foreground" />}
                                      </button>
                                      <button onClick={() => void removeItem(it)} className="shrink-0 text-red-600 hover:text-red-700 dark:text-red-400" title="Sil">
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Kalem ekleme formu */}
                        {!readOnly && (
                          <form
                            onSubmit={(e) => { e.preventDefault(); void addItem(s); }}
                            className="mt-3 rounded-md border border-dashed border-border p-3"
                          >
                            <FormGrid>
                              <Field label="Tür">
                                <Select
                                  value={f.type}
                                  onChange={(e) => setItemForm(s.id, { type: e.target.value as PayrollItemType })}
                                  options={PAYROLL_TYPE_OPTIONS}
                                />
                              </Field>
                              <Field label="Tutar">
                                <NumberInput value={f.amount} onChange={(v) => setItemForm(s.id, { amount: v })} min={0} />
                              </Field>
                              <Field label="Para birimi">
                                <Select
                                  value={f.currency}
                                  onChange={(e) => setItemForm(s.id, { currency: e.target.value as StaffCurrency })}
                                  options={[{ value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "TRY", label: "TRY (₺)" }]}
                                />
                              </Field>
                              <Field label="Açıklama">
                                <Input value={f.description} onChange={(e) => setItemForm(s.id, { description: e.target.value })} placeholder="Ör. Performans primi" />
                              </Field>
                            </FormGrid>
                            <div className="mt-2 flex justify-end">
                              <Button type="submit" size="sm" className="gap-1.5" disabled={busyStaff === s.id || f.amount <= 0}>
                                <Plus size={13} /> Kalem ekle
                              </Button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MarkaPageGuard>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const cls = tone === "green" ? "text-green-700 dark:text-green-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "text-foreground";
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function PaidBadge({ state }: { state: "paid" | "partial" | "none" }) {
  if (state === "paid")
    return <Badge variant="outline" className="shrink-0 border-green-300 bg-green-50 text-[10px] text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300">Ödendi</Badge>;
  if (state === "partial")
    return <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300">Kısmi</Badge>;
  return <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">Bekliyor</Badge>;
}

function KpiCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "red" | "amber" | "primary";
}) {
  const toneCls: Record<string, string> = {
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneCls[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums">{value}</p>
          {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
