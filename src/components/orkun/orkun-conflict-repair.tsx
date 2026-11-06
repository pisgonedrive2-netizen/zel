"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/store/store";
import { listDoubleSettlementConflicts } from "@/lib/content-expense";
import { fmt } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Çift kapanış (bordro + kasa) çakışmalarını listeler ve tek taraflı geri alma sunar. */
export function OrkunConflictRepair() {
  const contentExpenses = useStore((s) => s.contentExpenses);
  const salaryExtras = useStore((s) => s.salaryExtras);
  const kasaTransactions = useStore((s) => s.kasaTransactions);
  const employees = useStore((s) => s.employees);
  const unsettleContentExpenseFromPayroll = useStore(
    (s) => s.unsettleContentExpenseFromPayroll,
  );
  const unpayContentExpense = useStore((s) => s.unpayContentExpense);

  const rows = useMemo(() => {
    const list = listDoubleSettlementConflicts(contentExpenses, {
      salaryExtras,
      kasaTransactions,
    });
    return [...list].sort((a, b) => {
      const d = (b.date || "").localeCompare(a.date || "");
      if (d !== 0) return d;
      return (b.month || "").localeCompare(a.month || "");
    });
  }, [contentExpenses, salaryExtras, kasaTransactions]);

  const onUnsettlePayroll = (id: string) => {
    if (
      !window.confirm(
        "Bordro bağlantısı kaldırılsın mı? İlgili maaş kalemi silinir.",
      )
    ) {
      return;
    }
    unsettleContentExpenseFromPayroll?.(id);
  };

  const onUnpayKasa = (id: string) => {
    if (
      !window.confirm(
        "Kasa ödemesi geri alınsın mı? Kasa hareketi silinir; harcama yeniden ödeme bekler.",
      )
    ) {
      return;
    }
    unpayContentExpense?.(id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              Çift ödeme çakışmaları
            </CardTitle>
            <CardDescription className="mt-1">
              Hem bordroya hem kasaya bağlı içerik harcamaları — bir tarafı geri alın.
            </CardDescription>
          </div>
          <Badge
            variant={rows.length > 0 ? "destructive" : "outline"}
            className="tabular-nums shrink-0"
          >
            {rows.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Çift ödeme çakışması yok.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Çalışan</th>
                  <th className="px-3 py-2 font-medium">Marka</th>
                  <th className="px-3 py-2 font-medium text-right">Tutar</th>
                  <th className="px-3 py-2 font-medium">Sorun</th>
                  <th className="px-3 py-2 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const emp = employees.find((em) => em.id === e.employeeId);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-border/70 last:border-0 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50/80 dark:hover:bg-red-950/30"
                    >
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {e.date || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {emp?.name ?? "?"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.brandName}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {fmt(e.amountUsd)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] text-red-800 border-red-300 bg-red-50 dark:text-red-200 dark:border-red-500/40 dark:bg-red-950/40"
                        >
                          Bordro + Kasa
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {typeof unsettleContentExpenseFromPayroll === "function" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => onUnsettlePayroll(e.id)}
                            >
                              Bordrodan çıkar
                            </Button>
                          )}
                          {typeof unpayContentExpense === "function" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => onUnpayKasa(e.id)}
                            >
                              Kasa ödemesini geri al
                            </Button>
                          )}
                        </div>
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
  );
}
