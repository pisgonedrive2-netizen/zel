"use client";

import { Trophy, ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtPrimUsd } from "@/lib/prim-pool";
import { cn } from "@/lib/utils";

type Props = {
  monthLabel: string;
  formula: string;
  totalPrimUsd: number;
  reserveUsd: number;
  netAfterPrimUsd: number;
  simpleView: boolean;
  onToggleSimple: () => void;
  onReset: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function PrimDecisionStrip({
  monthLabel,
  formula,
  totalPrimUsd,
  reserveUsd,
  netAfterPrimUsd,
  simpleView,
  onToggleSimple,
  onReset,
  onPrevMonth,
  onNextMonth,
}: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-1 mb-4 space-y-3 rounded-2xl border border-amber-500/25 bg-background/95 p-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/90 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <Trophy size={22} className="text-amber-500" />
              Prim Havuzu
            </h1>
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-800 dark:text-amber-200"
            >
              <Shield size={10} />
              Yalnızca Orkun · bu tarayıcı
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{formula}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={simpleView ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={onToggleSimple}
            title={simpleView ? "Gelişmiş ayarları göster" : "Sadece özet göster"}
          >
            <SlidersHorizontal size={13} />
            {simpleView ? "Basit" : "Detaylı"}
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={onReset}>
            <RotateCcw size={13} /> Sıfırla
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevMonth}>
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-[110px] text-center text-sm font-semibold tabular-nums">
              {monthLabel}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextMonth}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Kpi
          label="Bu ay prim"
          value={fmtPrimUsd(totalPrimUsd)}
          tone="amber"
        />
        <Kpi
          label="Sonraki aya ayrılan"
          value={fmtPrimUsd(reserveUsd)}
          tone="default"
        />
        <Kpi
          label="Prim sonrası kâr"
          value={fmtPrimUsd(netAfterPrimUsd)}
          tone={netAfterPrimUsd < 0 ? "rose" : "emerald"}
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "emerald" | "rose" | "default";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        tone === "amber" && "border-amber-500/30 bg-amber-500/10",
        tone === "emerald" && "border-emerald-500/30 bg-emerald-500/10",
        tone === "rose" && "border-rose-500/30 bg-rose-500/10",
        tone === "default" && "border-border/70 bg-muted/20"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums tracking-tight",
          tone === "amber" && "text-amber-700 dark:text-amber-300",
          tone === "emerald" && "text-emerald-700 dark:text-emerald-300",
          tone === "rose" && "text-rose-700 dark:text-rose-300",
          tone === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
