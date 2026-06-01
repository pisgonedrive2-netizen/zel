"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ListChecks,
  Search,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useStore, type PlannedItem, type PlannedItemPayment } from "@/store/store";
import { brandLinkedExpenses, sumBrandLinkedExpenses } from "@/lib/brand-expenses";
import { fmt } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";

// ─── helpers ──────────────────────────────────────────────────────────────
function monthLabel(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
}

function monthShort(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", {
    month: "short",
    year: "2-digit",
  });
}

/** Bir taksitin etkin vade tarihi (yoksa ayın ilk günü). */
function effDue(p: PlannedItemPayment): string {
  return p.dueDate ?? p.month + "-01";
}

/** YYYY-MM + n ay → YYYY-MM */
function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m - 1) + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** İki ISO tarih (YYYY-MM-DD) arası gün farkı (to - from). */
function dayDiff(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00");
  const b = new Date(toIso + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

type DerivedStatus = "paid" | "pending" | "overdue" | "cancelled";

function derivedStatus(p: PlannedItemPayment, todayIso: string): DerivedStatus {
  if (p.status === "paid") return "paid";
  if (p.status === "cancelled") return "cancelled";
  return effDue(p) < todayIso ? "overdue" : "pending";
}

interface InstallmentRow {
  installment: PlannedItemPayment;
  parent: PlannedItem;
}

function statusInfo(status: DerivedStatus): {
  label: string;
  cls: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
} {
  switch (status) {
    case "paid":
      return {
        label: "Ödendi",
        cls: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/45 dark:bg-emerald-950/40",
        icon: CheckCircle2,
      };
    case "overdue":
      return {
        label: "Gecikmiş",
        cls: "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
        icon: AlertTriangle,
      };
    case "cancelled":
      return {
        label: "İptal",
        cls: "text-muted-foreground border-border bg-muted/30",
        icon: AlertCircle,
      };
    default:
      return {
        label: "Bekliyor",
        cls: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
        icon: Clock,
      };
  }
}

type StatusFilter = "all" | "paid" | "pending" | "overdue";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "pending", label: "Bekleyen" },
  { key: "overdue", label: "Gecikmiş" },
  { key: "paid", label: "Ödenen" },
];

