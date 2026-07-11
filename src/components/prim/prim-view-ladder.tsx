"use client";

import { Eye, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  describeViewPoolBonusRules,
  fmtPrimUsd,
  projectMonthEndViews,
  type PrimPoolResult,
} from "@/lib/prim-pool";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { cn } from "@/lib/utils";

type Props = {
  result: PrimPoolResult;
  /** 0–1 ay ilerlemesi */
  progress: number;
};

export function PrimViewLadder({ result, progress }: Props) {
  const cfg = result.config;
  const min = cfg.viewPoolBonusMinViews ?? 0;
  const stepViews = cfg.viewPoolBonusThresholdViews || 1_000_000;
  const current = result.totalActualViews;
  const billable = result.viewPoolBonusBillableViews;
  const projected =
    progress > 0 && progress < 1
      ? projectMonthEndViews(current, progress)
      : null;

  const gatePct =
    min > 0 ? Math.min(100, (current / min) * 100) : current > 0 ? 100 : 0;
  const gatePassed = min <= 0 || current >= min;

  const tiers = cfg.viewPoolBonusTiers?.length
    ? cfg.viewPoolBonusTiers
    : [{ upToBillableViews: Infinity, perStepUsd: cfg.viewPoolBonusPerStepUsd, maxSteps: undefined }];

  // Visual ladder steps: show first ~8 potential steps after gate
  const ladder: Array<{ from: number; to: number; usd: number; earned: boolean }> = [];
  let cursor = 0;
  for (const tier of tiers) {
    const capViews =
      tier.upToBillableViews === Infinity ? stepViews * 20 : tier.upToBillableViews;
    const maxSteps =
      tier.maxSteps ??
      Math.max(1, Math.ceil((capViews - cursor) / stepViews));
    for (let i = 0; i < Math.min(maxSteps, 8 - ladder.length); i++) {
      const from = min + cursor;
      const to = from + stepViews;
      cursor += stepViews;
      const earned = billable >= cursor;
      ladder.push({ from, to, usd: tier.perStepUsd, earned });
      if (ladder.length >= 8) break;
      if (tier.upToBillableViews !== Infinity && cursor >= tier.upToBillableViews) break;
    }
    if (ladder.length >= 8) break;
  }

  return (
    <Card id="prim-izlenme" className="scroll-mt-36 border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye size={16} className="text-sky-600" />
          İzlenme merdiveni
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {cfg.viewPoolBonusEnabled
            ? describeViewPoolBonusRules(cfg)
            : "İzlenme havuz bonusu kapalı — yalnızca taban prim."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Bu ay toplam izlenme
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {fmtCompactViews(current)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Garanti toplam {fmtCompactViews(result.totalGuaranteedViews)}
              {projected != null && (
                <> · ay sonu projeksiyon ~{fmtCompactViews(projected)}</>
              )}
            </p>
          </div>
          <Badge
            variant={gatePassed ? "default" : "outline"}
            className="gap-1"
          >
            <TrendingUp size={12} />
            {result.viewPoolBonusSteps} adım · {fmtPrimUsd(result.poolBonusUsd)}
          </Badge>
        </div>

        {cfg.viewPoolBonusEnabled && min > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">
                Baraj {fmtCompactViews(min)}
              </span>
              <span className="font-medium tabular-nums">
                {Math.round(gatePct)}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  gatePassed
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-amber-500 to-sky-500"
                )}
                style={{ width: `${gatePct}%` }}
              />
            </div>
          </div>
        )}

        {cfg.viewPoolBonusEnabled && ladder.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {ladder.map((step, i) => (
              <div
                key={`${step.from}-${i}`}
                className={cn(
                  "rounded-xl border px-2.5 py-2 text-center",
                  step.earned
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-border/60 bg-muted/15"
                )}
              >
                <p className="text-[9px] font-semibold uppercase text-muted-foreground">
                  Adım {i + 1}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {fmtCompactViews(step.from)}→{fmtCompactViews(step.to)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm font-bold tabular-nums",
                    step.earned
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-foreground/50"
                  )}
                >
                  +{fmtPrimUsd(step.usd)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
