"use client";

import { cn } from "@/lib/utils";

export type TrendRangeMonths = 3 | 6 | 12 | 24;
export type TrendGranularity = "month" | "day";

const RANGE_OPTIONS: { value: TrendRangeMonths; label: string }[] = [
  { value: 3, label: "3 ay" },
  { value: 6, label: "6 ay" },
  { value: 12, label: "12 ay" },
  { value: 24, label: "1 yıl" },
];

export function TrendRangeBar({
  rangeMonths,
  onRangeMonthsChange,
  granularity,
  onGranularityChange,
  showDaily = true,
  className,
}: {
  rangeMonths: TrendRangeMonths;
  onRangeMonthsChange: (v: TrendRangeMonths) => void;
  granularity?: TrendGranularity;
  onGranularityChange?: (v: TrendGranularity) => void;
  showDaily?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onRangeMonthsChange(opt.value);
              if (granularity === "day" && onGranularityChange) {
                onGranularityChange("month");
              }
            }}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              rangeMonths === opt.value && granularity !== "day"
                ? "bg-background text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showDaily && onGranularityChange && (
        <button
          type="button"
          onClick={() =>
            onGranularityChange(granularity === "day" ? "month" : "day")
          }
          className={cn(
            "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
            granularity === "day"
              ? "border-violet-500/50 bg-violet-500/15 text-violet-900 dark:text-violet-100"
              : "border-border text-muted-foreground hover:bg-accent"
          )}
        >
          Günlük (seçili ay)
        </button>
      )}
    </div>
  );
}