export default function MarkaOdemelerPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle, todayYm } = portal;
  const { plannedItems, plannedItemPayments, expenses } = useStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const myPlannedItems = useMemo(
    () => plannedItems.filter((p) => p.brandId === brandId),
    [plannedItems, brandId]
  );

  const myInstallments: InstallmentRow[] = useMemo(() => {
    const parents = new Map(myPlannedItems.map((p) => [p.id, p]));
    return plannedItemPayments
      .filter((pay) => parents.has(pay.plannedItemId))
      .map((pay) => ({ installment: pay, parent: parents.get(pay.plannedItemId)! }))
      .sort((a, b) => effDue(a.installment).localeCompare(effDue(b.installment)));
  }, [plannedItemPayments, myPlannedItems]);

  // ─── KPI hesapları ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let planned = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;
    let dueThisMonth = 0;
    for (const { installment: p } of myInstallments) {
      const st = derivedStatus(p, todayIso);
      if (st === "cancelled") continue;
      planned += p.amount;
      if (st === "paid") paid += p.amount;
      if (st === "pending") pending += p.amount;
      if (st === "overdue") overdue += p.amount;
      if (p.month === month && st !== "paid") dueThisMonth += p.amount;
    }
    return { planned, paid, pending, overdue, dueThisMonth };
  }, [myInstallments, todayIso, month]);

  // ─── Nakit akışı projeksiyonu (önümüzdeki 6 ay) ────────────────────────────
  const cashflow = useMemo(() => {
    const base = todayYm || month;
    const months = Array.from({ length: 6 }, (_, i) => addMonths(base, i));
    const buckets = months.map((ym) => {
      let total = 0;
      let count = 0;
      for (const { installment: p } of myInstallments) {
        if (p.status !== "pending") continue;
        if (p.month === ym) {
          total += p.amount;
          count += 1;
        }
      }
      return { ym, total, count };
    });
    const max = buckets.reduce((m, b) => Math.max(m, b.total), 0);
    return { buckets, max };
  }, [myInstallments, todayYm, month]);

  // ─── Vade takvimi: yaklaşan/gecikmiş ödemeler, aya göre grupla ─────────────
  const timeline = useMemo(() => {
    const open = myInstallments.filter(
      (r) => derivedStatus(r.installment, todayIso) !== "paid" &&
        derivedStatus(r.installment, todayIso) !== "cancelled"
    );
    const groups = new Map<string, InstallmentRow[]>();
    for (const r of open) {
      const key = r.installment.month;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, rows]) => ({
        ym,
        rows: rows.sort((a, b) => effDue(a.installment).localeCompare(effDue(b.installment))),
      }));
  }, [myInstallments, todayIso]);

  // ─── Taksit ilerlemesi (çok taksitli kalemler) ─────────────────────────────
  const progressItems = useMemo(() => {
    return myPlannedItems
      .map((item) => {
        const pays = myInstallments.filter((r) => r.parent.id === item.id).map((r) => r.installment);
        const total = pays.length;
        const paidCount = pays.filter((p) => p.status === "paid").length;
        const paidAmount = pays.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
        const totalAmount = pays.filter((p) => p.status !== "cancelled").reduce((s, p) => s + p.amount, 0);
        return { item, total, paidCount, paidAmount, totalAmount };
      })
      .filter((x) => x.total > 1)
      .sort((a, b) => b.total - a.total);
  }, [myPlannedItems, myInstallments]);

  // ─── Liste: filtrelenmiş taksitler ─────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const set = new Set(myInstallments.map((r) => r.installment.month));
    return [...set].sort();
  }, [myInstallments]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myInstallments.filter((r) => {
      const st = derivedStatus(r.installment, todayIso);
      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (monthFilter !== "all" && r.installment.month !== monthFilter) return false;
      if (q) {
        const hay = `${r.parent.name} ${r.parent.category} ${r.installment.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [myInstallments, statusFilter, monthFilter, search, todayIso]);

  // ─── Marka giderleri (bilgilendirme) ───────────────────────────────────────
  const monthBrandExpenses = useMemo(
    () => brandLinkedExpenses(expenses, brandId, month),
    [expenses, brandId, month]
  );
  const monthBrandExpenseTotal = useMemo(
    () => sumBrandLinkedExpenses(expenses, brandId, month),
    [expenses, brandId, month]
  );

  const hasData = myInstallments.length > 0 || myPlannedItems.length > 0;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
        <div className="mx-auto max-w-[1100px] space-y-5 pb-8">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo brandId={brand.id} title={brand.name} size={40} className="rounded-lg" />
              <div>
                <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Wallet size={18} /> {brand.name} · Ödeme planı
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Planlanan ödemeler, taksitler ve nakit akışı projeksiyonu.
                </p>
              </div>
            </div>
          </div>

          <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />

          {!hasData ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <Wallet size={28} className="text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Henüz planlanmış ödeme yok</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Yönetici bu markaya planlı gider veya taksit eklediğinde ödeme planınız ve nakit
                  akışı projeksiyonu burada görünecek.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KpiTile label="Toplam plan" value={fmtBrandMoney(kpis.planned, "USD")} accent="text-foreground" />
                <KpiTile
                  label="Ödenen"
                  value={fmtBrandMoney(kpis.paid, "USD")}
                  accent="text-emerald-700 dark:text-emerald-300"
                />
                <KpiTile
                  label="Bekleyen"
                  value={fmtBrandMoney(kpis.pending, "USD")}
                  accent="text-amber-700 dark:text-amber-300"
                />
                <KpiTile
                  label="Gecikmiş"
                  value={fmtBrandMoney(kpis.overdue, "USD")}
                  accent="text-red-600 dark:text-red-400"
                />
                <KpiTile
                  label="Bu ay ödenecek"
                  value={fmtBrandMoney(kpis.dueThisMonth, "USD")}
                  accent="text-blue-700 dark:text-blue-300"
                />
              </div>

              {/* Nakit akışı projeksiyonu */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown size={15} className="text-blue-700 dark:text-blue-300" />
                    Nakit akışı projeksiyonu
                  </CardTitle>
                  <CardDescription>
                    Önümüzdeki 6 ay için bekleyen taksit çıkışları
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cashflow.max === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Önümüzdeki 6 ay için bekleyen taksit yok.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {cashflow.buckets.map((b) => {
                        const pct = cashflow.max > 0 ? (b.total / cashflow.max) * 100 : 0;
                        return (
                          <div key={b.ym} className="flex items-center gap-3 text-sm">
                            <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
                              {monthShort(b.ym)}
                            </span>
                            <div className="flex-1 h-6 rounded-md bg-muted/50 overflow-hidden relative">
                              <div
                                className="h-full rounded-md bg-blue-500/70 dark:bg-blue-500/55 transition-all"
                                style={{ width: `${Math.max(pct, b.total > 0 ? 3 : 0)}%` }}
                              />
                            </div>
                            <span className="w-24 shrink-0 text-right tabular-nums font-medium text-foreground">
                              {b.total > 0 ? fmtBrandMoney(b.total, "USD") : "—"}
                            </span>
                            <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                              {b.count > 0 ? `${b.count} taksit` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vade takvimi / zaman çizelgesi */}
              <Card className="border-emerald-200/60 dark:border-emerald-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarIcon size={15} className="text-emerald-700 dark:text-emerald-300" />
                    Vade takvimi
                  </CardTitle>
                  <CardDescription>
                    Açık (ödenmemiş) taksitler — vadeye göre sıralı, gecikmiş kayıtlar kırmızı
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Açık taksit bulunmuyor — tüm ödemeler tamamlanmış.
                    </p>
                  ) : (
                    timeline.map((g) => (
                      <div key={g.ym} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {monthLabel(g.ym)}
                          </p>
                          {g.ym === month && (
                            <Badge variant="outline" className="text-[9px] text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40">
                              Bu ay
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                            {fmtBrandMoney(
                              g.rows.reduce((s, r) => s + r.installment.amount, 0),
                              "USD"
                            )}
                          </span>
                        </div>
                        {g.rows.map((r) => {
                          const st = derivedStatus(r.installment, todayIso);
                          const info = statusInfo(st);
                          const due = effDue(r.installment);
                          const diff = dayDiff(todayIso, due);
                          const overdue = st === "overdue";
                          return (
                            <div
                              key={r.installment.id}
                              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                                overdue
                                  ? "border-red-300/70 bg-red-50/60 dark:border-red-500/40 dark:bg-red-950/20"
                                  : "border-border bg-card"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{r.parent.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Vade: {due}
                                  {" · "}
                                  {overdue ? (
                                    <span className="text-red-600 dark:text-red-400 font-medium">
                                      {Math.abs(diff)} gün gecikti
                                    </span>
                                  ) : diff === 0 ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">bugün</span>
                                  ) : (
                                    <span>{diff} gün kaldı</span>
                                  )}
                                  {r.installment.notes ? ` · ${r.installment.notes}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-[10px] ${info.cls}`}>
                                  <info.icon size={10} className="mr-1" />
                                  {info.label}
                                </Badge>
                                <span className="font-semibold tabular-nums">
                                  {fmtBrandMoney(r.installment.amount, "USD")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Taksit ilerlemesi */}
              {progressItems.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ListChecks size={15} className="text-muted-foreground" />
                      Taksit ilerlemesi
                    </CardTitle>
                    <CardDescription>Çok taksitli kalemlerde ödenen / toplam taksit</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {progressItems.map(({ item, total, paidCount, paidAmount, totalAmount }) => {
                      const pct = total > 0 ? (paidCount / total) * 100 : 0;
                      return (
                        <div key={item.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-foreground truncate">{item.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {paidCount}/{total} taksit · {fmtBrandMoney(paidAmount, "USD")} /{" "}
                              {fmtBrandMoney(totalAmount, "USD")}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500/80 dark:bg-emerald-500/60 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Bu ayki giderler (bilgi) */}
              {monthBrandExpenses.length > 0 && (
                <Card className="border-red-200/60 dark:border-red-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Bu ayki giderler</CardTitle>
                    <CardDescription>
                      Yönetici tarafından markanıza atanmış genel giderler — {monthTitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">
                      Toplam: {fmt(monthBrandExpenseTotal)}
                    </p>
                    <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {monthBrandExpenses.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm bg-card"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{e.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.date} · {e.category}
                            </p>
                          </div>
                          <span className="tabular-nums font-medium text-red-600 dark:text-red-400 shrink-0">
                            {fmt(e.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Tüm taksitler — filtreli liste */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Tüm taksitler</CardTitle>
                  <CardDescription>
                    {filteredRows.length} / {myInstallments.length} taksit · {brand.shortName}
                  </CardDescription>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
                      {STATUS_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setStatusFilter(f.key)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            statusFilter === f.key
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="all">Tüm aylar</option>
                      {monthOptions.map((m) => (
                        <option key={m} value={m}>
                          {monthLabel(m)}
                        </option>
                      ))}
                    </select>
                    <div className="relative ml-auto w-full sm:w-56">
                      <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Plan veya not ara…"
                        className="pl-8"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filteredRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Seçilen filtrelere uyan taksit bulunamadı.
                    </p>
                  ) : (
                    filteredRows.map((r) => {
                      const st = derivedStatus(r.installment, todayIso);
                      const info = statusInfo(st);
                      return (
                        <div
                          key={r.installment.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                            st === "overdue"
                              ? "border-red-300/70 bg-red-50/50 dark:border-red-500/40 dark:bg-red-950/20"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{r.parent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.parent.category}
                              {r.installment.dueDate ? ` · Vade: ${r.installment.dueDate}` : ` · ${monthLabel(r.installment.month)}`}
                              {r.installment.paidDate ? ` · Ödendi: ${r.installment.paidDate}` : ""}
                            </p>
                            {r.installment.notes && (
                              <p className="text-xs text-muted-foreground italic mt-0.5">
                                {r.installment.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${info.cls}`}>
                              <info.icon size={10} className="mr-1" />
                              {info.label}
                            </Badge>
                            <span className="font-semibold tabular-nums">
                              {fmtBrandMoney(r.installment.amount, "USD")}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Tüm planlı kalemler */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tüm planlı kalemler</CardTitle>
                  <CardDescription>
                    Bu markaya bağlı planlı bütçeler — {myPlannedItems.length} kayıt
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {myPlannedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Henüz planlı kalem yok. Yönetici planlanan giderlere markayı eklemediyse boş kalır.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                            <th className="pb-2 pr-3 font-medium">Plan</th>
                            <th className="pb-2 pr-3 font-medium">Kategori</th>
                            <th className="pb-2 pr-3 font-medium">Vade hedefi</th>
                            <th className="pb-2 pr-3 font-medium text-right">Bütçe</th>
                            <th className="pb-2 pr-3 font-medium text-right">Harcanan</th>
                            <th className="pb-2 font-medium">Durum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myPlannedItems.map((p) => {
                            const pct = p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0;
                            return (
                              <tr key={p.id} className="border-b border-border/50 hover:bg-accent/20">
                                <td className="py-2 pr-3 font-medium text-foreground">{p.name}</td>
                                <td className="py-2 pr-3 text-xs text-muted-foreground">{p.category}</td>
                                <td className="py-2 pr-3 text-xs text-muted-foreground">
                                  {p.targetDate || "—"}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {fmtBrandMoney(p.budget, "USD")}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-300">
                                  {fmtBrandMoney(p.spent, "USD")}
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    ({pct.toFixed(0)}%)
                                  </span>
                                </td>
                                <td className="py-2 text-xs">
                                  <Badge variant="outline" className="text-[10px]">
                                    {p.status}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </MarkaPageGuard>
  );
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}
