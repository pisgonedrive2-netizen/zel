"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { BarChart3, TrendingDown, TrendingUp, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Brand, BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";
import {
  buildBrandViewershipSeries,
  monthOverMonthChange,
  platformBreakdownForMonth,
  brandDataSpanLabel,
  collectBrandDataMonths,
} from "@/lib/brand-viewership-series";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { monthLabelTr } from "@/hooks/use-marka-portal";

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899"];

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

export function MarkaViewershipCharts({
  brand,
  brandLinks,
  linkSnapshots,
  brandViewership,
  monthYm,
  todayYm,
}: {
  brand: Brand;
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  monthYm: string;
  todayYm: string;
}) {
  const links = useMemo(
    () => brandLinks.filter((l) => l.brandId === brand.id),
    [brandLinks, brand.id]
  );

  const series = useMemo(
    () =>
      buildBrandViewershipSeries({
        brandId: brand.id,
        brandLinks,
        linkSnapshots,
        brandViewership,
        endMonthYm: monthYm,
        todayYm,
        maxMonths: 12,
      }),
    [brand.id, brandLinks, linkSnapshots, brandViewership, monthYm, todayYm]
  );

  const mom = useMemo(() => monthOverMonthChange(series, monthYm), [series, monthYm]);

  const platformSlices = useMemo(
    () =>
      platformBreakdownForMonth({
        brandLinks: links,
        linkSnapshots,
        monthYm,
        todayYm,
      }),
    [links, linkSnapshots, monthYm, todayYm]
  );

  const dataMonths = useMemo(
    () =>
      collectBrandDataMonths({
        brandId: brand.id,
        brandLinks,
        linkSnapshots,
        brandViewership,
      }),
    [brand.id, brandLinks, linkSnapshots, brandViewership]
  );

  const hasChartData = series.some((r) => r.totalViews > 0);
  const selectedRow = series.find((r) => r.month === monthYm);

  if (!hasChartData) {
    return (
      <Card className="border-dashed border-violet-300/50 dark:border-violet-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-600 dark:text-violet-300" />
            İzlenme trendi
          </CardTitle>
          <CardDescription>
            Henüz aylık izlenme verisi yok. Link snapshot veya yayıncı kayıtları eklendikçe grafikler
            dolacak.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`${monthLabelTr(monthYm)} toplam`}
          value={fmtViews(selectedRow?.totalViews ?? 0)}
          sub={`Link: ${fmtViews(selectedRow?.linkViews ?? 0)} · Yayın: ${fmtViews(selectedRow?.streamerViews ?? 0)}`}
          accent="text-blue-700 dark:text-blue-300"
        />
        <StatTile
          label="Önceki aya göre"
          value={
            mom.pct == null
              ? "—"
              : `${mom.pct >= 0 ? "+" : ""}${mom.pct.toFixed(0)}%`
          }
          sub={
            mom.prevMonth
              ? `${monthLabelTr(mom.prevMonth)}: ${fmtViews(mom.previous)}`
              : "Karşılaştırma yok"
          }
          accent={
            mom.pct == null
              ? "text-muted-foreground"
              : mom.pct >= 0
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300"
          }
          icon={
            mom.pct != null && mom.pct >= 0 ? (
              <TrendingUp size={14} className="text-emerald-600" />
            ) : mom.pct != null ? (
              <TrendingDown size={14} className="text-amber-600" />
            ) : null
          }
        />
        <StatTile
          label="Veri aralığı"
          value={brandDataSpanLabel(dataMonths)}
          sub={`${dataMonths.length} ay kayıtlı`}
          accent="text-violet-700 dark:text-violet-300"
        />
        <StatTile
          label="Aktif platform"
          value={String(platformSlices.length)}
          sub={platformSlices.slice(0, 3).map((p) => p.platform).join(" · ") || "—"}
          accent="text-foreground"
          icon={<Layers size={14} className="text-muted-foreground" />}
        />
      </div>

      <Card className="overflow-hidden border-violet-200/60 dark:border-violet-500/35 bg-gradient-to-br from-violet-50/40 via-card to-blue-50/30 dark:from-violet-950/20 dark:via-card dark:to-blue-950/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-700 dark:text-violet-300" />
            Aylık izlenme trendi
          </CardTitle>
          <CardDescription>
            Başlangıçtan {monthLabelTr(monthYm)} ayına kadar — link snapshot + yayıncı kayıtları
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 bg-card/80 p-2 shadow-sm">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="marka-total-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="marka-link-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.35} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" tickFormatter={fmtViews} />
                <ReferenceLine x={series.find((r) => r.month === monthYm)?.monthLabel} stroke="#8b5cf6" strokeDasharray="4 4" />
                <RTooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    fmtViews(value),
                    name === "totalViews"
                      ? "Toplam"
                      : name === "linkViews"
                        ? "Linkler"
                        : "Yayıncı",
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { month?: string } | undefined;
                    return row?.month ? monthLabelTr(row.month) : "";
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="linkViews"
                  name="Linkler"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#marka-link-views)"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="streamerViews"
                  name="Yayıncı"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="#10b98133"
                  stackId="1"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {platformSlices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{monthLabelTr(monthYm)} · platform dağılımı</CardTitle>
            <CardDescription>Seçili ayda link bazlı izlenme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card/80 p-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={platformSlices}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                    <XAxis type="number" tickFormatter={fmtViews} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="platform"
                      width={88}
                      tick={{ fontSize: 10 }}
                    />
                    <RTooltip formatter={(v: number) => fmtViews(v)} />
                    <Bar dataKey="views" radius={[0, 4, 4, 0]}>
                      {platformSlices.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2">
                {platformSlices.map((p, i) => (
                  <li
                    key={p.platform}
                    className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5"
                  >
                    <SocialPlatformIcon platform={p.platform} size={22} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.platform}</p>
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (p.views / (platformSlices[0]?.views || 1)) * 100)}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <Badge variant="secondary" className="tabular-nums shrink-0">
                      {fmtViews(p.views)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/90 px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${accent}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{sub}</p>
    </div>
  );
}
