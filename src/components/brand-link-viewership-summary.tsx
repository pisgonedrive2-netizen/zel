"use client";

import { useMemo, useState } from "react";
import { BarChart3, Calendar, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BrandLink, LinkSnapshot } from "@/store/store";
import {
  computeBrandLinkViewershipStats,
  type BrandLinkViewershipStats,
} from "@/lib/brand-link-viewership-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";

function monthLabel(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "blue" | "violet" | "emerald" | "amber" | "rose";
}) {
  const border =
    accent === "blue"
      ? "border-blue-300/60 bg-blue-50/40 dark:border-blue-500/35 dark:bg-blue-950/20"
      : accent === "violet"
        ? "border-violet-300/60 bg-violet-50/40 dark:border-violet-500/35 dark:bg-violet-950/20"
        : accent === "emerald"
          ? "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-500/35 dark:bg-emerald-950/20"
          : accent === "amber"
            ? "border-amber-300/60 bg-amber-50/40 dark:border-amber-500/35 dark:bg-amber-950/20"
            : accent === "rose"
              ? "border-rose-300/60 bg-rose-50/40 dark:border-rose-500/35 dark:bg-rose-950/20"
              : "border-border bg-card/60";
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 min-w-0", border)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className="text-lg sm:text-xl font-bold tabular-nums truncate">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
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
}

export function BrandLinkViewershipSummary({
  links,
  snapshots,
  viewMonth,
  todayYm,
  title = "Link izlenme özeti",
  compact = false,
  className,
}: BrandLinkViewershipSummaryProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(!compact);
  const stats: BrandLinkViewershipStats = useMemo(
    () => computeBrandLinkViewershipStats(links, snapshots, viewMonth, todayYm),
    [links, snapshots, viewMonth, todayYm]
  );

  if (stats.activeLinkCount === 0) return null;

  const content = (
    <div className="space-y-3">
      {stats.engagement.interactions > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <StatTile
            label="Toplam etkileşim"
            value={fmtCompactViews(stats.engagement.interactions)}
            hint={`♥ ${fmtCompactViews(stats.engagement.likes)} · 💬 ${fmtCompactViews(stats.engagement.comments)} · ↗ ${fmtCompactViews(stats.engagement.shares)}`}
            accent="rose"
          />
          <StatTile
            label="Beğeni"
            value={fmtCompactViews(stats.engagement.likes)}
            accent="rose"
          />
          <StatTile
            label="Yorum"
            value={fmtCompactViews(stats.engagement.comments)}
            accent="amber"
          />
          <StatTile
            label="Paylaşım"
            value={fmtCompactViews(stats.engagement.shares)}
            accent="violet"
          />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatTile
          label={`${monthLabel(viewMonth)} toplam`}
          value={fmtCompactViews(stats.monthTotalViews)}
          hint={`${stats.activeLinkCount} aktif link`}
          accent="blue"
        />
        <StatTile
          label="Tüm zamanlar toplam"
          value={fmtCompactViews(stats.lifetimeTotalViews)}
          hint="Güncel kümülatif izlenme"
          accent="violet"
        />
        <StatTile
          label={`${monthLabel(viewMonth)} eklenen`}
          value={String(stats.linksAddedInMonth)}
          hint="Bu ay sisteme eklenen link"
          accent="amber"
        />
        <StatTile
          label="Yeni linklerin izlenmesi"
          value={fmtCompactViews(stats.viewsFromLinksAddedInMonth)}
          hint={`Sadece ${monthLabel(viewMonth)} eklenenler`}
          accent="emerald"
        />
      </div>

      {stats.monthlyBreakdown.length > 0 && (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
            onClick={() => setBreakdownOpen((o) => !o)}
          >
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Calendar size={12} /> Ay ay izlenme
            </span>
            <ChevronDown
              size={14}
              className={cn("text-muted-foreground transition-transform", breakdownOpen && "rotate-180")}
            />
          </button>
          {breakdownOpen && (
            <div className="border-t border-border/60 max-h-48 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="py-1.5 px-3 text-left font-medium">Ay</th>
                    <th className="py-1.5 px-3 text-right font-medium">Link</th>
                    <th className="py-1.5 px-3 text-right font-medium">İzlenme</th>
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
                      <td className="py-1.5 px-3">{monthLabel(row.monthYm)}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{row.linkCount}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">
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
    </div>
  );

  if (compact) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={cn("mb-4", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 size={15} className="text-blue-600 dark:text-blue-400" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">
          Tüm yüklenen linklerin aylık ve kümülatif izlenme dağılımı
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
