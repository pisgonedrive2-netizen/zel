"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Select, FormGrid } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { fmt, toDateLocal } from "@/lib/data";
import {
  computeTronPanelMetrics,
  kasaPaymentBalance,
  kasaSelectOptionLabel,
} from "@/lib/kasa-tron-metrics";
import { isPayrollSettled } from "@/lib/content-expense";
import type { ContentExpense, Kasa, KasaTransaction } from "@/store/store";

type Props = {
  open: boolean;
  onClose: () => void;
  expenses: ContentExpense[];
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  defaultKasaId: string;
  title?: string;
  onConfirm: (opts: { kasaId: string; paidDate: string }) => void;
};

export function ContentExpenseKasaPayModal({
  open,
  onClose,
  expenses,
  kasas,
  kasaTransactions,
  defaultKasaId,
  title,
  onConfirm,
}: Props) {
  const activeKasas = useMemo(
    () =>
      kasas
        .filter((k) => !k.archived)
        .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name)),
    [kasas]
  );
  const [kasaId, setKasaId] = useState(defaultKasaId);
  const [paidDate, setPaidDate] = useState(() => toDateLocal(new Date()));

  const total = expenses.reduce((s, e) => s + e.amountUsd, 0);
  const fromPayroll = expenses.filter((e) => isPayrollSettled(e)).length;

  const tronPanel = useMemo(
    () => computeTronPanelMetrics(kasas, kasaTransactions),
    [kasas, kasaTransactions]
  );
  const balanceBefore = useMemo(
    () => kasaPaymentBalance(kasaId, kasas, kasaTransactions, tronPanel),
    [kasaId, kasas, kasaTransactions, tronPanel]
  );
  const balanceAfter = balanceBefore - total;
  const isLow = balanceAfter < 0;

  if (!open || expenses.length === 0) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? (expenses.length === 1 ? "Kasadan öde" : "Toplu kasadan öde")}
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-sm">
          <p className="font-medium">
            {expenses.length} harcama · {fmt(total)}
          </p>
          {fromPayroll > 0 && (
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
              {fromPayroll} kayıt maaş masrafından çıkarılıp kasaya taşınacak.
            </p>
          )}
          {expenses.length <= 5 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {expenses.map((e) => (
                <li key={e.id}>
                  {e.brandName} · {fmt(e.amountUsd)}
                  {isPayrollSettled(e) ? " · maaş→kasa" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <FormGrid>
          <Field label="Kasa">
            <Select
              value={kasaId}
              onChange={(e) => setKasaId(e.target.value)}
              options={activeKasas.map((k) => ({
                value: k.id,
                label: kasaSelectOptionLabel(k, kasas, kasaTransactions, tronPanel),
              }))}
            />
          </Field>
          <Field label="Ödeme tarihi">
            <DateTimePicker mode="date" value={paidDate} onChange={setPaidDate} />
          </Field>
        </FormGrid>

        <div
          className={`rounded-lg border px-3 py-2.5 text-xs ${
            isLow
              ? "border-red-300 bg-red-50/50 text-red-900 dark:border-red-500/45 dark:bg-red-950/30 dark:text-red-100"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Wallet size={13} />
            Kasa bakiyesi önizlemesi
          </p>
          <p className="mt-1 tabular-nums">
            Önce: {fmt(balanceBefore)} → Sonra:{" "}
            <span className={isLow ? "font-semibold text-red-700 dark:text-red-300" : "font-semibold"}>
              {fmt(balanceAfter)}
            </span>
          </p>
          {isLow && (
            <p className="mt-1 flex items-start gap-1 text-red-800 dark:text-red-200">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              Bakiye yetersiz görünüyor; yine de onaylayabilirsiniz.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm({ kasaId, paidDate });
              onClose();
            }}
          >
            Onayla · {fmt(total)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
