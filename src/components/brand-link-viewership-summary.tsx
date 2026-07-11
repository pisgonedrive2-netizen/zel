"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Link2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BrandLink, LinkSnapshot } from "@/store/store";
import {
  computeBrandLinkViewershipStats,
  type BrandLinkViewershipStats,
} from "@/lib/brand-link-viewership-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";

function monthLabel(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
}

function BigMetric({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: "gain" | "total";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
          emphasis === "gain" && "text-emerald-700 dark:text-emerald-300",
          emphasis === "total" && "text-foreground",
          !emphasis && "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export interface BrandLinkViewershipSummaryProps {
  links: BrandLink[];
  snapshots: LinkSnapshot[];
  viewMonth: string;
  todayYm: string;
  title?: string;
  compact?: boolean;
  className?: string;
  /** Aylık breakdown ve link tablosu varsayılan açık */
  defaultTablesOpen?: boolean;
}

/**
 * Marka / admin izlenme — tüm linkler vs bu ay eklenen kohort.
 *
 * Önemli: Platform snapshot’ları kümülatiftir.
 * “Aylık izlenme” = ay içi artış (delta). “Toplam” = güncel kümülatif.
 * Ay sonu snapshot bakiyesi ayrıca küçük not olarak gösterilir (toplam ile karışmasın).
 */
export function BrandLinkViewershipSummary({
  links,
  snapshots,
  viewMonth,
  todayYm,
  title = "İzlenme metrikleri",
  compact = false,
  className,
  defaultTablesOpen = true,
}: BrandLinkViewershipSummaryProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(defaultTablesOpen && !compact);
  const [perLinkOpen, setPerLinkOpen] = useState(defaultTablesOpen && !compact);
  const stats: BrandLinkViewershipStats = useMemo(
    () => computeBrandLinkViewershipStats(links, snapshots, viewMonth, todayYm),
    [links, snapshots, viewMonth, todayYm]
  );

  if (stats.activeLinkCount === 0) return null;

  const monthName = monthLabel(viewMonth);
  const isCurrentMonth = viewMonth === todayYm;

  const content = (
    <div className="space-y-5">
      <p className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Snapshot’lar platformdaki <strong className="text-foreground">kümülatif</strong> view’dır.
        Bu yüzden {isCurrentMonth ? "bu ayın" : monthName + " ayının"} son bakiyesi toplam’a yakın
        görünebilir. Asıl <strong className="text-foreground">aylık izlenme</strong> = ay içi
        artış (önceki ay sonu → bu ay).
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-sky-500/8 via-background to-transparent p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <Link2 size={15} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-400">
                Tüm linkler
              </p>
              <p className="text-sm font-semibold text-foreground">
                Bugüne kadar eklenen · {stats.activeLinkCount} aktif
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BigMetric
              label={`${monthName} aylık izlenme`}
              value={`+${fmtCompactViews(stats.monthTotalGain)}`}
              hint="Ay içi artış (delta)"
              emphasis="gain"
            />
            <BigMetric
              label="Toplam izlenme"
              value={fmtCompactViews(stats.lifetimeTotalViews)}
              hint="Tüm linklerin güncel kümülatifi"
              emphasis="total"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5">
              <TrendingUp size={11} className="text-sky-600" />
              Ay sonu bakiyesi {fmtCompactViews(stats.monthTotalViews)}
              <span className="text-muted-foreground/70">(kümülatif snapshot)</span>
            </span>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-[#FF6B00]/25 bg-gradient-to-br from-[#FF6B00]/10 via-background to-transparent p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF6B00]/15 text-[#FF6B00]">
              <Sparkles size={15} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF6B00]">
                Bu ay eklenen linkler
              </p>
              <p className="text-sm font-semibold text-foreground">
                {monthName} · {stats.linksAddedInMonth} yeni link
              </p>
            </div>
          </div>
          {stats.linksAddedInMonth === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
              Bu ay henüz yeni link eklenmedi.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <BigMetric
                  label={`${monthName} aylık izlenme`}
                  value={`+${fmtCompactViews(stats.gainFromLinksAddedInMonth)}`}
                  hint="Yeni linklerin ay içi artışı"
                  emphasis="gain"
                />
                <BigMetric
                  label="Toplam izlenme"
                  value={fmtCompactViews(stats.cohortLifetimeViews)}
                  hint="Bu ay eklenenlerin bugüne kadar kümülatifi"
                  emphasis="total"
                />
              </div>
              <p className="mt-4 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                Yeni link payı: aylık artışta{" "}
                <strong className="text-foreground">
                  {stats.monthTotalGain > 0
                    ? Math.round(
                        (stats.gainFromLinksAddedInMonth / stats.monthTotalGain) * 100
                      )
                    : 0}
                  %
                </strong>
                , toplamda{" "}
                <strong className="text-foreground">
                  {stats.lifetimeTotalViews > 0
                    ? Math.round(
                        (stats.cohortLifetimeViews / stats.lifetimeTotalViews) * 100
                      )
                    : 0}
                  %
                </strong>
                {stats.viewsFromLinksAddedInMonth > 0 && (
                  <>
                    {" "}
                    · ay sonu bakiyesi {fmtCompactViews(stats.viewsFromLinksAddedInMonth)}
                  </>
                )}
              </p>
            </>
          )}
        </section>
      </div>

      {stats.engagement.interactions > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Etkileşim", value: stats.engagement.interactions },
            { label: "Beğeni", value: stats.engagement.likes },
            { label: "Yorum", value: stats.engagement.comments },
            { label: "Paylaşım", value: stats.engagement.shares },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-xl border border-border/70 bg-card/60 px-3 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {row.label}
              </p>
              <p className="text-lg font-bold tabular-nums">
                {fmtCompactViews(row.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {stats.monthlyBreakdown.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/30"
            onClick={() => setBreakdownOpen((o) => !o)}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Calendar size={14} className="text-muted-foreground" />
              Tüm linkler · aylık geçmiş
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "text-muted-foreground transition-transform",
                breakdownOpen && "rotate-180"
              )}
            />
          </button>
          {breakdownOpen && (
            <div className="max-h-56 overflow-y-auto border-t border-border/60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2 text-left font-medium">Ay</th>
                    <th className="px-3.5 py-2 text-right font-medium">Link</th>
                    <th className="px-3.5 py-2 text-right font-medium">
                      Aylık artış
                    </th>
                    <th className="px-3.5 py-2 text-right font-medium">
                      Ay sonu bakiye
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.monthlyBreakdown].reverse().map((row) => (
                    <tr
                      key={row.monthYm}
                      className={cn(
                        "border-t border-border/40",
                        row.monthYm === viewMonth && "bg-primary/5 font-medium"
                      )}
                    >
                      <td className="px-3.5 py-2">{monthLabel(row.monthYm)}</td>
                      <td className="px-3.5 py-2 text-right tabular-nums">
                        {row.linkCount}
                      </td>
                      <td className="px-3.5 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                        +{fmtCompactViews(row.totalGain)}
                      </td>
                      <td className="px-3.5 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtCompactViews(row.totalViews)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {stats.perLinkRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/30"
            onClick={() => setPerLinkOpen((o) => !o)}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <BarChart3 size={14} className="text-muted-foreground" />
              Link bazlı · aylık artış / ay sonu / toplam
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "text-muted-foreground transition-transform",
                perLinkOpen && "rotate-180"
              )}
            />
          </button>
          {perLinkOpen && (
            <div className="max-h-[min(55vh,420px)] overflow-auto border-t border-border/60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2 text-left font-medium">Link</th>
                    <th className="hidden px-3.5 py-2 text-left font-medium sm:table-cell">
                      Eklendi
                    </th>
                    <th className="px-3.5 py-2 text-right font-medium">
                      Aylık artış
                    </th>
                    <th className="px-3.5 py-2 text-right font-medium">
                      Ay sonu
                    </th>
                    <th className="px-3.5 py-2 text-right font-medium">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perLinkRows.map((row) => {
                    const isNew = row.addedMonthYm === viewMonth;
                    return (
                      <tr
                        key={row.linkId}
                        className={cn(
                          "border-t border-border/40 align-top",
                          isNew && "bg-[#FF6B00]/5"
                        )}
                      >
                        <td className="max-w-[11rem] px-3.5 py-2">
                          <p className="truncate font-medium" title={row.title}>
                            {row.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.platform}
                            {isNew && (
                              <span className="ml-1 font-semibold text-[#FF6B00]">
                                · yeni
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="hidden whitespace-nowrap px-3.5 py-2 text-muted-foreground sm:table-cell">
                          {row.addedMonthYm ? monthLabel(row.addedMonthYm) : "—"}
                        </td>
                        <td className="px-3.5 py-2 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                          +{fmtCompactViews(row.monthGain)}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums text-muted-foreground">
                          {fmtCompactViews(row.monthViews)}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums">
                          {fmtCompactViews(row.lifetimeViews)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (compact) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 size={15} className="text-sky-600 dark:text-sky-400" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">
          Sol / sağ: <strong>aylık = ay içi artış</strong>, <strong>toplam = kümülatif</strong>.
          Kartlardaki “Marka linkleri” rakamı ay sonu bakiyesidir (hedef takibi).
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
