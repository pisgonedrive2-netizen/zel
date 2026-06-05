"use client";

import {
  Coins,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { computeDelta } from "@/lib/brand-igaming-metrics";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import type { BrandStatsCurrency } from "@/lib/brand-monthly-stats";
import type { ExecutiveKpiSnapshot } from "@/types/brand-igaming";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  monthTitle: string;
  currency?: BrandStatsCurrency;
  current: ExecutiveKpiSnapshot;
  previous?: ExecutiveKpiSnapshot | null;
  loading?: boolean;
};

const KPI_DEFS: {
  key: keyof ExecutiveKpiSnapshot;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  money?: boolean;
  invertDelta?: boolean;
}[] = [
  { key: "ftd", label: "FTD", icon: Target, accent: "text-violet-700 dark:text-violet-300" },
  {
    key: "activePlayers",
    label: "Aktif oyuncu",
    icon: Users,
    accent: "text-blue-700 dark:text-blue-300",
  },
  {
    key: "depositAmount",
    label: "Yatırım",
    icon: TrendingUp,
    accent: "text-emerald-700 dark:text-emerald-300",
    money: true,
  },
  {
    key: "withdrawalAmount",
    label: "Çekim",
    icon: TrendingDown,
    accent: "text-amber-700 dark:text-amber-300",
    money: true,
    invertDelta: true,
  },
  {
    key: "ngr",
    label: "NGR",
    icon: Coins,
    accent: "text-emerald-700 dark:text-emerald-300",
    money: true,
  },
  {
    key: "commission",
    label: "Komisyon",
    icon: Wallet,
    accent: "text-pink-700 dark:text-pink-300",
    money: true,
    invertDelta: true,
  },
];

function DeltaBadge({
  current,
  previous,
  invert,
}: {
  current: number;
  previous?: number;
  invert?: boolean;
}) {
  const delta = previous != null ? computeDelta(current, previous) : null;
  if (!delta) {
    return <span className="text-[11px] text-muted-foreground tabular-nums">—</span>;
  }
  if (delta.direction === "flat") {
    return (
      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
        <Minus size={11} /> 0%
      </span>
    );
  }
  const isGood = invert ? delta.direction === "down" : delta.direction === "up";
  const Icon = delta.direction === "up" ? TrendingUp : TrendingDown;
  const color = isGood
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-red-700 dark:text-red-300";
  const label =
    delta.pct != null ? `${delta.pct >= 0 ? "+" : ""}${delta.pct.toFixed(0)}%` : "—";
  return (
    <span className={cn("text-[11px] font-medium inline-flex items-center gap-0.5 tabular-nums", color)}>
      <Icon size={11} />
      {label}
    </span>
  );
}

export function BrandExecutiveKpis({
  monthTitle,
  currency = "USD",
  current,
  previous,
  loading,
}: Props) {
  return (
    <Card className="border-violet-200/50 dark:border-violet-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target size={16} className="text-violet-700 dark:text-violet-300" />
          iGaming executive özeti
        </CardTitle>
        <CardDescription>
          {monthTitle} · önceki aya göre Δ% {loading ? "(yükleniyor…)" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {KPI_DEFS.map(({ key, label, icon: Icon, accent, money, invertDelta }) => {
            const value = current[key];
            const prev = previous?.[key];
            return (
              <div
                key={key}
                className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Icon size={11} className={accent} />
                  {label}
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {money ? fmtBrandMoney(value, currency) : fmtBrandCount(value)}
                  </p>
                  <DeltaBadge current={value} previous={prev} invert={invertDelta} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
