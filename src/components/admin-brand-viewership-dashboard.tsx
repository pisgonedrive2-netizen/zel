"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
  Legend,
} from "recharts";
import { BarChart3, Crown, TrendingUp, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { BrandLogo } from "@/components/brand-logo";
import type { Brand, BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";
import {
  rankBrandsForMonth,
  buildMultiBrandTrend,
  brandChartColor,
  type BrandRankRow,
} from "@/lib/brand-viewership-series";
import { monthLabelTr } from "@/hooks/use-marka-portal";

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

function monthTitleShort(ym: string) {
  return monthLabelTr(ym);
}

export function AdminBrandViewershipDashboard({
  brands,
  brandLinks,
  linkSnapshots,
  brandViewership,
  viewMonth,
  todayYm,
}: {
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  viewMonth: string;
  todayYm: string;
}) {
  const activeBrands = useMemo(
    () => brands.filter((b) => b.status === "active"),
    [brands]
  );

  const ranking = useMemo(
    () =>
      rankBrandsForMonth({
        brands,
        brandLinks,
        linkSnapshots,
        brandViewership,
        monthYm: viewMonth,
        todayYm,
      }),
    [brands, brandLinks, linkSnapshots, brandViewership, viewMonth, todayYm]
  );

  const trendData = useMemo(
    () =>
      buildMultiBrandTrend({
        brands,
        brandLinks,
        linkSnapshots,
        brandViewership,
        endMonthYm: viewMonth,
        todayYm,
        maxMonths: 8,
      }),
    [brands, brandLinks, linkSnapshots, brandViewership, viewMonth, todayYm]
  );

  const maxViews = Math.max(1, ...ranking.map((r) => r.views));

  const scatterData = useMemo(
    () =>
      ranking.map((r, i) => ({
        name: r.shortName,
        brandId: r.brandId,
        x: i + 1,
        y: r.views,
        z: Math.max(r.views, 1),
        fill: brandChartColor(r.brandId, i),
      })),
    [ranking]
  );

  const shareData = useMemo(
    () =>
      ranking.map((r, i) => ({
        name: r.shortName,
        brandId: r.brandId,
        share: Math.round(r.sharePct * 10) / 10,
        views: r.views,
        fill: brandChartColor(r.brandId, i),
      })),
    [ranking]
  );

  const hasData = ranking.some((r) => r.views > 0) || trendData.some((p) =>
    activeBrands.some((b) => Number(p[b.id] ?? 0) > 0)
  );

  if (activeBrands.length === 0) return null;

  return (
    <CollapsibleSection
      id="admin-brand-dashboard"
      defaultOpen
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
          5 Marka · İzlenme Panosu
        </span>
      }
      description={`${monthTitleShort(viewMonth)} — sıralama, pay ve trend`}
      trailing={
        ranking[0] && ranking[0].views > 0 ? (
          <Badge className="gap-1 bg-amber-500/15 text-amber-900 border-amber-400/50 dark:text-amber-100">
            <Crown size={11} />
            {ranking[0].shortName}
          </Badge>
        ) : undefined
      }
      className="mb-6"
    >
      {!hasData && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Bu ay için henüz izlenme verisi yok.
        </p>
      )}

      {hasData && (
      <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Animated leaderboard */}
        <Card className="xl:col-span-5 overflow-hidden border-indigo-200/50 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/30 via-card to-violet-50/20 dark:from-indigo-950/25 dark:to-violet-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown size={15} className="text-amber-600" />
              Sıralama · {monthTitleShort(viewMonth)}
            </CardTitle>
            <CardDescription>En yüksek izlenmeden başlayarak</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimatePresence mode="popLayout">
              {ranking.map((row, idx) => (
                <LeaderboardRow
                  key={row.brandId}
                  row={row}
                  rank={idx + 1}
                  maxViews={maxViews}
                  index={idx}
                />
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Dot / bubble scatter */}
        <Card className="xl:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">İzlenme haritası (nokta)</CardTitle>
            <CardDescription>
              Yatay eksen sıra · dikey eksen izlenme · nokta büyüklüğü hacim
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/60 bg-card/80 p-2 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Sıra"
                    domain={[0.5, ranking.length + 0.5]}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => {
                      const row = ranking[Math.round(v) - 1];
                      return row?.shortName ?? "";
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="İzlenme"
                    tickFormatter={fmtViews}
                    tick={{ fontSize: 10 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[80, 520]} />
                  <RTooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { name: string; y: number; share?: number };
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold">{d.name}</p>
                          <p className="tabular-nums text-muted-foreground">{fmtViews(d.y)} izlenme</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData} animationDuration={800}>
                    {scatterData.map((entry, i) => (
                      <Cell key={entry.brandId} fill={entry.fill} fillOpacity={0.85} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-3">
              {ranking.map((r, i) => (
                <span
                  key={r.brandId}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: brandChartColor(r.brandId, i) }}
                  />
                  {r.shortName}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <CollapsibleSection
        defaultOpen={false}
        title="Detay grafikler (trend, alan, pay)"
        description="İhtiyaç halinde açın — ek scroll"
        className="border-0 shadow-none bg-transparent"
      >
      <div className="grid gap-4 lg:grid-cols-2 pt-1">
        <Card className="lg:col-span-2 border-violet-200/40 dark:border-violet-500/25">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={15} className="text-violet-600" />
              Marka trendleri (çoklu çizgi)
            </CardTitle>
            <CardDescription>Son aylar · her marka ayrı renk</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/60 bg-card/80 p-2 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={fmtViews} tick={{ fontSize: 10 }} width={48} />
                  <RTooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value: number, key: string) => {
                      const b = activeBrands.find((x) => x.id === key);
                      return [fmtViews(value), b?.shortName ?? key];
                    }}
                    labelFormatter={(_, payload) => {
                      const m = payload?.[0]?.payload?.month as string | undefined;
                      return m ? monthTitleShort(m) : "";
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) =>
                      activeBrands.find((b) => b.id === value)?.shortName ?? value
                    }
                  />
                  {activeBrands.map((brand, i) => (
                    <Line
                      key={brand.id}
                      type="monotone"
                      dataKey={brand.id}
                      name={brand.id}
                      stroke={brandChartColor(brand.id, i)}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: brandChartColor(brand.id, i), strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stacked area — total momentum */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Kümülatif alan</CardTitle>
            <CardDescription>Markaların aylık katkısı (üst üste)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/60 p-2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={fmtViews} tick={{ fontSize: 10 }} width={44} />
                  <RTooltip formatter={(v: number) => fmtViews(v)} />
                  {activeBrands.map((brand, i) => (
                    <Area
                      key={brand.id}
                      type="monotone"
                      dataKey={brand.id}
                      stackId="1"
                      stroke={brandChartColor(brand.id, i)}
                      fill={brandChartColor(brand.id, i)}
                      fillOpacity={0.35}
                      animationDuration={800}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Horizontal bar — share */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 size={15} />
              Pay dağılımı (%)
            </CardTitle>
            <CardDescription>Seçili ay toplam içindeki dilim</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/60 p-2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={shareData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={52}
                    tick={{ fontSize: 11, fontWeight: 600 }}
                  />
                  <RTooltip
                    formatter={(v: number, _n, props) => {
                      const payload = props?.payload as { views?: number };
                      return [`%${v} · ${fmtViews(payload?.views ?? 0)}`, "Pay"];
                    }}
                  />
                  <Bar dataKey="share" radius={[0, 6, 6, 0]} animationDuration={700}>
                    {shareData.map((entry) => (
                      <Cell key={entry.brandId} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      </CollapsibleSection>
      </div>
      )}
    </CollapsibleSection>
  );
}

function LeaderboardRow({
  row,
  rank,
  maxViews,
  index,
}: {
  row: BrandRankRow;
  rank: number;
  maxViews: number;
  index: number;
}) {
  const pctWidth = maxViews > 0 ? (row.views / maxViews) * 100 : 0;
  const color = brandChartColor(row.brandId, index);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="relative rounded-xl border border-border/70 bg-card/90 px-3 py-2.5 overflow-hidden"
    >
      <div className="flex items-center gap-3 relative z-10">
        <motion.span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            rank === 1
              ? "bg-amber-400/90 text-amber-950"
              : rank === 2
                ? "bg-slate-300/90 text-slate-800 dark:bg-slate-500 dark:text-slate-100"
                : rank === 3
                  ? "bg-amber-700/30 text-amber-900 dark:text-amber-200"
                  : "bg-muted text-muted-foreground"
          }`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, delay: index * 0.05 }}
        >
          {rank}
        </motion.span>
        <BrandLogo brandId={row.brandId} title={row.name} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{row.shortName}</p>
          <p className="text-[10px] text-muted-foreground truncate">{row.name}</p>
        </div>
        <div className="text-right shrink-0">
          <motion.p
            key={row.views}
            className="text-sm font-bold tabular-nums"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {row.views > 0 ? fmtViews(row.views) : "—"}
          </motion.p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            %{row.sharePct.toFixed(0)} pay
          </p>
        </div>
      </div>
      <motion.div
        className="absolute inset-y-0 left-0 opacity-20 dark:opacity-25 rounded-xl"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(pctWidth, row.views > 0 ? 4 : 0)}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
      />
      {row.targetPct != null && (
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden relative z-10">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, row.targetPct)}%` }}
            transition={{ duration: 0.6, delay: 0.2 + index * 0.05 }}
          />
        </div>
      )}
    </motion.div>
  );
}
