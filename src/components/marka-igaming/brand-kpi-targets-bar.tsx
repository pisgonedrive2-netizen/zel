"use client";

import { Gauge } from "lucide-react";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import type { BrandStatsCurrency } from "@/lib/brand-monthly-stats";
import type { BrandKpiTarget } from "@/types/brand-igaming";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Actuals = {
  ftd: number;
  ngr: number;
  depositAmount: number;
  registrations: number;
  contentDeliveries?: number;
};

type Props = {
  monthTitle: string;
  currency?: BrandStatsCurrency;
  targets: Partial<
    Pick<
      BrandKpiTarget,
      | "targetFtd"
      | "targetNgr"
      | "targetRegistrations"
      | "targetDepositAmount"
      | "targetContentDeliveries"
    >
  > | null;
  actual: Actuals;
};

type BarDef = {
  label: string;
  target: number;
  actual: number;
  money?: boolean;
};

function progressPct(actual: number, target: number): number {
  if (target <= 0) return actual > 0 ? 100 : 0;
  return Math.min(100, Math.round((actual / target) * 100));
}

function TargetBar({
  label,
  target,
  actual,
  money,
  currency,
}: BarDef & { currency: BrandStatsCurrency }) {
  const pct = progressPct(actual, target);
  const fmt = (n: number) => (money ? fmtBrandMoney(n, currency) : fmtBrandCount(n));
  const onTrack = target <= 0 ? actual > 0 : actual >= target;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {fmt(actual)} / {target > 0 ? fmt(target) : "—"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            onTrack ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground tabular-nums">%{pct} gerçekleşme</p>
    </div>
  );
}

export function BrandKpiTargetsBar({
  monthTitle,
  currency = "USD",
  targets,
  actual,
}: Props) {
  const bars: BarDef[] = [
    {
      label: "FTD hedefi",
      target: targets?.targetFtd ?? 0,
      actual: actual.ftd,
    },
    {
      label: "NGR hedefi",
      target: targets?.targetNgr ?? 0,
      actual: actual.ngr,
      money: true,
    },
    {
      label: "Yatırım hedefi",
      target: targets?.targetDepositAmount ?? 0,
      actual: actual.depositAmount,
      money: true,
    },
    {
      label: "Kayıt hedefi",
      target: targets?.targetRegistrations ?? 0,
      actual: actual.registrations,
    },
  ];

  if (targets?.targetContentDeliveries) {
    bars.push({
      label: "İçerik teslim",
      target: targets.targetContentDeliveries,
      actual: actual.contentDeliveries ?? 0,
    });
  }

  const hasAnyTarget = bars.some((b) => b.target > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge size={16} className="text-violet-700 dark:text-violet-300" />
          Hedef vs gerçekleşen
        </CardTitle>
        <CardDescription>{monthTitle} · brand_kpi_targets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAnyTarget ? (
          <p className="text-sm text-muted-foreground py-2">
            Bu ay için KPI hedefi tanımlanmamış. Operasyon sayfasından veya API üzerinden hedef
            girebilirsiniz.
          </p>
        ) : (
          bars
            .filter((b) => b.target > 0)
            .map((b) => (
              <TargetBar key={b.label} {...b} currency={currency} />
            ))
        )}
      </CardContent>
    </Card>
  );
}
