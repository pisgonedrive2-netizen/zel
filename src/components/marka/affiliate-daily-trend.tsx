"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Affiliate günlük FTD mini trend (sparkline benzeri). */
export function AffiliateDailyTrend({
  dailyFtd,
  className,
}: {
  dailyFtd: { date: string; ftd: number }[];
  className?: string;
}) {
  const max = useMemo(
    () => Math.max(1, ...dailyFtd.map((d) => d.ftd)),
    [dailyFtd]
  );

  if (dailyFtd.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground py-4 text-center", className)}>
        Bu ay için günlük FTD kaydı yok.
      </p>
    );
  }

  return (
    <div className={cn("flex items-end gap-0.5 h-16", className)}>
      {dailyFtd.map((d) => (
        <div
          key={d.date}
          className="group flex-1 min-w-[4px] flex flex-col items-center justify-end"
          title={`${d.date}: ${d.ftd} FTD`}
        >
          <div
            className="w-full rounded-t bg-emerald-500/70 dark:bg-emerald-400/60 transition-all group-hover:bg-emerald-600"
            style={{ height: `${Math.max(4, (d.ftd / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
