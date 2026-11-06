"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useStore } from "@/store/store";
import { useAuth } from "@/store/auth";
import { logAudit } from "@/store/audit-log";
import { fmt } from "@/lib/data";
import {
  ORKUN_TRASH_RETENTION_DAYS,
  expenseDescriptionSnippet,
  filterOrkunTrashExpenses,
  isOrkunTrashExpired,
  orkunTrashAgeLabel,
  orkunTrashKind,
  stripArchiveTagsFromNotes,
  stripOrkunTrash,
} from "@/lib/orkun-archive";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Orkun-only çöp kutusu.
 * İçerik harcamaları: `[orkun_trash]` etiketi veya yayıncı soft-clear
 * (withdrawn + `[streamer_cleared]`). Aynı etiket kalıbı ileride kasa/users için.
 */
export function OrkunTrashPanel() {
  const { contentExpenses, employees, updateContentExpense, deleteContentExpense } =
    useStore();
  const { user } = useAuth();
  const [onlyExpired, setOnlyExpired] = useState(false);

  const rows = useMemo(() => {
    let list = filterOrkunTrashExpenses(contentExpenses);
    if (onlyExpired) {
      list = list.filter((e) => isOrkunTrashExpired(e, ORKUN_TRASH_RETENTION_DAYS));
    }
    return [...list].sort((a, b) => {
      const d = (b.date || "").localeCompare(a.date || "");
      if (d !== 0) return d;
      return (b.month || "").localeCompare(a.month || "");
    });
  }, [contentExpenses, onlyExpired]);

  const restore = (id: string) => {
    const e = contentExpenses.find((x) => x.id === id);
    if (!e) return;
    const kind = orkunTrashKind(e);

    if (kind === "streamer_discarded") {
      if (
        !window.confirm(
          "Yayıncının listeden kaldırdığı harcama yeniden açılsın mı? İncelemede olarak görünür olur.",
        )
      ) {
        return;
      }
      updateContentExpense(e.id, {
        reviewStatus: "pending",
        reviewedAt: undefined,
        reviewedBy: undefined,
        reviewerNote: "Orkun tarafından çöp kutusundan yeniden açıldı.",
        notes: stripArchiveTagsFromNotes(e.notes),
      });
      logAudit({
        actorId: user?.id ?? "unknown",
        actorName: user?.name ?? "?",
        action: "expense_settlement",
        detail: `restore trash streamer_discarded · ${e.brandName} · ${e.id}`,
      });
      return;
    }

    if (
      !window.confirm(
        "Bu kayıt çöp kutusundan geri yüklensin mi? `[orkun_trash]` etiketi kaldırılır.",
      )
    ) {
      return;
    }
    updateContentExpense(e.id, {
      notes: stripOrkunTrash(e.notes),
    });
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_settlement",
      detail: `restore trash tag · ${e.brandName} · ${e.id}`,
    });
  };

  const hardDelete = (id: string) => {
    const e = contentExpenses.find((x) => x.id === id);
    if (!e) return;
    if (
      !window.confirm(
        "Bu kayıt kalıcı silinsin mi? Bu işlem geri alınamaz.",
      )
    ) {
      return;
    }
    deleteContentExpense(e.id);
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_settlement",
      detail: `hard delete trash · ${e.brandName} · ${e.id}`,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="size-4 text-muted-foreground" />
              Çöp kutusu
            </CardTitle>
            <CardDescription className="mt-1">
              Soft-silinen (`[orkun_trash]`) veya yayıncının listeden temizlediği geri çekilen harcamalar.
              {" "}
              {ORKUN_TRASH_RETENTION_DAYS} gün sonra kalıcı silme önerilir.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={onlyExpired}
                onChange={(e) => setOnlyExpired(e.target.checked)}
              />
              30g+
            </label>
            <Badge variant="outline" className="tabular-nums">
              {rows.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {onlyExpired ? "30g+ kayıt yok." : "Çöp kutusu boş."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Ay</th>
                  <th className="px-3 py-2 font-medium">Yaş</th>
                  <th className="px-3 py-2 font-medium">Çalışan</th>
                  <th className="px-3 py-2 font-medium">Marka</th>
                  <th className="px-3 py-2 font-medium text-right">Tutar</th>
                  <th className="px-3 py-2 font-medium">Açıklama</th>
                  <th className="px-3 py-2 font-medium">Tür</th>
                  <th className="px-3 py-2 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const emp = employees.find((em) => em.id === e.employeeId);
                  const kind = orkunTrashKind(e);
                  const ageLabel = orkunTrashAgeLabel(e);
                  const expired = isOrkunTrashExpired(e, ORKUN_TRASH_RETENTION_DAYS);
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
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="outline"
                            className={
                              expired
                                ? "w-fit text-[10px] text-red-800 border-red-300 bg-red-50 dark:text-red-200 dark:border-red-500/40 dark:bg-red-950/40"
                                : "w-fit text-[10px] tabular-nums"
                            }
                          >
                            {ageLabel}
                          </Badge>
                          {expired && (
                            <span className="text-[10px] text-red-700 dark:text-red-300 max-w-[9rem] leading-tight">
                              Süresi dolmak üzere / dolmuş — kalıcı sil önerilir
                            </span>
                          )}
                        </div>
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
                        {kind === "orkun_trash" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-slate-700 border-slate-300 bg-slate-50 dark:text-slate-200 dark:border-slate-500/40 dark:bg-slate-950/40"
                          >
                            Orkun çöp
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-200 dark:border-amber-500/40 dark:bg-amber-950/40"
                          >
                            Yayıncı temizledi
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1"
                            onClick={() => restore(e.id)}
                          >
                            <RotateCcw className="size-3" />
                            Geri yükle
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
