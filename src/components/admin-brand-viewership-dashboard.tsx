"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
} from "recharts";
import { BarChart3, Crown, TrendingDown, TrendingUp, Sparkles, Map, Activity, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { BrandLogo } from "@/components/brand-logo";
import type { Brand, BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";
import {
  rankBrandsForMonth,
  buildMultiBrandTrend,
  buildMultiBrandTrendDaily,
  brandChartColor,
  type BrandRankRow,
} from "@/lib/brand-viewership-series";
import { monthLabelTr } from "@/hooks/use-marka-portal";
import { shiftCalendarMonthYm } from "@/lib/data";
import { ModernSmoothLineChart } from "@/components/modern-smooth-line-chart";
import { ViewershipDotMap, brandViewDotLabel } from "@/components/view-dot-card";

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

  const prevMonthYm = shiftCalendarMonthYm(viewMonth, -1);
  const prevRanking = useMemo(
    () =>
      rankBrandsForMonth({
        brands,
        brandLinks,
        linkSnapshots,
        brandViewership,
        monthYm: prevMonthYm,
        todayYm,
      }),
    [brands, brandLinks, linkSnapshots, brandViewership, prevMonthYm, todayYm]
  );
  const prevViewsMap = useMemo(
    () => Object.fromEntries(prevRanking.map((r) => [r.brandId, r.views])),
    [prevRanking]
  );

  // Trend grafiği — kullanıcının seçtiği zaman aralığı (Son 1 / 3 / 6 ay)
  // ve marka filtresi (boş set = tüm aktif markalar) için state.
  const [trendPeriodKey, setTrendPeriodKey] = useState<"1" | "3" | "6">("3");

  // Marka filtresi: boş set = tüm aktif markalar gösterilir
  const [selectedTrendBrandIds, setSelectedTrendBrandIds] = useState<Set<string>>(new Set());

  /**
   * Son 1 ay seçilirse — günlük resolution (snapshot dataları)
   * Son 3/6 ay seçilirse — aylık aggregate
   * Bu sayede "Son 1 ay" tek noktada kalmaz; gerçek günlük trend görünür.
   */
  const trendData = useMemo(() => {
    if (trendPeriodKey === "1") {
      const endDate = new Date(`${viewMonth}-01T00:00:00`);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Seçili ayın son günü
      // viewMonth bugünden ileriyse bugünü kullan
      const today = new Date();
      const finalEnd = endDate > today ? today : endDate;
      return buildMultiBrandTrendDaily({
        brands,
        brandLinks,
        linkSnapshots,
        brandViewership,
        endDate: finalEnd,
        days: 30,
      });
    }
    return buildMultiBrandTrend({
      brands,
      brandLinks,
      linkSnapshots,
      brandViewership,
      endMonthYm: viewMonth,
      todayYm,
      maxMonths: Number(trendPeriodKey),
    });
  }, [trendPeriodKey, brands, brandLinks, linkSnapshots, brandViewership, viewMonth, todayYm]);

  const visibleTrendBrands = useMemo(() => {
    if (selectedTrendBrandIds.size === 0) return activeBrands;
    return activeBrands.filter((b) => selectedTrendBrandIds.has(b.id));
  }, [activeBrands, selectedTrendBrandIds]);

  const toggleTrendBrand = (brandId: string) => {
    setSelectedTrendBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  };

  const clearTrendBrandFilter = () => setSelectedTrendBrandIds(new Set());

  const maxViews = Math.max(1, ...ranking.map((r) => r.views));

  const dotMapItems = useMemo(
    () =>
      ranking.map((r, i) => ({
        id: r.brandId,
        name: r.name,
        shortName: r.shortName,
        views: r.views,
        sharePct: r.sharePct,
        rank: i + 1,
      })),
    [ranking]
  );

  const trendLabels = useMemo(
    () => trendData.map((p) => String(p.monthLabel ?? "")),
    [trendData]
  );

  const trendSmoothSeries = useMemo(
    () =>
      visibleTrendBrands.map((brand) => {
        // Renk indeksini activeBrands'taki sırasına göre belirle ki filtreleme
        // sonrası bile her marka kendi rengini korusun.
        const colorIndex = activeBrands.findIndex((b) => b.id === brand.id);
        return {
          key: brand.id,
          label: brand.shortName,
          color: brandChartColor(brand.id, colorIndex >= 0 ? colorIndex : 0),
          values: trendData.map((p) => Number(p[brand.id] ?? 0)),
          fillOpacity: 0.06,
        };
      }),
    [visibleTrendBrands, activeBrands, trendData]
  );

  const trendHighlightIndex = useMemo(
    () => trendData.findIndex((p) => p.month === viewMonth),
    [trendData, viewMonth]
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

  const [rightTab, setRightTab] = useState<"map" | "trend">("map");

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
      description={`${monthTitleShort(viewMonth)} — sıralama, harita ve trend`}
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

        {/* ── Elegant Leaderboard ─────────────────────────── */}
        <div className="xl:col-span-5 flex flex-col gap-0 rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-amber-50/60 via-card to-card dark:from-amber-950/20 dark:via-card">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Crown size={14} className="text-amber-500" />
                Sıralama
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {monthTitleShort(viewMonth)} · geçen aya göre delta gösterilir
              </p>
            </div>
            {ranking[0]?.views > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                <Crown size={10} />
                {ranking[0].shortName}
              </span>
            )}
          </div>
          {/* rows */}
          <div className="flex flex-col divide-y divide-border/40">
            <AnimatePresence mode="popLayout">
              {ranking.map((row, idx) => (
                <LeaderboardRow
                  key={row.brandId}
                  row={row}
                  rank={idx + 1}
                  maxViews={maxViews}
                  index={idx}
                  prevViews={prevViewsMap[row.brandId] ?? 0}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* ── İzlenme Haritası ─────────────────────────────── */}
        <Card className="xl:col-span-7 overflow-hidden border-violet-200/50 dark:border-violet-500/30 bg-gradient-to-br from-violet-50/25 via-card to-indigo-50/15 dark:from-violet-950/20 dark:via-card dark:to-indigo-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-1.5">
              <Map size={14} className="text-violet-500" /> İzlenme haritası
            </CardTitle>
            <CardDescription className="text-xs">
              {monthTitleShort(viewMonth)} — animasyonlu izlenme kartları · büyüklük paya göre
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-5">
            <ViewershipDotMap items={dotMapItems} />
          </CardContent>
        </Card>
      </div>

      {/* ── Marka trendleri çoklu çizgi — tam genişlik ────── */}
      <Card className="overflow-hidden border-indigo-200/50 dark:border-indigo-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-500" /> Marka trendleri · çoklu çizgi
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {trendPeriodKey === "1"
                  ? "Son 30 gün (günlük çözünürlük)"
                  : trendPeriodKey === "3"
                    ? "Son 3 ay (aylık)"
                    : "Son 6 ay (aylık)"}{" "}
                ·{" "}
                {selectedTrendBrandIds.size === 0
                  ? `${activeBrands.length} marka (tümü)`
                  : `${selectedTrendBrandIds.size} marka seçili`}
              </CardDescription>
            </div>
            {/* Zaman aralığı butonları */}
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-card p-0.5">
              {(["1", "3", "6"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTrendPeriodKey(k)}
                  className={
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors " +
                    (trendPeriodKey === k
                      ? "bg-indigo-500 text-white"
                      : "text-muted-foreground hover:bg-accent/40")
                  }
                >
                  Son {k} ay
                </button>
              ))}
            </div>
          </div>
          {/* Marka filtre chip'leri */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[11px] text-muted-foreground mr-1">Filtre:</span>
            <button
              type="button"
              onClick={clearTrendBrandFilter}
              className={
                "px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors " +
                (selectedTrendBrandIds.size === 0
                  ? "bg-indigo-500/15 border-indigo-400/50 text-indigo-700 dark:text-indigo-200"
                  : "bg-card border-border/60 text-muted-foreground hover:bg-accent/30")
              }
            >
              Tümü
            </button>
            {activeBrands.map((b, i) => {
              const selected = selectedTrendBrandIds.has(b.id);
              const color = brandChartColor(b.id, i);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleTrendBrand(b.id)}
                  className={
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors " +
                    (selected
                      ? "border-transparent text-white"
                      : "bg-card border-border/60 text-foreground hover:bg-accent/30")
                  }
                  style={selected ? { backgroundColor: color } : undefined}
                  title={b.name}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: selected ? "rgba(255,255,255,0.85)" : color }}
                  />
                  {b.shortName}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-5">
          {trendSmoothSeries.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Seçili filtreye uygun marka yok. Bir markayı tıklayın veya “Tümü”ne dönün.
            </div>
          ) : (
            <ModernSmoothLineChart
              labels={trendLabels}
              series={trendSmoothSeries}
              formatValue={fmtViews}
              highlightLabelIndex={trendHighlightIndex >= 0 ? trendHighlightIndex : undefined}
              height={340}
            />
          )}
        </CardContent>
      </Card>

      <CollapsibleSection
        defaultOpen={false}
        title="Detay grafikler (kümülatif alan · pay dağılımı)"
        description="İhtiyaç halinde açın"
        className="border-0 shadow-none bg-transparent"
      >
      <div className="grid gap-4 lg:grid-cols-2 pt-1">
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

const RANK_CONFIG = [
  {
    bg: "bg-amber-400/20 dark:bg-amber-400/15",
    border: "border-amber-400/60 dark:border-amber-400/40",
    text: "text-amber-700 dark:text-amber-300",
    medal: "🥇",
  },
  {
    bg: "bg-slate-200/60 dark:bg-slate-600/20",
    border: "border-slate-300/60 dark:border-slate-500/40",
    text: "text-slate-600 dark:text-slate-300",
    medal: "🥈",
  },
  {
    bg: "bg-orange-200/40 dark:bg-orange-700/15",
    border: "border-orange-300/60 dark:border-orange-600/40",
    text: "text-orange-700 dark:text-orange-300",
    medal: "🥉",
  },
];

function LeaderboardRow({
  row,
  rank,
  maxViews,
  index,
  prevViews,
}: {
  row: BrandRankRow;
  rank: number;
  maxViews: number;
  index: number;
  prevViews: number;
}) {
  const pctWidth = maxViews > 0 ? (row.views / maxViews) * 100 : 0;
  const color = brandChartColor(row.brandId, index);
  const rankCfg = RANK_CONFIG[rank - 1];
  const isTop3 = rank <= 3;

  // Month-over-month delta
  const delta =
    prevViews > 0 && row.views > 0
      ? ((row.views - prevViews) / prevViews) * 100
      : null;
  const deltaUp = delta !== null && delta > 0;
  const deltaDown = delta !== null && delta < 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="relative group px-3 py-3 overflow-hidden"
    >
      {/* left accent stripe */}
      <div
        className="absolute left-0 inset-y-0 w-[3px] rounded-r-full opacity-80"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-center gap-2.5 pl-2">
        {/* rank badge */}
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 500, delay: 0.05 + index * 0.06 }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${
            isTop3
              ? `${rankCfg.bg} ${rankCfg.border} ${rankCfg.text}`
              : "bg-muted/60 border-border/50 text-muted-foreground"
          }`}
        >
          {isTop3 ? <span className="text-sm leading-none">{rankCfg.medal}</span> : rank}
        </motion.div>

        {/* logo */}
        <BrandLogo brandId={row.brandId} title={row.name} size={26} />

        {/* name + delta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold leading-tight truncate">
              {brandViewDotLabel(row.brandId, row.shortName)}
            </p>
            {/* MoM delta pill */}
            {delta !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded-full shrink-0 ${
                  deltaUp
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : deltaDown
                      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                }`}
                title={`Geçen aya göre: ${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`}
              >
                {deltaUp ? <TrendingUp size={8} /> : deltaDown ? <TrendingDown size={8} /> : <Minus size={8} />}
                {delta > 0 ? "+" : ""}{delta.toFixed(0)}%
              </span>
            )}
          </div>
          {/* engagement metrics row */}
          {row.engagement > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {row.likes > 0 && (
                <span className="text-[9px] text-rose-500 tabular-nums">♥{fmtViews(row.likes)}</span>
              )}
              {row.comments > 0 && (
                <span className="text-[9px] text-amber-600 tabular-nums">💬{fmtViews(row.comments)}</span>
              )}
              {row.shares > 0 && (
                <span className="text-[9px] text-violet-600 tabular-nums">↗{fmtViews(row.shares)}</span>
              )}
            </div>
          )}
        </div>

        {/* views + share pill — right column */}
        <div className="text-right shrink-0 pl-1">
          <motion.p
            key={row.views}
            className="text-sm font-bold tabular-nums leading-tight"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            {row.views > 0 ? fmtViews(row.views) : "—"}
          </motion.p>
          {row.views > 0 && (
            <span
              className="inline-block text-[9px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full mt-0.5"
              style={{
                background: `${color}22`,
                color: color,
                border: `1px solid ${color}44`,
              }}
            >
              %{row.sharePct.toFixed(0)}
            </span>
          )}
          {row.targetPct != null && row.targetPct > 0 && (
            <p className="text-[9px] text-muted-foreground tabular-nums mt-0.5">
              hedef %{row.targetPct.toFixed(0)}
            </p>
          )}
        </div>
      </div>

      {/* relative-to-leader progress bar */}
      <div className="pl-[3.5rem] mt-2">
        <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(pctWidth, row.views > 0 ? 3 : 0)}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 + index * 0.06 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
