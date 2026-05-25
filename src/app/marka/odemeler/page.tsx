"use client";

import { useMemo } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Wallet,
} from "lucide-react";
import { useStore, type PlannedItem, type PlannedItemPayment } from "@/store/store";
import { brandLinkedExpenses, sumBrandLinkedExpenses } from "@/lib/brand-expenses";
import { fmt } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";

function monthLabel(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
}

interface InstallmentRow {
  installment: PlannedItemPayment;
  parent: PlannedItem;
}

function statusInfo(status: PlannedItemPayment["status"]): {
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

export default function MarkaOdemelerPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle } = portal;
  const { plannedItems, plannedItemPayments, expenses } = useStore();

  const myPlannedItems = useMemo(
    () => plannedItems.filter((p) => p.brandId === brandId),
    [plannedItems, brandId]
  );
  const myInstallments: InstallmentRow[] = useMemo(() => {
    const parents = new Map(myPlannedItems.map((p) => [p.id, p]));
    return plannedItemPayments
      .filter((pay) => parents.has(pay.plannedItemId))
      .map((pay) => ({ installment: pay, parent: parents.get(pay.plannedItemId)! }))
      .sort((a, b) => {
        const da = a.installment.dueDate ?? a.installment.month + "-01";
        const db = b.installment.dueDate ?? b.installment.month + "-01";
        return da.localeCompare(db);
      });
  }, [plannedItemPayments, myPlannedItems]);

  const monthRows = useMemo(
    () => myInstallments.filter((r) => r.installment.month === month),
    [myInstallments, month]
  );
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return myInstallments
      .filter(
        (r) =>
          r.installment.status === "pending" &&
          (r.installment.dueDate ?? r.installment.month + "-01") >= today
      )
      .slice(0, 5);
  }, [myInstallments]);

  const totalPlanned = myPlannedItems.reduce((s, p) => s + p.budget, 0);
  const totalSpent = myPlannedItems.reduce((s, p) => s + p.spent, 0);
  const totalPaid = myInstallments
    .filter((r) => r.installment.status === "paid")
    .reduce((s, r) => s + r.installment.amount, 0);
  const totalPending = myInstallments
    .filter((r) => r.installment.status === "pending")
    .reduce((s, r) => s + r.installment.amount, 0);

  const monthBrandExpenses = useMemo(
    () => brandLinkedExpenses(expenses, brandId, month),
    [expenses, brandId, month]
  );
  const monthBrandExpenseTotal = useMemo(
    () => sumBrandLinkedExpenses(expenses, brandId, month),
    [expenses, brandId, month]
  );

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
              Planlanan ödemeler — taksitler, geçmiş ve yaklaşanlar.
            </p>
          </div>
        </div>
      </div>

      <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Toplam plan"
          value={fmtBrandMoney(totalPlanned, "USD")}
          accent="text-foreground"
        />
        <KpiTile
          label="Ödenmiş"
          value={fmtBrandMoney(totalPaid, "USD")}
          accent="text-emerald-700 dark:text-emerald-300"
        />
        <KpiTile
          label="Bekleyen"
          value={fmtBrandMoney(totalPending, "USD")}
          accent="text-amber-700 dark:text-amber-300"
        />
        <KpiTile
          label="Harcanan"
          value={fmtBrandMoney(totalSpent, "USD")}
          accent="text-blue-700 dark:text-blue-300"
        />
      </div>

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

      {upcoming.length > 0 && (
        <Card className="border-emerald-200/60 dark:border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon size={15} className="text-emerald-700 dark:text-emerald-300" />
              Yaklaşan ödemeler
            </CardTitle>
            <CardDescription>Sıradaki taksitler — ilk 5 kayıt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((r) => {
              const info = statusInfo(r.installment.status);
              return (
                <div
                  key={r.installment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.parent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.installment.dueDate
                        ? `Vade: ${r.installment.dueDate}`
                        : `Ay: ${monthLabel(r.installment.month)}`}
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{monthTitle} ödeme detayı</CardTitle>
          <CardDescription>
            {monthRows.length} taksit · {brand.shortName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {monthRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Bu ay için planlanmış taksit yok.
            </p>
          ) : (
            monthRows.map((r) => {
              const info = statusInfo(r.installment.status);
              return (
                <div
                  key={r.installment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.parent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.parent.category}
                      {r.installment.dueDate ? ` · Vade: ${r.installment.dueDate}` : ""}
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
                    const pct =
                      p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/50 hover:bg-accent/20"
                      >
                        <td className="py-2 pr-3 font-medium text-foreground">{p.name}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {p.category}
                        </td>
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
