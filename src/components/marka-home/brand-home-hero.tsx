"use client";

import Link from "next/link";
import { ArrowRight, Target, TrendingUp } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import {
  fmtBrandCount,
  fmtBrandMoney,
  type BrandStatsCurrency,
} from "@/lib/brand-monthly-stats";
import { cn } from "@/lib/utils";

interface BrandHomeHeroProps {
  brandId: string;
  brandName: string;
  shortName?: string;
  monthYm: string;
  monthTitle: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Aylık FTD/yatırım hedefi (varsa). */
  target?: number;
  /** Bu ay gerçekleşen toplam yatırım. */
  actual: number;
  /** Bu ay FTD adedi. */
  ftd: number;
  /** Para birimi. */
  currency: BrandStatsCurrency;
  /** "Aylık KPI gir" rotası — operasyon sayfası. */
  kpiHref: string;
  /** Operasyon verisi yokken CTA göster. */
  showEmptyHint?: boolean;
}

export function BrandHomeHero({
  brandId,
  brandName,
  shortName,
  monthYm,
  monthTitle,
  onPrevMonth,
  onNextMonth,
  target,
  actual,
  ftd,
  currency,
  kpiHref,
  showEmptyHint,
}: BrandHomeHeroProps) {
  const hasTarget = !!target && target > 0;
  const pct = hasTarget ? Math.min(100, (actual / target!) * 100) : null;
  const overTarget = hasTarget && actual > target!;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-r from-[#FF6B00]/15 via-[#EC4899]/8 to-[#22C55E]/15 opacity-80 dark:from-[#FF6B00]/20 dark:via-[#EC4899]/10 dark:to-[#22C55E]/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#FF6B00]/25 blur-3xl dark:bg-[#FF6B00]/35"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -bottom-16 h-40 w-40 rounded-full bg-[#22C55E]/15 blur-3xl dark:bg-[#22C55E]/25"
      />

      <div className="relative z-10 flex flex-col gap-5 p-5 lg:flex-row lg:items-stretch lg:p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo
              brandId={brandId}
              title={brandName}
              size={56}
              className="rounded-xl shadow-md ring-1 ring-[#FF6B00]/40"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FF6B00] dark:text-[#FF9A4D]">
                Marka anasayfası
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
                {brandName}
              </h1>
              {shortName && shortName !== brandName && (
                <p className="text-xs text-muted-foreground">{shortName}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MarkaMonthNav
              month={monthYm}
              onPrev={onPrevMonth}
              onNext={onNextMonth}
            />
            <Link
              href={kpiHref}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FF6B00] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#FF6B00]/90 hover:shadow-[0_0_18px_-4px_rgba(255,107,0,0.7)]"
            >
              Aylık KPI gir
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4 backdrop-blur-sm lg:w-[320px]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Target size={12} className="text-[#22C55E]" />
              Aylık yatırım hedefi
            </span>
            <span className="text-[10px] text-muted-foreground">{monthTitle}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  overTarget
                    ? "text-[#22C55E] dark:text-[#4ADE80]"
                    : "text-foreground"
                )}
              >
                {fmtBrandMoney(actual, currency)}
              </span>
              {hasTarget && (
                <span className="text-[11px] text-muted-foreground">
                  / {fmtBrandMoney(target!, currency)}
                </span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
              {hasTarget ? (
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    overTarget
                      ? "bg-[#22C55E]"
                      : "bg-gradient-to-r from-[#FF6B00] via-[#EC4899] to-[#22C55E]"
                  )}
                  style={{ width: `${pct ?? 0}%` }}
                />
              ) : (
                <div className="h-full w-1/12 rounded-full bg-muted-foreground/40" />
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {hasTarget
                  ? `${(pct ?? 0).toFixed(0)}% hedefin`
                  : showEmptyHint
                    ? "Bu ay için KPI girilmedi"
                    : "Hedef tanımlı değil"}
              </span>
              <span className="inline-flex items-center gap-1">
                <TrendingUp size={10} className="text-[#FF6B00]" />
                {fmtBrandCount(ftd)} FTD
              </span>
            </div>
            {showEmptyHint && (
              <p className="text-[11px] text-amber-800 dark:text-amber-200 border-t border-border/50 pt-2 mt-1">
                Operasyon verisi henüz yok —{" "}
                <Link href={kpiHref} className="font-semibold text-primary underline">
                  aylık KPI girin
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
