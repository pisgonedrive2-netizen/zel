"use client";

import { useMemo } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useStore } from "@/store/store";
import { useAuth } from "@/store/auth";
import { logAudit } from "@/store/audit-log";
import { fmt } from "@/lib/data";
import { isStreamerClearedExpense } from "@/lib/content-expense";
import {
  expenseDescriptionSnippet,
  filterOrkunArchiveExpenses,
  stripArchiveTagsFromNotes,
} from "@/lib/orkun-archive";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Orkun-only: geri çekilen (cancelled) içerik harcamaları arşivi.
 * Mount: `/orkun` Arşiv sekmesi veya bağımsız.
 */
export function OrkunArchivePanel() {
  const { contentExpenses, employees, updateContentExpense, deleteContentExpense } =
    useStore();
  const { user } = useAuth();

  const rows = useMemo(() => {
    const list = filterOrkunArchiveExpenses(contentExpenses);
    return [...list].sort((a, b) => {
      const d = (b.date || "").localeCompare(a.date || "");
      if (d !== 0) return d;
      return (b.month || "").localeCompare(a.month || "");
    });
  }, [contentExpenses]);

  const reopen = (id: string) => {
    const e = contentExpenses.find((x) => x.id === id);
    if (!e) return;
    if (
      !window.confirm(
        "Geri çekilen harcama yeniden açılsın mı? İncelemede olarak yayıncıya ve yöneticilere görünür olur.",
      )
    ) {
      return;
    }
    updateContentExpense(e.id, {
      reviewStatus: "pending",
      reviewedAt: undefined,
      reviewedBy: undefined,
      reviewerNote: "Orkun tarafından yeniden açıldı.",
      notes: stripArchiveTagsFromNotes(e.notes),
    });
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_settlement",
      detail: `restore withdrawn · ${e.brandName} · ${e.id}`,
    });
  };

  const hardDelete = (id: string) => {
    const e = contentExpenses.find((x) => x.id === id);
    if (!e) return;
    if (
      !window.confirm(
        "Bu geri çekilen harcama kalıcı silinsin mi? Bu işlem geri alınamaz.",
      )
    ) {
      return;
    }
    deleteContentExpense(e.id);
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_settlement",
      detail: `hard delete withdrawn · ${e.brandName} · ${e.id}`,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="size-4 text-muted-foreground" />
              Arşiv — geri çekilen harcamalar
            </CardTitle>
            <CardDescription className="mt-1">
              Yayıncı veya yönetici tarafından iptal edilen içerik harcamaları. Yeniden açılabilir veya kalıcı silinebilir.
            </CardDescription>
          </div>
          <Badge variant="outline" className="tabular-nums shrink-0">
            {rows.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Arşivde geri çekilen harcama yok.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Ay</th>
                  <th className="px-3 py-2 font-medium">Çalışan</th>
                  <th className="px-3 py-2 font-medium">Marka</th>
                  <th className="px-3 py-2 font-medium text-right">Tutar</th>
                  <th className="px-3 py-2 font-medium">Açıklama</th>
                  <th className="px-3 py-2 font-medium">Temizlendi?</th>
                  <th className="px-3 py-2 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const emp = employees.find((em) => em.id === e.employeeId);
                  const cleared = isStreamerClearedExpense(e);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {e.date || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                        {e.month || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {emp?.name ?? "?"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.brandName}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {fmt(e.amountUsd)}
                      </td>
                      <td
                        className="px-3 py-2 max-w-[14rem] truncate text-muted-foreground"
                        title={e.description || undefined}
                      >
                        {expenseDescriptionSnippet(e.description)}
                      </td>
                      <td className="px-3 py-2">
                        {cleared ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-200 dark:border-amber-500/40 dark:bg-amber-950/40"
                          >
                            Evet
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Hayır</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1"
                            onClick={() => reopen(e.id)}
                          >
                            <RotateCcw className="size-3" />
                            Yeniden aç
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-500/40 dark:hover:bg-red-950/40"
                            onClick={() => hardDelete(e.id)}
                          >
                            <Trash2 className="size-3" />
                            Kalıcı sil
                          </Button>
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
