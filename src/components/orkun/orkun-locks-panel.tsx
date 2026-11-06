"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Lock, LockOpen, RefreshCw, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fetchLockedContentExpenseMonths,
  setContentExpenseMonthLocked,
} from "@/lib/content-expense-month-lock";
import {
  fetchPrimPoolLocked,
  setPrimPoolLocked,
} from "@/lib/prim-pool-lock";
import { listAvailableMonths, monthLabelTr } from "@/lib/month-label";
import { useStore } from "@/store/store";
import { logAudit } from "@/store/audit-log";
import { useAuth } from "@/store/auth";

type Props = {
  /** Kilitleme sonrası ek yenileme (isteğe bağlı). */
  onChanged?: (lockedMonths: string[]) => void;
};

export function OrkunLocksPanel({ onChanged }: Props) {
  const { user } = useAuth();
  const contentExpenses = useStore((s) => s.contentExpenses);
  const [lockedMonths, setLockedMonths] = useState<string[]>([]);
  const [primLocked, setPrimLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyYm, setBusyYm] = useState<string | null>(null);
  const [primBusy, setPrimBusy] = useState(false);
  const [lockYm, setLockYm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [months, prim] = await Promise.all([
      fetchLockedContentExpenseMonths(),
      fetchPrimPoolLocked(),
    ]);
    setLockedMonths(months);
    setPrimLocked(prim);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const monthOptions = useMemo(() => {
    const fromExpenses = listAvailableMonths(
      contentExpenses.map((e) => e.month + "-01")
    );
    return fromExpenses.filter((m) => !lockedMonths.includes(m));
  }, [contentExpenses, lockedMonths]);

  useEffect(() => {
    if (!lockYm && monthOptions[0]) setLockYm(monthOptions[0]);
    if (lockYm && !monthOptions.includes(lockYm) && monthOptions[0]) {
      setLockYm(monthOptions[0]);
    }
  }, [lockYm, monthOptions]);

  const toggle = async (monthYm: string, locked: boolean) => {
    if (busyYm) return;
    setBusyYm(monthYm);
    setError(null);
    const res = await setContentExpenseMonthLocked(monthYm, locked);
    setBusyYm(null);
    if (!res.ok) {
      setError(res.error ?? "Kilit güncellenemedi");
      return;
    }
    setLockedMonths(res.lockedMonths);
    onChanged?.(res.lockedMonths);
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_month_lock",
      detail: `${locked ? "kilit" : "aç"} · ${monthYm} · orkun-panel`,
    });
  };

  const togglePrim = async (locked: boolean) => {
    if (primBusy) return;
    setPrimBusy(true);
    setError(null);
    const res = await setPrimPoolLocked(locked);
    setPrimBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Prim kilidi güncellenemedi");
      return;
    }
    setPrimLocked(res.locked);
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_month_lock",
      detail: `prim-pool · ${locked ? "kilit" : "aç"} · orkun-panel`,
    });
  };

  return (
    <div className="space-y-3">
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Trophy className="size-4" />
                Prim kilidi
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Kilitliyken diğer adminler prim havuzunu değiştiremez; Orkun her zaman override edebilir.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                primLocked
                  ? "text-[10px] text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-200 dark:border-amber-500/40 dark:bg-amber-950/40"
                  : "text-[10px] text-emerald-800 border-emerald-300 bg-emerald-50 dark:text-emerald-200 dark:border-emerald-500/40 dark:bg-emerald-950/40"
              }
            >
              {primLocked ? "Kilitli" : "Açık"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={primLocked ? "outline" : "default"}
            disabled={primBusy || loading}
            onClick={() => void togglePrim(true)}
          >
            {primBusy && !primLocked ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Lock className="size-3.5" />
            )}
            Kilitle
          </Button>
          <Button
            type="button"
            size="sm"
            variant={primLocked ? "default" : "outline"}
            disabled={primBusy || loading || !primLocked}
            onClick={() => void togglePrim(false)}
          >
            {primBusy && primLocked ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LockOpen className="size-3.5" />
            )}
            Kilidi aç
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Lock className="size-4" />
                Ay kilitleri
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Kilitliyken diğer adminler yazamaz; Orkun bu panelden açabilir veya override ile yazabilir.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Ay kilitle
              <select
                className="h-8 min-w-[10rem] rounded-lg border border-border bg-background px-2 text-sm text-foreground"
                value={lockYm}
                onChange={(e) => setLockYm(e.target.value)}
                disabled={monthOptions.length === 0 || !!busyYm}
              >
                {monthOptions.length === 0 ? (
                  <option value="">Kilitlenecek ay yok</option>
                ) : (
                  monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {monthLabelTr(m)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={!lockYm || !!busyYm}
              onClick={() => void toggle(lockYm, true)}
            >
              {busyYm === lockYm ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Lock className="size-3.5" />
              )}
              Kilitle
            </Button>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Kilitler yükleniyor…
            </p>
          ) : lockedMonths.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4">
              Kilitli ay yok. İçerik harcaması aylarını buradan kilitleyebilirsiniz.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {lockedMonths.map((m) => (
                <li
                  key={m}
                  className="flex items-center justify-between gap-2 bg-card px-3 py-2.5 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {monthLabelTr(m)}
                    <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                      {m}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!!busyYm}
                    onClick={() => void toggle(m, false)}
                  >
                    {busyYm === m ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <LockOpen className="size-3.5" />
                    )}
                    Kilidi aç
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
