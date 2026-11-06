"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listAvailableMonths, monthLabelTr } from "@/lib/month-label";
import { useStore, type ContentExpense } from "@/store/store";

type Props = {
  /** Taşıma sonrası store yenileme / sayfa reload önerisi. */
  onDone?: (result: {
    targetMonth: string;
    movedCount: number;
    movedIds: string[];
  }) => void;
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function OrkunFinanceTools({ onDone }: Props) {
  const contentExpenses = useStore((s) => s.contentExpenses);
  const months = useMemo(
    () => listAvailableMonths(contentExpenses.map((e) => e.month + "-01")),
    [contentExpenses]
  );

  const [sourceMonth, setSourceMonth] = useState("");
  const [targetMonth, setTargetMonth] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (months.length === 0) return;
    if (!sourceMonth || !months.includes(sourceMonth)) {
      setSourceMonth(months[0]);
    }
    if (!targetMonth || !months.includes(targetMonth)) {
      setTargetMonth(months[1] ?? months[0]);
    }
  }, [months, sourceMonth, targetMonth]);

  const sourceRows = useMemo(
    () =>
      contentExpenses
        .filter((e) => e.month === sourceMonth)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [contentExpenses, sourceMonth]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(sourceRows.map((r) => r.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const onSourceChange = (ym: string) => {
    setSourceMonth(ym);
    setSelected(new Set());
    setMessage(null);
    setError(null);
  };

  const submit = async () => {
    if (!targetMonth || selected.size === 0 || busy) return;
    if (sourceMonth === targetMonth) {
      setError("Kaynak ve hedef ay aynı olamaz.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/orkun/move-expense-month", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: [...selected],
          targetMonth,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        movedCount?: number;
        moved?: Array<{ id: string }>;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const movedIds = (json.moved ?? []).map((m) => m.id);
      const count = json.movedCount ?? movedIds.length;
      setMessage(
        `${count} harcama ${monthLabelTr(targetMonth)} ayına taşındı. Sayfayı yenilemeniz önerilir.`
      );
      setSelected(new Set());
      onDone?.({
        targetMonth,
        movedCount: count,
        movedIds,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ağ hatası");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3 gap-2">
        <CardTitle className="text-base inline-flex items-center gap-2">
          <ArrowRightLeft className="size-4" />
          Harcama ay taşıma
        </CardTitle>
        <CardDescription className="text-xs">
          Seçilen içerik harcamalarını (ve bağlı maaş masraflarını) başka bir aya
          taşır. Gün, hedef ayda yoksa ayın son gününe yazılır.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Kaynak ay
            <select
              className="h-8 min-w-[10rem] rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              value={sourceMonth}
              onChange={(e) => onSourceChange(e.target.value)}
              disabled={busy}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabelTr(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Hedef ay
            <select
              className="h-8 min-w-[10rem] rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              disabled={busy}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabelTr(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={selectAll}
            disabled={sourceRows.length === 0 || busy}
          >
            Tümünü seç ({sourceRows.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={clearSelection}
            disabled={selected.size === 0 || busy}
          >
            Seçimi temizle
          </Button>
          <span className="text-muted-foreground">
            {selected.size} seçili
          </span>
        </div>

        {sourceRows.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4">
            Bu ayda taşınacak harcama yok.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-border rounded-xl border border-border">
            {sourceRows.map((e) => (
              <ExpensePickRow
                key={e.id}
                expense={e}
                checked={selected.has(e.id)}
                disabled={busy}
                onToggle={() => toggle(e.id)}
              />
            ))}
          </ul>
        )}

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        )}

        <Button
          type="button"
          onClick={() => void submit()}
          disabled={busy || selected.size === 0 || !targetMonth}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowRightLeft className="size-3.5" />
          )}
          {selected.size} harcamayı taşı
        </Button>
      </CardContent>
    </Card>
  );
}

function ExpensePickRow({
  expense,
  checked,
  disabled,
  onToggle,
}: {
  expense: ContentExpense;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-muted/40">
        <input
          type="checkbox"
          className="mt-1 size-3.5 accent-primary"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium text-foreground">{expense.brandName}</span>
            <span className="text-xs text-muted-foreground">{expense.date}</span>
            <span className="text-xs font-medium text-foreground">
              {fmtUsd(expense.amountUsd)}
            </span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {expense.category}
            {expense.description ? ` · ${expense.description}` : ""}
          </span>
        </span>
      </label>
    </li>
  );
}
