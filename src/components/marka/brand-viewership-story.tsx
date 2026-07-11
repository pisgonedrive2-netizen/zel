"use client";

import { useMemo, type ComponentType } from "react";
import Link from "next/link";
import { Eye, Sparkles, TrendingUp, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLinkThumb } from "@/components/brand-link-thumb";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { computeBrandLinkViewershipStats } from "@/lib/brand-link-viewership-stats";
import type { BrandLink, LinkSnapshot } from "@/store/store";
import { cn } from "@/lib/utils";

/**
 * Marka izlenme — kısa hikâye bandı.
 * Aylık = ay içi artış; toplam = kümülatif.
 */
export function BrandViewershipStory({
  monthTitle,
  monthYm,
  todayYm,
  links,
  snapshots,
  href,
}: {
  monthTitle: string;
  monthYm: string;
  todayYm: string;
  links: BrandLink[];
  snapshots: LinkSnapshot[];
  href: string;
}) {
  const stats = useMemo(
    () => computeBrandLinkViewershipStats(links, snapshots, monthYm, todayYm),
    [links, snapshots, monthYm, todayYm]
  );

  const leader = useMemo(() => {
    const row = [...stats.perLinkRows].sort(
      (a, b) => b.monthGain - a.monthGain || b.lifetimeViews - a.lifetimeViews
    )[0];
    if (!row) return null;
    const link = links.find((l) => l.id === row.linkId);
    if (!link) return null;
    return {
      link,
      views: row.monthViews,
      delta: row.monthGain,
      lifetime: row.lifetimeViews,
    };
  }, [stats.perLinkRows, links]);

  const platforms = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of stats.perLinkRows) {
      map.set(row.platform, (map.get(row.platform) ?? 0) + row.monthGain);
    }
    return [...map.entries()]
      .map(([name, views]) => ({ name, views }))
      .sort((a, b) => b.views - a.views);
  }, [stats.perLinkRows]);

  const maxPlat = Math.max(1, ...platforms.map((p) => p.views));

  if (stats.activeLinkCount === 0) return null;

  return (
    <Card className="relative overflow-hidden border-border/80">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-[#FF6B00]/10"
      />
      <CardContent className="relative z-10 space-y-4 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
              İzlenme özeti
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              {monthTitle} · +{fmtCompactViews(stats.monthTotalGain)} aylık ·{" "}
              {fmtCompactViews(stats.lifetimeTotalViews)} toplam
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Aylık = ay içi artış · Toplam = kümülatif · Ay sonu bakiyesi{" "}
              {fmtCompactViews(stats.monthTotalViews)}
              {stats.linksAddedInMonth > 0 && (
                <>
                  {" "}
                  · Bu ay {stats.linksAddedInMonth} yeni link (+
                  {fmtCompactViews(stats.gainFromLinksAddedInMonth)})
                </>
              )}
            </p>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Detaylı metrikler <Eye size={12} />
          </Link>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={TrendingUp}
            label="Tüm · aylık"
            value={`+${fmtCompactViews(stats.monthTotalGain)}`}
            gain
          />
          <Stat
            icon={Link2}
            label="Tüm · toplam"
            value={fmtCompactViews(stats.lifetimeTotalViews)}
          />
          <Stat
            icon={Sparkles}
            label="Yeni · aylık"
            value={`+${fmtCompactViews(stats.gainFromLinksAddedInMonth)}`}
            accent
            gain
          />
          <Stat
            icon={Eye}
            label="Yeni · toplam"
            value={fmtCompactViews(stats.cohortLifetimeViews)}
            accent
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background/70 p-3.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ayın lideri (artış)
            </p>
            {leader ? (
              <div className="flex gap-3">
                <BrandLinkThumb link={leader.link} className="h-16 w-16 shrink-0" lazyApi />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {leader.link.platform}
                    {leader.link.handle ? ` · ${leader.link.handle}` : ""}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    +{fmtCompactViews(leader.delta)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ay sonu {fmtCompactViews(leader.views)} · toplam{" "}
                    {fmtCompactViews(leader.lifetime)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">Henüz link verisi yok.</p>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-3.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Platform kırılımı (aylık artış)
            </p>
            {platforms.length === 0 || maxPlat === 0 ? (
              <p className="text-xs italic text-muted-foreground">Veri yok.</p>
            ) : (
              <div className="space-y-2">
                {platforms.slice(0, 5).map((p) => (
                  <div key={p.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{p.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        +{fmtCompactViews(p.views)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-[#FF6B00]"
                        style={{ width: `${(p.views / maxPlat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
  gain,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  gain?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        accent
          ? "border-[#FF6B00]/30 bg-[#FF6B00]/8"
          : "border-border/70 bg-background/70"
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={12} className={accent ? "text-[#FF6B00]" : undefined} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          gain ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
