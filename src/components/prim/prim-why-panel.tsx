"use client";

import { useState } from "react";
import { Target, ChevronDown, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PrimRuleLine, PrimScenarioRow } from "@/lib/prim-pool";
import { cn } from "@/lib/utils";

type Props = {
  formula: string;
  rules: PrimRuleLine[];
  scenarios: PrimScenarioRow[];
};

export function PrimWhyPanel({ formula, rules, scenarios }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <Card id="prim-neden" className="scroll-mt-36 border-blue-500/25 bg-blue-500/[0.03]">
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target size={16} className="text-blue-600" />
              Bu ay neden bu kadar?
            </CardTitle>
            <CardDescription className="mt-1 text-xs">{formula}</CardDescription>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "mt-1 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <ol className="relative space-y-0 border-l border-border/70 ml-2">
            {scenarios.map((row, i) => (
              <li key={`${row.when}-${i}`} className="relative pb-4 pl-5 last:pb-0">
                <span
                  className={cn(
                    "absolute -left-1.5 top-1 flex h-3 w-3 items-center justify-center rounded-full",
                    row.active ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{row.when}</p>
                    <p className="text-[11px] text-muted-foreground">{row.then}</p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-bold tabular-nums",
                      row.active
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground"
                    )}
                  >
                    {row.amount}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {rules.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {rules.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="flex gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5"
                >
                  {r.status === "ok" ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {r.step}. {r.title}
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {r.description}
                    </p>
                    {r.value && (
                      <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                        {r.value}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
