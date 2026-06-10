"use client";

import { CheckCircle2, Clock, Wallet } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/data";
import { payrollDueShort } from "@/lib/payroll-dates";
import {
  formatPayrollLineStatusSummary,
  sumPaidPayrollLines,
  sumUnpaidPayrollLines,
  type PayrollLineItem,
} from "@/lib/payroll-lines";
import type { Employee, Kasa, KasaTransaction, MonthPaymentStatus } from "@/store/store";

type Props = {
  open: boolean;
  onClose: () => void;
  employee: Employee;
  month: string;
  payrollLines: PayrollLineItem[];
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  status?: MonthPaymentStatus;
  netPayable: number;
  readOnly: boolean;
  isFullyPaid: boolean;
  isPartial: boolean;
  onPayLine: (line: PayrollLineItem) => void;
  onPayAll: () => void;
  onUnpayLine: (lineId: string, label: string) => void;
  onUnpayAll: () => void;
};

export function PayrollLinesPayModal({
  open,
  onClose,
  employee,
  month,
  payrollLines,
  kasas,
  kasaTransactions,
  status,
  netPayable,
  readOnly,
  isFullyPaid,
  isPartial,
  onPayLine,
  onPayAll,
  onUnpayLine,
  onUnpayAll,
}: Props) {
  const paidTotal = sumPaidPayrollLines(payrollLines);
  const unpaidTotal = sumUnpaidPayrollLines(payrollLines);
  const paidCount = payrollLines.filter((l) => l.paid).length;
  const unpaidLines = payrollLines.filter((l) => !l.paid);
  const paidLines = payrollLines.filter((l) => l.paid);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ödeme kalemleri · ${employee.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Net ödenecek", value: fmt(netPayable), cls: "text-foreground" },
            { label: "Ödenen", value: fmt(paidTotal), cls: "text-green-700 dark:text-green-300" },
            { label: "Kalan", value: fmt(unpaidTotal), cls: unpaidTotal > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground" },
            { label: "Kalem", value: `${paidCount}/${payrollLines.length}`, cls: "text-muted-foreground" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`text-sm font-semibold tabular-nums ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
          {isFullyPaid ? (
            <span className="text-green-700 dark:text-green-400 font-medium">
              Tüm kalemler ödendi{status?.paidDate ? ` · ${status.paidDate}` : ""}
            </span>
          ) : isPartial ? (
            <span className="text-amber-800 dark:text-amber-200">
              {formatPayrollLineStatusSummary(payrollLines)}
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">
              Ödeme bekliyor · {payrollDueShort(month, employee.paymentDay)}
            </span>
          )}
        </p>

        {unpaidLines.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Bekleyen ({unpaidLines.length})
            </h4>
            <div className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
              {unpaidLines.map((line) => (
                <LineRow
                  key={line.lineId}
                  line={line}
                  kasas={kasas}
                  kasaTransactions={kasaTransactions}
                  readOnly={readOnly}
                  onPay={() => onPayLine(line)}
                />
              ))}
            </div>
          </section>
        )}

        {paidLines.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ödenen ({paidLines.length})
            </h4>
            <div className="rounded-lg border border-green-200/60 dark:border-green-500/30 divide-y divide-border/40 overflow-hidden max-h-[min(40vh,280px)] overflow-y-auto">
              {paidLines.map((line) => (
                <LineRow
                  key={line.lineId}
                  line={line}
                  kasas={kasas}
                  kasaTransactions={kasaTransactions}
                  readOnly={readOnly}
                  onUnpay={() => onUnpayLine(line.lineId, line.label)}
                />
              ))}
            </div>
          </section>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
            {isFullyPaid ? (
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onUnpayAll}>
                Tümünü geri al
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onClose}>
                  Kapat
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-500 text-white border-0"
                  onClick={onPayAll}
                  disabled={netPayable <= 0}
                >
                  <Wallet size={12} />
                  Tümünü öde ({fmt(netPayable)})
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function LineRow({
  line,
  kasas,
  kasaTransactions,
  readOnly,
  onPay,
  onUnpay,
}: {
  line: PayrollLineItem;
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  readOnly: boolean;
  onPay?: () => void;
  onUnpay?: () => void;
}) {
  const tx = line.kasaTxId ? kasaTransactions.find((t) => t.id === line.kasaTxId) : undefined;
  const kasaName = tx ? kasas.find((k) => k.id === tx.kasaId)?.name ?? tx.kasaId : undefined;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-3 py-2.5 text-xs",
        line.paid ? "bg-green-50/30 dark:bg-green-950/15" : "bg-card",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground truncate">{line.label}</p>
        {line.paid && line.paidDate && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {line.paidDate}
            {kasaName ? ` · ${kasaName}` : ""}
          </p>
        )}
      </div>
      <span className="tabular-nums font-semibold shrink-0">{fmt(line.amountUsd)}</span>
      {line.paid ? (
        <>
          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 shrink-0 text-[10px]">
            <CheckCircle2 size={11} /> Ödendi
          </span>
          {!readOnly && onUnpay && (
            <Button size="sm" variant="outline" className="h-7 text-[10px] ml-auto" onClick={onUnpay}>
              Geri al
            </Button>
          )}
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 shrink-0 text-[10px]">
            <Clock size={11} /> Bekliyor
          </span>
          {!readOnly && onPay && (
            <Button
              size="sm"
              className="h-7 text-[10px] bg-green-600 hover:bg-green-500 border-0 text-white ml-auto"
              onClick={onPay}
            >
              Öde
            </Button>
          )}
        </>
      )}
    </div>
  );
}
