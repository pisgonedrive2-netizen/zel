"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterChipItem = {
  id: string;
  label: string;
  count: number;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  chipCls?: string;
};

export function FilterChipBar({
  chips,
  value,
  onChange,
  ariaLabel,
  className,
  layout = "grid",
  columnsClass = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
}: {
  chips: FilterChipItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
  layout?: "grid" | "wrap";
  columnsClass?: string;
}) {
  const layoutCls =
    layout === "wrap"
      ? "flex flex-wrap gap-2"
      : cn("grid gap-2 sm:gap-3", columnsClass);

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(layoutCls, className)}>
      {chips.map((chip) => {
        const active = value === chip.id;
        const Icon = chip.icon;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(chip.id)}
            className={cn(
              "group relative rounded-xl border px-3 py-2.5 text-left transition-all duration-150 min-w-[7rem]",
              active
                ? "ring-2 ring-offset-1 ring-offset-background ring-foreground/30 shadow-sm"
                : "opacity-85 hover:opacity-100",
              chip.chipCls ?? "border-border bg-card hover:bg-accent/40 text-foreground"
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium">
                {Icon ? <Icon size={12} /> : null}
                <span className="truncate">{chip.label}</span>
              </span>
              {active ? <Check size={12} className="opacity-80 shrink-0" /> : null}
            </span>
            <span className="block text-2xl font-bold tabular-nums mt-0.5">{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}
