"use client";

import { useEffect, useMemo, useState } from "react";
import { Home } from "lucide-react";
import {
  useStore,
  getRentForMonth,
  isPayrollActive,
  type Employee,
} from "@/store/store";
import { fmt, shiftCalendarMonthYm, toYearMonthLocal } from "@/lib/data";
import { monthsInclusive } from "@/lib/rent-months";
import { monthLabelTr } from "@/lib/monthly-exports";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, NumberInput, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Mode = "range" | "pick";

export function BulkRentModal({
  open,
  onClose,
  employees,
  defaultEmployeeId,
  defaultFromMonth,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  defaultEmployeeId?: string;
  defaultFromMonth?: string;
}) {
  const { salaryExtras, setRentForMonths, syncRentSupportFromMonth, setEmployeeRentSupport } =
    useStore();
  const bordrolu = useMemo(
    () => employees.filter((e) => e.kind !== "coordinator" && e.status === "active"),
    [employees]
  );

  const todayYm = toYearMonthLocal(new Date());
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [mode, setMode] = useState<Mode>("range");
  const [fromMonth, setFromMonth] = useState(defaultFromMonth ?? todayYm);
  const [toMonth, setToMonth] = useState(defaultFromMonth ?? todayYm);
  const [amount, setAmount] = useState(0);
  const [alsoContract, setAlsoContract] = useState(false);
  const [alsoForward12, setAlsoForward12] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const employee = bordrolu.find((e) => e.id === employeeId);

  const pickerMonths = useMemo(() => {
    if (!employee) return [];
    const start = employee.payrollStartMonth;
    const end = shiftCalendarMonthYm(todayYm, 18);
    return monthsInclusive(start, end, 36);
  }, [employee, todayYm]);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(defaultEmployeeId ?? bordrolu[0]?.id ?? "");
    setFromMonth(defaultFromMonth ?? todayYm);
    setToMonth(defaultFromMonth ?? todayYm);
    setMode("range");
    setAlsoContract(false);
    setAlsoForward12(false);
    setPicked(new Set(defaultFromMonth ? [defaultFromMonth] : []));
  }, [open, defaultEmployeeId, defaultFromMonth, bordrolu, todayYm]);

  useEffect(() => {
    if (!employee) {
      setAmount(0);
      return;
    }
    const ref =
      defaultFromMonth && isPayrollActive(employee, defaultFromMonth)
        ? defaultFromMonth
        : fromMonth;
    setAmount(getRentForMonth(employee, ref, salaryExtras));
  }, [employeeId, open, employee, salaryExtras, defaultFromMonth, fromMonth]);

  const rangeMonths = useMemo(() => {
    if (!employee) return [];
    return monthsInclusive(fromMonth, toMonth).filter((m) => isPayrollActive(employee, m));
  }, [employee, fromMonth, toMonth]);

  const selectedMonths =
    mode === "range"
      ? rangeMonths
      : [...picked].filter((m) => employee && isPayrollActive(employee, m)).sort();

  const toggleMonth = (ym: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(ym)) next.delete(ym);
      else next.add(ym);
      return next;
    });
  };

  const handleApply = () => {
    if (!employee || selectedMonths.length === 0) return;
    setRentForMonths(employee.id, selectedMonths, amount);
    if (alsoForward12) {
      const start = selectedMonths[0] ?? fromMonth;
      syncRentSupportFromMonth(employee.id, start, amount);
    } else if (alsoContract) {
      setEmployeeRentSupport(employee.id, amount);
    }
    onClose();
  };

  const monthOptions = pickerMonths.map((m) => ({
    value: m,
    label: monthLabelTr(m),
  }));

  return (
    <Modal open={open} onClose={onClose} title="Toplu kira düzenle" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Seçtiğiniz aylara kira tutarı yazılır. Yayıncı kendi panelinde ve bordroda{" "}
          <span className="font-medium text-foreground">ay bazlı</span> güncellenmiş tutarı görür.
        </p>

        <Field label="Çalışan" required>
          <Select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            options={[
              { value: "", label: "Seçin…" },
              ...bordrolu.map((e) => ({ value: e.id, label: `${e.name} · ${e.role}` })),
            ]}
          />
        </Field>

        {employee && (
          <>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "range" ? "default" : "outline"}
                onClick={() => setMode("range")}
              >
                Ay aralığı
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "pick" ? "default" : "outline"}
                onClick={() => setMode("pick")}
              >
                Ay seç
              </Button>
            </div>

            {mode === "range" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Başlangıç ayı">
                  <Select
                    value={fromMonth}
                    onChange={(e) => setFromMonth(e.target.value)}
                    options={monthOptions}
                  />
                </Field>
                <Field label="Bitiş ayı">
                  <Select
                    value={toMonth}
                    onChange={(e) => setToMonth(e.target.value)}
                    options={monthOptions}
                  />
                </Field>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Bordro ayları (çoklu seçim)</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-primary underline"
                      onClick={() => setPicked(new Set(pickerMonths))}
                    >
                      Tümünü seç
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline"
                      onClick={() => setPicked(new Set())}
                    >
                      Temizle
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto rounded-lg border border-border p-2">
                  {pickerMonths.map((m) => {
                    const active = isPayrollActive(employee, m);
                    const on = picked.has(m);
                    const cur = getRentForMonth(employee, m, salaryExtras);
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={!active}
                        onClick={() => active && toggleMonth(m)}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
                          !active && "opacity-40 cursor-not-allowed",
                          on
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <span className="block font-medium capitalize">{monthLabelTr(m)}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {active ? (cur > 0 ? fmt(cur) : "—") : "bordro dışı"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Field label="Kira tutarı ($/ay)" required>
              <NumberInput value={amount} onChange={setAmount} min={0} step={50} />
            </Field>

            <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5 text-xs space-y-2">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Home size={12} /> Önizleme · {selectedMonths.length} ay
              </p>
              {selectedMonths.length === 0 ? (
                <p className="text-muted-foreground">Geçerli ay seçilmedi.</p>
              ) : (
                <p className="text-muted-foreground">
                  {selectedMonths.map((m) => monthLabelTr(m)).join(", ")} →{" "}
                  <span className="font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
                    {fmt(amount)}
                  </span>
                  / ay
                </p>
              )}
              {employee.rentSupport > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Sözleşme varsayılanı: {fmt(employee.rentSupport)}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={alsoContract}
                onChange={(e) => {
                  setAlsoContract(e.target.checked);
                  if (e.target.checked) setAlsoForward12(false);
                }}
              />
              <span>
                Sözleşme kira desteğini de güncelle (<span className="tabular-nums">{fmt(amount)}</span>) —
                kalem olmayan aylarda varsayılan bu tutar olur
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={alsoForward12}
                onChange={(e) => {
                  setAlsoForward12(e.target.checked);
                  if (e.target.checked) setAlsoContract(false);
                }}
              />
              <span>
                İlk seçili aydan itibaren 12 ay aynı tutarı otomatik doldur (mevcut kira kalemlerinin
                üzerine yazar)
              </span>
            </label>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button
            type="button"
            disabled={!employee || selectedMonths.length === 0}
            onClick={handleApply}
          >
            Uygula ({selectedMonths.length} ay)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
