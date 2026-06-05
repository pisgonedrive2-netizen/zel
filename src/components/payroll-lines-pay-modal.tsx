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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ödeme kalemleri · ${employee.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 tabular-nums">
            Net ödenecek: <strong className="text-foreground">{fmt(netPayable)}</strong>
          </span>
          <span className="rounded-md border border-green-200/80 bg-green-50/50 dark:border-green-500/35 dark:bg-green-950/30 px-2.5 py-1.5 tabular-nums text-green-800 dark:text-green-300">
            Ödenen: {fmt(paidTotal)} ({paidCount}/{payrollLines.length})
          </span>
          {unpaidTotal > 0 && (
            <span className="rounded-md border border-amber-200/80 bg-amber-50/50 dark:border-amber-500/35 dark:bg-amber-950/30 px-2.5 py-1.5 tabular-nums text-amber-800 dark:text-amber-300">
              Kalan: {fmt(unpaidTotal)}
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          {isFullyPaid ? (
            <span className="text-green-700 dark:text-green-400 font-medium">
              Tüm kalemler ödendi
              {status?.paidDate ? ` · ${status.paidDate}` : ""}
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

        <div className="overflow-auto max-h-[min(55vh,520px)] rounded-lg border border-border space-y-1.5 p-2">
          {payrollLines.map((line) => {
            const tx = line.kasaTxId
              ? kasaTransactions.find((t) => t.id === line.kasaTxId)
              : undefined;
            const kasaName = tx
              ? kasas.find((k) => k.id === tx.kasaId)?.name ?? tx.kasaId
              : undefined;
            return (
              <div
                key={line.lineId}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2.5 text-xs",
                  line.paid
                    ? "border-green-200/80 bg-green-50/40 dark:border-green-500/35 dark:bg-green-950/25"
                    : "border-border bg-muted/20",
                )}
              >
                <span className="min-w-0 flex-1 font-medium text-foreground">
                  {line.label}
                </span>
                <span className="tabular-nums font-semibold shrink-0">
                  {fmt(line.amountUsd)}
                </span>
                {line.paid ? (
                  <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 shrink-0">
                    <CheckCircle2 size={12} />
                    Ödendi
                    {line.paidDate && (
                      <span className="text-muted-foreground font-normal">
                        · {line.paidDate}
                      </span>
                    )}
                    {kasaName && (
                      <span className="text-muted-foreground font-normal">
                        · {kasaName}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 shrink-0">
                    <Clock size={12} /> Bekliyor
                  </span>
                )}
                {!readOnly &&
                  (line.paid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] ml-auto"
                      onClick={() => onUnpayLine(line.lineId, line.label)}
                    >
                      Geri al
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] bg-green-600 hover:bg-green-500 border-0 text-white ml-auto"
                      onClick={() => onPayLine(line)}
                    >
                      Öde
                    </Button>
                  ))}
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
            {isFullyPaid ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={onUnpayAll}
              >
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
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={onPayAll}
                  disabled={netPayable <= 0}
                  title="Tüm kalemleri tek kasa hareketiyle işaretle"
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
