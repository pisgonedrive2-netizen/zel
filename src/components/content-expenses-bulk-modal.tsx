"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Receipt, Wallet } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select, FormGrid } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { fmt, defaultSnapshotDateInMonth } from "@/lib/data";
import {
  expenseReviewStatus,
  settlementLabel,
  isPayrollSettled,
  isUnsettledApprovedContent,
} from "@/lib/content-expense";
import {
  DEFAULT_KASA_ID,
  type ContentExpense,
  type Employee,
  type Kasa,
  type KasaTransaction,
} from "@/store/store";

export function canPayContentFromKasa(e: ContentExpense): boolean {
  return isUnsettledApprovedContent(e);
}

type Props = {
  open: boolean;
  onClose: () => void;
  employee: Employee;
  month: string;
  expenses: ContentExpense[];
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  readOnly: boolean;
  isAdmin: boolean;
  onPayFromKasa: (ids: string[], opts: { kasaId: string; paidDate: string }) => void;
  onSettleToPayroll: (id: string) => void;
  onUnsettlePayroll: (id: string) => void;
  onOpenReview: (id: string) => void;
};

export function ContentExpensesBulkModal({
  open,
  onClose,
  employee,
  month,
  expenses,
  kasas,
  kasaTransactions,
  readOnly,
  isAdmin,
  onPayFromKasa,
  onSettleToPayroll,
  onUnsettlePayroll,
  onOpenReview,
}: Props) {
  const [filter, setFilter] = useState<"payable" | "all">("payable");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmPay, setConfirmPay] = useState(false);

  const activeKasas = useMemo(
    () =>
      kasas
        .filter((k) => !k.archived)
        .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name)),
    [kasas],
  );
  const defaultKasaId =
    activeKasas.find((k) => k.isDefault)?.id ?? activeKasas[0]?.id ?? DEFAULT_KASA_ID;
  const [kasaId, setKasaId] = useState(defaultKasaId);
  const [paidDate, setPaidDate] = useState(() => defaultSnapshotDateInMonth(month));

  const payable = useMemo(
    () => expenses.filter(canPayContentFromKasa),
    [expenses],
  );

  const displayed = useMemo(
    () => (filter === "payable" ? payable : expenses),
    [filter, payable, expenses],
  );

  const selectedRows = useMemo(
    () => displayed.filter((e) => selected.has(e.id)),
    [displayed, selected],
  );
  const selectedTotal = selectedRows.reduce((s, e) => s + e.amountUsd, 0);

  const balanceBefore = useMemo(
    () =>
      kasaTransactions
        .filter((t) => t.kasaId === kasaId)
        .reduce(
          (b, t) => (t.direction === "in" ? b + t.amountUsd : b - t.amountUsd - t.feeUsd),
          0,
        ),
    [kasaTransactions, kasaId],
  );
  const balanceAfter = balanceBefore - selectedTotal;

  useEffect(() => {
    if (!open) return;
    setFilter("payable");
    setConfirmPay(false);
    setPaidDate(defaultSnapshotDateInMonth(month));
    setKasaId(defaultKasaId);
    setSelected(
      new Set(expenses.filter(canPayContentFromKasa).map((e) => e.id)),
    );
  }, [open, month, expenses, defaultKasaId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDisplayed = () => {
    setSelected(new Set(displayed.filter(canPayContentFromKasa).map((e) => e.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handlePay = () => {
    const ids = selectedRows.filter(canPayContentFromKasa).map((e) => e.id);
    if (ids.length === 0) return;
    if (balanceAfter < 0) {
      const ok = window.confirm(
        `Seçili kasanın bakiyesi (${fmt(balanceBefore)}) bu toplamı (${fmt(selectedTotal)}) karşılamıyor. Yine de devam edilsin mi?`,
      );
      if (!ok) return;
    }
    onPayFromKasa(ids, { kasaId, paidDate });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`İçerik harcamaları · ${employee.name}`}
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {month} · {expenses.length} kayıt
          {payable.length > 0 && (
            <>
              {" "}
              · <span className="text-green-700 dark:text-green-400 font-medium">
                {payable.length} kasadan ödenebilir ({fmt(payable.reduce((s, e) => s + e.amountUsd, 0))})
              </span>
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/30 text-xs">
            <button
              type="button"
              className={`px-2.5 py-1 rounded-md ${filter === "payable" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}
              onClick={() => setFilter("payable")}
            >
              Ödenebilir ({payable.length})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-md ${filter === "all" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}
              onClick={() => setFilter("all")}
            >
              Tümü ({expenses.length})
            </button>
          </div>
          {!readOnly && isAdmin && filter === "payable" && (
            <>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={selectAllDisplayed}>
                Tümünü seç
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
                Seçimi temizle
              </Button>
            </>
          )}
        </div>

        <div className="overflow-auto max-h-[min(52vh,480px)] rounded-lg border border-border">
          <table className="w-full text-xs min-w-[720px]">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr className="text-muted-foreground border-b border-border">
                {!readOnly && isAdmin && (
                  <th className="w-8 px-2 py-2 text-left">
                    <span className="sr-only">Seç</span>
                  </th>
                )}
                <th className="text-left px-2 py-2 font-medium">Tarih</th>
                <th className="text-left px-2 py-2 font-medium">Marka</th>
                <th className="text-left px-2 py-2 font-medium">Kategori</th>
                <th className="text-left px-2 py-2 font-medium max-w-[200px]">Açıklama</th>
                <th className="text-right px-2 py-2 font-medium">USD</th>
                <th className="text-left px-2 py-2 font-medium">Durum</th>
                <th className="text-right px-2 py-2 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((e) => {
                const st = expenseReviewStatus(e);
                const payOk = canPayContentFromKasa(e);
                const checked = selected.has(e.id);
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-border/40 last:border-0 ${
                      checked ? "bg-green-50/40 dark:bg-green-950/20" : ""
                    }`}
                  >
                    {!readOnly && isAdmin && (
                      <td className="px-2 py-2">
                        {payOk ? (
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-border"
                            checked={checked}
                            onChange={() => toggle(e.id)}
                            aria-label={`Seç: ${e.description}`}
                          />
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{e.date}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{e.brandName}</td>
                    <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{e.category}</td>
                    <td className="px-2 py-2 truncate max-w-[200px]" title={e.description}>
                      {e.description}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                      {fmt(e.amountUsd)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-[10px] text-muted-foreground">
                      {settlementLabel(e)}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {st === "pending" && isAdmin && (
                        <button
                          type="button"
                          className="text-[10px] text-amber-700 hover:underline"
                          onClick={() => onOpenReview(e.id)}
                        >
                          İncele
                        </button>
                      )}
                      {st === "approved" && !isPayrollSettled(e) && !e.paid && isAdmin && !readOnly && (
                        <button
                          type="button"
                          className="text-[10px] text-violet-700 hover:underline ml-2"
                          onClick={() => onSettleToPayroll(e.id)}
                        >
                          Maaş
                        </button>
                      )}
                      {isPayrollSettled(e) && isAdmin && !readOnly && (
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:underline"
                          onClick={() => {
                            if (window.confirm("Bordro bağlantısı kaldırılsın mı?")) {
                              onUnsettlePayroll(e.id);
                            }
                          }}
                        >
                          Geri al
                        </button>
                      )}
                      {e.paid && (
                        <Badge variant="outline" className="text-[9px] text-green-700 border-green-300">
                          <CheckCircle2 size={8} className="mr-0.5" /> Ödendi
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr>
                  <td
                    colSpan={readOnly || !isAdmin ? 7 : 8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {filter === "payable" ? "Kasadan ödenecek onaylı harcama yok." : "Kayıt yok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!readOnly && isAdmin && payable.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/25 p-3 space-y-3">
            {!confirmPay ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Seçili:{" "}
                  <strong className="tabular-nums text-foreground">
                    {selectedRows.filter(canPayContentFromKasa).length} kalem · {fmt(selectedTotal)}
                  </strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    disabled={selectedRows.filter(canPayContentFromKasa).length === 0}
                    onClick={() => setConfirmPay(true)}
                  >
                    <Wallet size={12} />
                    Seçilenleri kasadan öde
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-500 text-white border-0"
                    disabled={payable.length === 0}
                    onClick={() => {
                      setSelected(new Set(payable.map((e) => e.id)));
                      setConfirmPay(true);
                    }}
                  >
                    <Receipt size={12} />
                    Tüm ödenebilirleri öde ({fmt(payable.reduce((s, e) => s + e.amountUsd, 0))})
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-foreground">
                  {selectedRows.filter(canPayContentFromKasa).length} harcama · toplam{" "}
                  <span className="tabular-nums">{fmt(selectedTotal)}</span> kasadan düşülecek
                </p>
                <FormGrid>
                  <Field label="Kasa" required>
                    <Select
                      value={kasaId}
                      onChange={(e) => setKasaId(e.target.value)}
                      options={activeKasas.map((k) => ({
                        value: k.id,
                        label: `${k.name} · ${fmt(
                          kasaTransactions
                            .filter((t) => t.kasaId === k.id)
                            .reduce(
                              (b, t) =>
                                t.direction === "in"
                                  ? b + t.amountUsd
                                  : b - t.amountUsd - t.feeUsd,
                              0,
                            ),
                        )}`,
                      }))}
                    />
                  </Field>
                  <Field label="Ödeme tarihi" required>
                    <DateTimePicker
                      mode="date"
                      value={paidDate}
                      onChange={setPaidDate}
                      required
                    />
                  </Field>
                </FormGrid>
                <p
                  className={`text-[11px] tabular-nums ${
                    balanceAfter < 0 ? "text-red-600" : "text-muted-foreground"
                  }`}
                >
                  Kasa bakiyesi: {fmt(balanceBefore)} → {fmt(balanceAfter)}
                  {balanceAfter < 0 && " · bakiye yetersiz"}
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmPay(false)}>
                    Geri
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-green-600 hover:bg-green-500 text-white border-0"
                    onClick={handlePay}
                    disabled={selectedRows.filter(canPayContentFromKasa).length === 0}
                  >
                    Onayla ve öde
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
