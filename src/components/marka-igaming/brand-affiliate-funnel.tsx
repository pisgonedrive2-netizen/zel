"use client";

import { ArrowRight, MousePointerClick, UserPlus, Target } from "lucide-react";
import { fmtBrandCount } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  clicks: number;
  registrations: number;
  ftd: number;
  /** 30g retention — veri yoksa opsiyonel. */
  retention30?: number;
  monthTitle?: string;
};

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `%${((part / whole) * 100).toFixed(1)}`;
}

export function BrandAffiliateFunnel({
  clicks,
  registrations,
  ftd,
  retention30,
  monthTitle,
}: Props) {
  const steps = [
    {
      label: "Tıklama",
      value: fmtCompactViews(clicks),
      raw: clicks,
      icon: MousePointerClick,
      color: "from-pink-500/20 to-fuchsia-500/10 border-pink-200/60 dark:border-pink-500/30",
    },
    {
      label: "Kayıt",
      value: fmtBrandCount(registrations),
      raw: registrations,
      icon: UserPlus,
      color: "from-violet-500/20 to-purple-500/10 border-violet-200/60 dark:border-violet-500/30",
      conv: pct(registrations, clicks),
    },
    {
      label: "FTD",
      value: fmtBrandCount(ftd),
      raw: ftd,
      icon: Target,
      color: "from-emerald-500/20 to-green-500/10 border-emerald-200/60 dark:border-emerald-500/30",
      conv: pct(ftd, registrations),
    },
  ];

  const maxRaw = Math.max(clicks, registrations, ftd, 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Affiliate funnel</CardTitle>
        <CardDescription>
          Tıklama → kayıt → FTD
          {monthTitle ? ` · ${monthTitle}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const widthPct = Math.max(8, (step.raw / maxRaw) * 100);
            return (
              <div key={step.label} className="flex flex-1 items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "flex-1 rounded-lg border bg-gradient-to-br px-3 py-2.5",
                    step.color
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Icon size={12} />
                    {step.label}
                  </div>
                  <p className="text-xl font-bold tabular-nums mt-0.5">{step.value}</p>
                  {step.conv && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Dönüşüm: {step.conv}
                    </p>
                  )}
                  <div className="mt-2 h-1.5 rounded-full bg-muted/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight
                    size={16}
                    className="hidden sm:block shrink-0 text-muted-foreground/50"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>

        {retention30 != null && retention30 > 0 && (
          <p className="text-xs text-muted-foreground border-t border-border/60 pt-2">
            30g retention:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {fmtBrandCount(retention30)}
            </span>
          </p>
        )}

        {clicks === 0 && registrations === 0 && ftd === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Bu ay affiliate istatistiği yok. Partner ekleyip günlük veri girin.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
