"use client";

import { Wallet } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  describeViewPoolBonusRules,
  fmtPrimUsd,
  type PrimPoolResult,
} from "@/lib/prim-pool";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { cn } from "@/lib/utils";

export function PrimWaterfall({ result }: { result: PrimPoolResult }) {
  const cfg = result.config;
  const poolRules = describeViewPoolBonusRules(cfg);
  const ratePct = Math.round((cfg.basePrimRate ?? 0.1) * 100);

  const steps: Array<{
    label: string;
    value: string;
    tone?: "neg" | "pos" | "strong" | "muted";
  }> = [
    { label: "Marka geliri (brüt)", value: fmtPrimUsd(result.totalRevenueUsd), tone: "strong" },
    { label: "− Bordro (maaş)", value: fmtPrimUsd(result.payrollUsd), tone: "neg" },
    { label: "− İçerik ödemeleri", value: fmtPrimUsd(result.contentExpenseUsd), tone: "neg" },
    { label: "= Kalan (taban prim bazı)", value: fmtPrimUsd(result.payrollContentNetUsd), tone: "strong" },
    { label: "− Genel giderler", value: fmtPrimUsd(result.generalExpenseUsd), tone: "neg" },
  ];

  if (result.manualExpenseUsd > 0) {
    steps.push({
      label: "− Reklam & elle eklenen",
      value: fmtPrimUsd(result.manualExpenseUsd),
      tone: "neg",
    });
  }

  steps.push(
    {
      label: "= Net kâr",
      value: fmtPrimUsd(result.netPoolUsd),
      tone: result.netPoolUsd < 0 ? "neg" : "strong",
    },
    {
      label: "− Sonraki aya ayrılan (rezerv)",
      value: fmtPrimUsd(result.reserveUsd),
      tone: "neg",
    },
    {
      label: "= Dağıtılabilir kâr",
      value: fmtPrimUsd(result.distributablePoolUsd),
      tone: "strong",
    },
    {
      label:
        cfg.basePrimMode === "fixed"
          ? `Taban prim (sabit)`
          : `Taban prim (%${ratePct} kalan)`,
      value: fmtPrimUsd(result.basePrimUsd),
      tone: "pos",
    }
  );

  if (result.poolBonusUsd > 0) {
    steps.push({
      label: "Havuz payı (izlenme)",
      value: fmtPrimUsd(result.poolBonusUsd),
      tone: "pos",
    });
  }
  if (result.viewBonusUsd > 0) {
    steps.push({
      label: "İzlenme CPM / çarpan bonusu",
      value: fmtPrimUsd(result.viewBonusUsd),
      tone: "pos",
    });
  }

  steps.push({
    label: "= Bu ay toplam prim",
    value: fmtPrimUsd(result.totalPrimUsd),
    tone: "strong",
  });

  if (result.cappedAmountUsd > 1) {
    steps.push({
      label: "↳ tavanla kırpılan",
      value: `− ${fmtPrimUsd(result.cappedAmountUsd)}`,
      tone: "muted",
    });
  }

  steps.push({
    label: "= Prim sonrası kâr",
    value: fmtPrimUsd(result.netAfterPrimUsd),
    tone: result.netAfterPrimUsd < 0 ? "neg" : "pos",
  });

  return (
    <Card id="prim-para-akisi" className="scroll-mt-36 border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet size={16} className="text-emerald-600" />
          Para akışı
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Gelir → gider → rezerv → taban + izlenme havuzu. İzlenme kuralı: {poolRules}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {result.brandRows.map((row) => (
            <div
              key={row.brandId}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
            >
              <BrandLogo brandId={row.brandId} title={row.brandName} className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.shortName}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {fmtCompactViews(row.actualViews)} izl.
              </span>
              <span className="w-20 text-right text-sm font-semibold tabular-nums">
                {fmtPrimUsd(row.monthlyFeeUsd)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-border/60 pt-3 text-xs">
          {steps.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-2 py-1.5",
                s.tone === "strong" && "bg-muted/40 font-semibold",
                s.tone === "pos" && "bg-emerald-500/5"
              )}
            >
              <span
                className={cn(
                  "text-muted-foreground",
                  (s.tone === "strong" || s.tone === "pos") && "text-foreground"
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  s.tone === "neg" && "text-rose-600 dark:text-rose-400",
                  s.tone === "pos" && "text-emerald-700 dark:text-emerald-300",
                  s.tone === "muted" && "text-muted-foreground",
                  s.tone === "strong" && "text-foreground"
                )}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
