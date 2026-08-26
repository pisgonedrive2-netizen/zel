"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select, FormGrid } from "@/components/ui/field";
import { fmt } from "@/lib/data";
import { canConvertPayrollToKasa } from "@/lib/content-expense";
import type { ContentExpense, Employee } from "@/store/store";

type Props = {
  open: boolean;
  onClose: () => void;
  expenses: ContentExpense[];
  employees: Employee[];
  months: string[];
  monthLabel: (ym: string) => string;
  onPick: (rows: ContentExpense[]) => void;
};

export function ContentExpenseBulkPayrollToKasaModal({
  open,
  onClose,
  expenses,
  employees,
  months,
  monthLabel,
  onPick,
}: Props) {
  const [monthYm, setMonthYm] = useState(months[0] ?? "");
  const [employeeId, setEmployeeId] = useState("all");

  const convertible = useMemo(() => {
    return expenses.filter((e) => {
      if (!canConvertPayrollToKasa(e)) return false;
      if (monthYm && e.month !== monthYm) return false;
      if (employeeId !== "all" && e.employeeId !== employeeId) return false;
      return true;
    });
  }, [expenses, monthYm, employeeId]);

  const total = convertible.reduce((s, e) => s + e.amountUsd, 0);

  const empOptions = useMemo(() => {
    const ids = new Set(
      expenses.filter((e) => canConvertPayrollToKasa(e)).map((e) => e.employeeId)
    );
    return employees.filter((e) => ids.has(e.id));
  }, [expenses, employees]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Toplu: maaşı → kasaya taşı" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Seçilen ay / yayıncı için maaş masrafındaki onaylı harcamaları listeler. Onayda kasa
          bakiyesi önizlemesi açılır.
        </p>
        <FormGrid>
          <Field label="Ay">
            <Select
              value={monthYm}
              onChange={(e) => setMonthYm(e.target.value)}
              options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
            />
          </Field>
          <Field label="Yayıncı">
            <Select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              options={[
                { value: "all", label: "Tümü" },
                ...empOptions.map((e) => ({ value: e.id, label: e.name })),
              ]}
            />
          </Field>
        </FormGrid>

        <div className="rounded-lg border border-border max-h-[280px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-medium">Tarih</th>
                <th className="px-2 py-1.5 text-left font-medium">Yayıncı</th>
                <th className="px-2 py-1.5 text-left font-medium">Marka</th>
                <th className="px-2 py-1.5 text-right font-medium">USD</th>
              </tr>
            </thead>
            <tbody>
              {convertible.map((e) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="px-2 py-1.5">{e.date}</td>
                  <td className="px-2 py-1.5">
                    {employees.find((x) => x.id === e.employeeId)?.name ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">{e.brandName}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                    {fmt(e.amountUsd)}
                  </td>
                </tr>
              ))}
              {convertible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    Bu filtrede maaş masrafı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {convertible.length} kayıt · {fmt(total)}
          </Badge>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={convertible.length === 0}
              className="gap-1.5"
              onClick={() => {
                onPick(convertible);
                onClose();
              }}
            >
              <ArrowRightLeft size={14} />
              Kasaya taşı ({convertible.length})
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
