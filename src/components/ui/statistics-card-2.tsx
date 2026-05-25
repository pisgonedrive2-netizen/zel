"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";

// ── Mini sparkline (inline CSS bars, zero deps) ────────────────────────────
function Sparkline({ values, trend }: { values: number[]; trend: "up" | "down" | "neutral" }) {
  const max = Math.max(...values, 1);
  const color =
    trend === "up" ? "bg-emerald-500" : trend === "down" ? "bg-red-400" : "bg-muted-foreground/30";
  return (
    <div className="flex items-end gap-[2px] h-7">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("w-[3px] rounded-sm transition-all duration-300", color)}
          style={{ height: `${Math.max(8, Math.round((v / max) * 28))}px`, opacity: 0.45 + (i / values.length) * 0.55 }}
        />
      ))}
    </div>
  );
}

// ── Trend badge ────────────────────────────────────────────────────────────
function TrendBadge({
  trend,
  label,
}: {
  trend: "up" | "down" | "neutral";
  label?: string;
}) {
  if (!label) return null;
  const Icon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        trend === "up" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        trend === "down" && "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
        trend === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      <Icon size={9} />
      {label}
    </span>
  );
}

// ── Statistics Card ────────────────────────────────────────────────────────
export interface StatisticsCard2Props {
  title: string;
  value: string;
  /** Small description under the value */
  description?: string;
  /** Trend direction */
  trend?: "up" | "down" | "neutral";
  /** Text shown in the badge, e.g. "+4.2%" or "3 kişi" */
  trendLabel?: string;
  /** Lucide icon component */
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  /** Sparkline data (8–12 numbers) */
  sparkline?: number[];
  delay?: number;
  className?: string;
  /** Büyük sayılar için daha küçük punto (ör. 62M izlenme). */
  valueClassName?: string;
}

export function StatisticsCard2({
  title,
  value,
  description,
  trend = "neutral",
  trendLabel,
  icon: Icon,
  sparkline,
  delay = 0,
  className,
  valueClassName,
}: StatisticsCard2Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: "easeOut" }}
      className={cn(
        "group relative flex flex-col justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 pt-4 pb-3 overflow-hidden transition-shadow hover:shadow-sm",
        className,
      )}
    >
      {/* Subtle accent strip at top */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[2px] rounded-t-xl transition-opacity",
          trend === "up" && "bg-emerald-500/70",
          trend === "down" && "bg-red-400/70",
          trend === "neutral" && "bg-border/40",
        )}
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground leading-snug">{title}</p>
        {Icon && (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/8 border border-primary/12">
            <Icon size={12} className="text-primary/80" />
          </div>
        )}
      </div>

      {/* Value + badge */}
      <div className="flex items-end justify-between gap-2">
        <p
          className={cn(
            "font-bold tabular-nums tracking-tight text-foreground leading-none",
            valueClassName ?? "text-2xl"
          )}
        >
          {value}
        </p>
        <TrendBadge trend={trend} label={trendLabel} />
      </div>

      {/* Sparkline OR description */}
      {sparkline && sparkline.length > 1 ? (
        <Sparkline values={sparkline} trend={trend} />
      ) : description ? (
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{description}</p>
      ) : null}
    </motion.div>
  );
}
