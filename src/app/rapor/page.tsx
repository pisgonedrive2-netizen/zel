"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import {
  useStore, calcNetPayable, calcCarryForward, calcOpenAdvanceBalance, isPayrollActive, getRentForMonth,
  sumApprovedContentExpenses, plannedPayrollPlusApprovedContent,
  totalCashOutPaidForMonth,
} from "@/store/store";
import { fmt, shiftCalendarMonthYm, toDateLocal, toYearMonthLocal } from "@/lib/data";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MonthlyExportMenu } from "@/components/monthly-export-menu";
import {
  exportSalaryMonthCsv,
  exportSalaryMonthPdf,
  listAvailableMonths,
  monthLabelTr,
  type SalaryReportRow,
} from "@/lib/monthly-exports";

// ── Helpers ───────────────────────────────────────────────────────────────

function prevMonth(m: string) {
  return shiftCalendarMonthYm(m, -1);
}
function nextMonth(m: string) {
  return shiftCalendarMonthYm(m, 1);
}
const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
}
function shortWallet(addr: string) {
  if (!addr || addr.length < 10) return addr || "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

type ReportRow = SalaryReportRow & { id: string };

// ── Wallet Copy Button ────────────────────────────────────────────────────

function WalletCell({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  if (!address) return <span className="text-muted-foreground text-xs italic">Adres yok</span>;

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            className={cn(
              "flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors group",
              props.className
            )}
            onClick={(e) => {
              copy();
              props.onClick?.(e);
            }}
          >
            <span>{shortWallet(address)}</span>
            {copied ? (
              <Check size={11} className="text-green-400 shrink-0" />
            ) : (
              <Copy size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        )}
      />
      <TooltipContent className="font-mono text-xs max-w-xs break-all">{address}</TooltipContent>
    </Tooltip>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function RaporPage() {
  const { employees, advances, salaryExtras, paymentStatuses, contentExpenses, setPaymentStatus } = useStore();
  const { user } = useAuth();
  const readOnly = useIsReadOnly();
  const [month, setMonth] = useState(() => toYearMonthLocal(new Date()));

  const availableMonths = useMemo(
    () => listAvailableMonths([
      ...advances.map((a) => a.month + "-01"),
      ...salaryExtras.map((s) => s.month + "-01"),
      ...paymentStatuses.map((p) => p.month + "-01"),
      month + "-01",
    ]),
    [advances, salaryExtras, paymentStatuses, month]
  );

  // Bordrolu: koordinatör hariç, aktif çalışanlar VE bu ay için bordro penceresinde olanlar
  const buildRowsForMonth = (ym: string): ReportRow[] => {
    const eligible = employees.filter((e) => e.kind !== "coordinator" && isPayrollActive(e, ym));
    return eligible.map((emp) => {
      const empAdvances  = advances.filter((a) => a.employeeId === emp.id && a.month === ym);
      const empExtras    = salaryExtras.filter((e) => e.employeeId === emp.id && e.month === ym);
      const thisMonthAdv = empAdvances.reduce((s, a) => s + a.amount, 0);
      const carryFwd     = calcCarryForward(emp.id, ym, advances, paymentStatuses);
      const rentAmt      = getRentForMonth(emp, ym, salaryExtras);
      const totalBonus   = empExtras
        .filter((e) => e.type !== "deduction" && e.type !== "rent")
        .reduce((s, e) => s + e.amount, 0);
      const totalDeduc   = empExtras.filter((e) => e.type === "deduction").reduce((s, e) => s + e.amount, 0);
      const netPayable   = calcNetPayable(emp, ym, advances, salaryExtras, paymentStatuses);
      const contentAprv  = sumApprovedContentExpenses(contentExpenses, emp.id, ym);
      const plannedOut   = plannedPayrollPlusApprovedContent(emp, ym, advances, salaryExtras, paymentStatuses, contentExpenses);
      const paidOut      = totalCashOutPaidForMonth(emp, ym, advances, salaryExtras, paymentStatuses, contentExpenses);
      const status       = paymentStatuses.find((p) => p.employeeId === emp.id && p.month === ym);
      const openAdvAfter = calcOpenAdvanceBalance(emp, ym, salaryExtras);

      return {
        id:               emp.id,
        name:             emp.name,
        role:             emp.role,
        department:       emp.department,
        paymentDay:       emp.paymentDay,
        baseSalary:       emp.baseSalary,
        rentSupport:      rentAmt,
        carryForward:     carryFwd,
        thisMonthAdvance: thisMonthAdv,
        openAdvanceAfter: openAdvAfter,
        totalBonus,
        totalDeduction:   totalDeduc,
        netPayable,
        contentApproved:  contentAprv,
        plannedTotalOut:  plannedOut,
        totalPaidOut:     paidOut,
        paid:             status?.paid ?? false,
        paidDate:         status?.paidDate,
        walletAddress:    emp.walletAddress,
      };
    });
  };

  const rows: ReportRow[] = buildRowsForMonth(month);

  const totalNet    = rows.reduce((s, r) => s + r.netPayable, 0);
  const totalBase   = rows.reduce((s, r) => s + r.baseSalary, 0);
  const totalRent   = rows.reduce((s, r) => s + r.rentSupport, 0);
  const totalCarry  = rows.reduce((s, r) => s + r.carryForward, 0);
  const totalOpenAdv = rows.reduce((s, r) => s + r.openAdvanceAfter, 0);
  const paidCount   = rows.filter((r) => r.paid).length;
  const totalContentAprv = rows.reduce((s, r) => s + r.contentApproved, 0);
  const totalPlanned  = rows.reduce((s, r) => s + r.plannedTotalOut, 0);
  const totalPaidOut  = rows.reduce((s, r) => s + r.totalPaidOut, 0);

  const exportReport = (ym: string, kind: "pdf" | "csv") => {
    const exportRows = buildRowsForMonth(ym);
    if (exportRows.length === 0) {
      const go = window.confirm(
        `${monthLabelTr(ym)} için bordrolu çalışan yok.\n\nYine de boş rapor indirmek ister misiniz?`,
      );
      if (!go) return;
    }
    if (kind === "pdf") {
      exportSalaryMonthPdf(exportRows, ym, { generatedBy: user?.name });
    } else {
      exportSalaryMonthCsv(exportRows, ym);
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ödeme Raporu</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aylık maaş özeti · Avans devir · Cüzdan adresleri · Dışa aktarım
          </p>
        </div>
        <MonthlyExportMenu
          month={month}
          availableMonths={availableMonths}
          label="Aylık rapor"
          onExportPdf={(ym) => exportReport(ym, "pdf")}
          onExportCsv={(ym) => exportReport(ym, "csv")}
        />
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setMonth(prevMonth(month))}
            className="px-2 py-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-4 py-1.5 text-sm font-medium text-foreground min-w-[140px] text-center border-x border-border">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(nextMonth(month))}
            className="px-2 py-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Temel Maaş",      value: fmt(totalBase),                   color: "text-foreground" },
          { label: "Kira Desteği",    value: fmt(totalRent),                   color: totalRent > 0 ? "text-blue-600" : "text-muted-foreground" },
          { label: "İçerik (onaylı)", value: fmt(totalContentAprv),            color: totalContentAprv > 0 ? "text-violet-600" : "text-muted-foreground" },
          { label: "Plan Toplamı",    value: fmt(totalPlanned),                sub: "Net maaş + onaylı içerik",       color: "text-foreground font-bold" },
          { label: "Ödenen Toplam",   value: fmt(totalPaidOut),                sub: "İşaretli maaş + ödenen içerik", color: "text-green-700 font-bold" },
          { label: "Net Ödenecek",    value: fmt(totalNet),                    color: "text-foreground" },
          { label: "Açık Avans (Ay Sonu)", value: fmt(totalOpenAdv),           color: totalOpenAdv > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: "Ödeme Durumu",    value: `${paidCount} / ${rows.length}`,  color: paidCount === rows.length && rows.length > 0 ? "text-green-600" : "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs mb-1">{k.label}</p>
            <p className={`text-xl tabular-nums ${k.color}`}>{k.value}</p>
            {"sub" in k && k.sub ? (
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{k.sub}</p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Çalışan Ödeme Detayları</p>
          <Badge variant="outline" className="text-xs">{monthLabel(month)}</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  "Çalışan", "Gün", "Temel maaş", "Kira", "Devir Avans", "Bu Ay Avans", "Açık Bakiye",
                  "Prim", "Kesinti", "Net ödenecek", "İçerik (onay)", "Plan toplam", "Ödenen toplam", "Cüzdan", "Durum"
                ].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground whitespace-nowrap">{row.name}</p>
                    <p className="text-muted-foreground text-xs">{row.role}</p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{row.paymentDay}</td>
                  <td className="px-3 py-3 tabular-nums text-foreground whitespace-nowrap">{fmt(row.baseSalary)}</td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {row.rentSupport > 0 ? <span className="text-blue-600">+{fmt(row.rentSupport)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {row.carryForward > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-amber-600 font-medium">−{fmt(row.carryForward)}</span>
                        </TooltipTrigger>
                        <TooltipContent>Önceki aylardan ödenmemiş avans devri</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {row.thisMonthAdvance > 0 ? <span className="text-orange-600">−{fmt(row.thisMonthAdvance)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {row.openAdvanceAfter > 0 ? <span className="text-amber-600 font-medium">{fmt(row.openAdvanceAfter)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {row.totalBonus > 0 ? <span className="text-green-600">+{fmt(row.totalBonus)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {row.totalDeduction > 0 ? <span className="text-red-600">−{fmt(row.totalDeduction)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`tabular-nums font-semibold text-base ${row.paid ? "text-green-600" : "text-foreground"}`}>
                      {fmt(row.netPayable)}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {row.contentApproved > 0 ? <span className="text-violet-600">+{fmt(row.contentApproved)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium whitespace-nowrap">{fmt(row.plannedTotalOut)}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-green-700 whitespace-nowrap">{fmt(row.totalPaidOut)}</td>
                  <td className="px-3 py-3"><WalletCell address={row.walletAddress} /></td>
                  <td className="px-3 py-3">
                    {readOnly ? (
                      <Badge
                        variant={row.paid ? "default" : "outline"}
                        className={row.paid
                          ? "bg-green-500/15 text-green-700 border-green-500/30 whitespace-nowrap"
                          : "text-amber-700 border-amber-500/40 whitespace-nowrap"}
                        aria-label={row.paid ? "Ödendi" : "Bekliyor"}
                      >
                        {row.paid ? `Ödendi · ${row.paidDate ?? ""}` : "Bekliyor"}
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPaymentStatus(row.id, month, !row.paid, !row.paid ? toDateLocal(new Date()) : undefined)}
                        className="whitespace-nowrap"
                        aria-label={row.paid ? "Ödemeyi geri al" : "Ödendi olarak işaretle"}
                      >
                        <Badge
                          variant={row.paid ? "default" : "outline"}
                          className={row.paid
                            ? "bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/25 cursor-pointer"
                            : "text-amber-700 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"}
                        >
                          {row.paid ? `Ödendi · ${row.paidDate ?? ""}` : "Bekliyor"}
                        </Badge>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Bu ay için bordrolu çalışan yok. Çalışanın "Bordro Başlangıç Ayı" bu aydan büyük olabilir.
                  </td>
                </tr>
              )}
            </tbody>

            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide" colSpan={2}>TOPLAM</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-foreground">{fmt(totalBase)}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-blue-600">{totalRent > 0 ? `+${fmt(totalRent)}` : "—"}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-amber-600">{totalCarry > 0 ? `−${fmt(totalCarry)}` : "—"}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-orange-600">
                    {rows.reduce((s, r) => s + r.thisMonthAdvance, 0) > 0
                      ? `−${fmt(rows.reduce((s, r) => s + r.thisMonthAdvance, 0))}` : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-amber-600">
                    {totalOpenAdv > 0 ? fmt(totalOpenAdv) : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-green-600">
                    {rows.reduce((s, r) => s + r.totalBonus, 0) > 0
                      ? `+${fmt(rows.reduce((s, r) => s + r.totalBonus, 0))}` : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-red-600">
                    {rows.reduce((s, r) => s + r.totalDeduction, 0) > 0
                      ? `−${fmt(rows.reduce((s, r) => s + r.totalDeduction, 0))}` : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-bold text-lg text-foreground">{fmt(totalNet)}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-violet-600">
                    {totalContentAprv > 0 ? `+${fmt(totalContentAprv)}` : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-bold text-foreground">{fmt(totalPlanned)}</td>
                  <td className="px-3 py-3 tabular-nums font-bold text-green-700 dark:text-green-400">{fmt(totalPaidOut)}</td>
                  <td colSpan={2} className="px-3 py-3 text-xs text-muted-foreground">
                    {paidCount}/{rows.length} maaş işaretlendi
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {totalCarry > 0 && (
        <div className="mt-3 px-4 py-3 border border-amber-200 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-950/30 rounded-lg text-sm text-amber-800 dark:text-amber-200/90">
          <span className="font-semibold">Devir Avans Uyarısı:</span> {rows.filter(r => r.carryForward > 0).map(r => r.name).join(", ")} adlı çalışanların önceki aylardan toplam{" "}
          <span className="font-bold">{fmt(totalCarry)}</span> ödenmemiş avansı bu aya devredildi.
        </div>
      )}
      {totalOpenAdv > 0 && (
        <div className="mt-3 px-4 py-3 border border-amber-200 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-950/30 rounded-lg text-sm text-amber-800 dark:text-amber-200/90">
          <span className="font-semibold">Açık Avans Bakiyesi:</span> Ay sonu itibarıyla{" "}
          <span className="font-bold">{fmt(totalOpenAdv)}</span> tutarında içerideki avans kapatılmamıştır.
        </div>
      )}
    </div>
  );
}
