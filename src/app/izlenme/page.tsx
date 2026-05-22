"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Eye, Briefcase, Users, Link2, BarChart3, Activity, RefreshCw,
  TrendingUp, TrendingDown, ArrowRight, Sparkles, Layers, Cable,
  Calendar, Crown, Trophy, Filter,
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

import { useStore, type Brand, type BrandLink } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { shiftCalendarMonthYm } from "@/lib/data";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";
import {
  linkViewsForMonth,
  totalLinkViewsForMonth,
  totalContentExpensesForMonth,
} from "@/lib/brand-month-metrics";
import { brandChartColor } from "@/lib/brand-viewership-series";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { ViewDotCard } from "@/components/view-dot-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────
const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

const monthShortYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", {
    month: "short",
    year: "2-digit",
  });

function pctChange(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}

// ── Reusable: stat tile with sparkline ────────────────────────────────────
function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  accent = "indigo",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: number | null;
  accent?: "indigo" | "emerald" | "blue" | "amber" | "rose" | "violet";
}) {
  const accentMap: Record<string, string> = {
    indigo:
      "from-indigo-500/15 via-indigo-500/5 to-transparent text-indigo-700 dark:text-indigo-300 ring-indigo-200/60 dark:ring-indigo-400/20",
    emerald:
      "from-emerald-500/15 via-emerald-500/5 to-transparent text-emerald-700 dark:text-emerald-300 ring-emerald-200/60 dark:ring-emerald-400/20",
    blue:
      "from-blue-500/15 via-blue-500/5 to-transparent text-blue-700 dark:text-blue-300 ring-blue-200/60 dark:ring-blue-400/20",
    amber:
      "from-amber-500/15 via-amber-500/5 to-transparent text-amber-700 dark:text-amber-300 ring-amber-200/60 dark:ring-amber-400/20",
    rose:
      "from-rose-500/15 via-rose-500/5 to-transparent text-rose-700 dark:text-rose-300 ring-rose-200/60 dark:ring-rose-400/20",
    violet:
      "from-violet-500/15 via-violet-500/5 to-transparent text-violet-700 dark:text-violet-300 ring-violet-200/60 dark:ring-violet-400/20",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4",
        "ring-1 transition-all hover:shadow-md hover:-translate-y-0.5",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:pointer-events-none",
        accentMap[accent]
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground truncate">
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</p>
          )}
        </div>
        <div
          className={cn(
            "shrink-0 rounded-xl p-2 bg-background/70 backdrop-blur-sm border border-border/40",
            accentMap[accent]
          )}
        >
          <Icon size={18} />
        </div>
      </div>
      {trend != null && Number.isFinite(trend) && (
        <div className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-background/80 border border-border/40 px-2 py-0.5 text-[11px] font-medium">
          {trend >= 0 ? (
            <TrendingUp size={11} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <TrendingDown size={11} className="text-rose-600 dark:text-rose-400" />
          )}
          <span
            className={cn(
              "tabular-nums",
              trend >= 0
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300"
            )}
          >
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">MoM</span>
        </div>
      )}
    </div>
  );
}

// ── Reusable: quick nav card ──────────────────────────────────────────────
function QuickNavCard({
  href,
  title,
  description,
  icon: Icon,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: "indigo" | "emerald" | "blue" | "amber" | "violet";
}) {
  const tone: Record<string, string> = {
    indigo:
      "from-indigo-500/10 to-indigo-500/0 text-indigo-700 dark:text-indigo-300 hover:border-indigo-300/70 dark:hover:border-indigo-400/40",
    emerald:
      "from-emerald-500/10 to-emerald-500/0 text-emerald-700 dark:text-emerald-300 hover:border-emerald-300/70 dark:hover:border-emerald-400/40",
    blue:
      "from-blue-500/10 to-blue-500/0 text-blue-700 dark:text-blue-300 hover:border-blue-300/70 dark:hover:border-blue-400/40",
    amber:
      "from-amber-500/10 to-amber-500/0 text-amber-700 dark:text-amber-300 hover:border-amber-300/70 dark:hover:border-amber-400/40",
    violet:
      "from-violet-500/10 to-violet-500/0 text-violet-700 dark:text-violet-300 hover:border-violet-300/70 dark:hover:border-violet-400/40",
  };
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4",
        "transition-all hover:shadow-md hover:-translate-y-0.5",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:pointer-events-none",
        tone[accent]
      )}
    >
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "shrink-0 rounded-xl p-2.5 bg-background/80 border border-border/40",
            tone[accent]
          )}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
            {title}
            <ArrowRight
              size={13}
              className="opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ── Top brand row ─────────────────────────────────────────────────────────
function TopBrandRow({
  brand,
  views,
  maxViews,
  rank,
  href,
  index,
}: {
  brand: Brand;
  views: number;
  maxViews: number;
  rank: number;
  href: string;
  index: number;
}) {
  const pct = maxViews > 0 ? Math.max(2, (views / maxViews) * 100) : 0;
  const color = brandChartColor(brand.id, index);
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border/60 bg-card hover:bg-accent/30 hover:border-border transition-all px-3 py-2.5"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center shrink-0">
          <span className="absolute -top-1.5 -left-1.5 text-[10px] font-bold tabular-nums w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground">
            {rank}
          </span>
          <BrandLogo brandId={brand.id} title={brand.name} size={36} className="rounded-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-sm text-foreground">
              {brand.name}
            </span>
            <span className="tabular-nums text-sm font-semibold text-foreground shrink-0">
              {fmtViews(views)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${color}, ${color}99)`,
              }}
            />
          </div>
        </div>
        <ArrowRight
          size={14}
          className="text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0"
        />
      </div>
    </Link>
  );
}

// ── Top streamer row ──────────────────────────────────────────────────────
function TopStreamerRow({
  name,
  linkCount,
  views,
  rank,
}: {
  name: string;
  linkCount: number;
  views: number;
  rank: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const rankBadge =
    rank === 1
      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40"
      : rank === 2
      ? "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-600"
      : rank === 3
      ? "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500/40"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card hover:bg-accent/20 transition-colors px-3 py-2.5">
      <span
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-full border text-[11px] font-bold tabular-nums",
          rankBadge
        )}
      >
        {rank}
      </span>
      <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-border/60 flex items-center justify-center text-xs font-semibold text-foreground">
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm text-foreground">{name}</p>
        <p className="text-[11px] text-muted-foreground">
          {linkCount} link · {fmtViews(views)} izlenme
        </p>
      </div>
      {rank === 1 && (
        <Crown
          size={14}
          className="text-amber-500 dark:text-amber-400 shrink-0"
          aria-hidden
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function IzlenmePage() {
  const readOnly = useIsReadOnly();
  const { viewMonth, setViewMonth, todayYm } = useIzlenmeViewMonth();

  const {
    employees,
    brands,
    brandLinks,
    linkSnapshots,
    brandViewership,
    contentExpenses,
  } = useStore();

  // ── Aggregates ─────────────────────────────────────────────────────────
  const totalBrandsActive = brands.filter((b) => b.status === "active").length;
  const activeLinks = brandLinks.filter((l) => l.status === "active");
  const totalActiveLinks = activeLinks.length;
  const totalStreamers = useMemo(
    () => new Set(brandLinks.map((l) => l.ownerId).filter(Boolean) as string[]).size,
    [brandLinks]
  );
  const totalViewsMonth = useMemo(
    () => totalLinkViewsForMonth(brandLinks, viewMonth, linkSnapshots, todayYm),
    [brandLinks, linkSnapshots, viewMonth, todayYm]
  );

  const totalViewsLive = useMemo(
    () => brandLinks.reduce((s, l) => s + (l.lastViews ?? 0), 0),
    [brandLinks]
  );

  const prevMonthYm = useMemo(
    () => shiftCalendarMonthYm(viewMonth, -1),
    [viewMonth]
  );
  const prevMonthViews = useMemo(
    () => totalLinkViewsForMonth(brandLinks, prevMonthYm, linkSnapshots, todayYm),
    [brandLinks, linkSnapshots, prevMonthYm, todayYm]
  );
  const momPct = pctChange(totalViewsMonth, prevMonthViews);

  const totalExpensesMonth = useMemo(
    () => totalContentExpensesForMonth(contentExpenses, viewMonth),
    [contentExpenses, viewMonth]
  );

  // ── Top 5 brands for selected month ────────────────────────────────────
  const topBrands = useMemo(() => {
    return brands
      .filter((b) => b.status !== "inactive")
      .map((b) => {
        const links = brandLinks.filter((l) => l.brandId === b.id);
        const views = totalLinkViewsForMonth(links, viewMonth, linkSnapshots, todayYm);
        const streamerViews = brandViewership
          .filter((v) => v.brandId === b.id && v.month === viewMonth)
          .reduce((s, v) => s + v.views, 0);
        return { brand: b, views: views + streamerViews };
      })
      .filter((r) => r.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }, [brands, brandLinks, linkSnapshots, brandViewership, viewMonth, todayYm]);

  const maxTopBrandViews = topBrands[0]?.views ?? 0;

  // ── Top 5 streamers (operators) ────────────────────────────────────────
  const topStreamers = useMemo(() => {
    const byOwner = new Map<
      string,
      { ownerId: string; linkCount: number; views: number }
    >();
    for (const link of brandLinks) {
      if (!link.ownerId) continue;
      const entry =
        byOwner.get(link.ownerId) ??
        { ownerId: link.ownerId, linkCount: 0, views: 0 };
      entry.linkCount += 1;
      entry.views += linkViewsForMonth(link, viewMonth, linkSnapshots, todayYm).lastViews;
      byOwner.set(link.ownerId, entry);
    }
    // Add streamer-only viewership rows (yayıncı raporları)
    for (const v of brandViewership) {
      if (v.month !== viewMonth || !v.employeeId) continue;
      const entry =
        byOwner.get(v.employeeId) ??
        { ownerId: v.employeeId, linkCount: 0, views: 0 };
      entry.views += v.views;
      byOwner.set(v.employeeId, entry);
    }
    return [...byOwner.values()]
      .map((e) => {
        const emp = employees.find((x) => x.id === e.ownerId);
        return {
          name: emp?.name ?? "Bilinmiyor",
          linkCount: e.linkCount,
          views: e.views,
        };
      })
      .filter((e) => e.views > 0 || e.linkCount > 0)
      .sort((a, b) => b.views - a.views || b.linkCount - a.linkCount)
      .slice(0, 5);
  }, [brandLinks, brandViewership, employees, linkSnapshots, viewMonth, todayYm]);

  // ── 6-month trend ──────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const arr: { month: string; label: string; views: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ym = shiftCalendarMonthYm(viewMonth, -i);
      const views = totalLinkViewsForMonth(brandLinks, ym, linkSnapshots, todayYm);
      const viewerShipViews = brandViewership
        .filter((v) => v.month === ym)
        .reduce((s, v) => s + v.views, 0);
      arr.push({
        month: ym,
        label: monthShortYm(ym),
        views: views + viewerShipViews,
      });
    }
    return arr;
  }, [brandLinks, brandViewership, linkSnapshots, viewMonth, todayYm]);

  const trendHasData = trendData.some((p) => p.views > 0);
  const trendMax = Math.max(0, ...trendData.map((p) => p.views));

  // ── Counts for navbar / chips ──────────────────────────────────────────
  const hasNoData = brandLinks.length === 0 && brands.length === 0;

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      {/* Page header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              İzlenme Panosu
            </h1>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Sparkles size={10} /> Genel Özet
            </Badge>
            {readOnly && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-950/30"
              >
                Denetim · salt okunur
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Marka linklerinin ve yayıncı performansının seçili aya göre özet
            gösterimi. Detaylı analizler için üstteki sekmeleri kullanın.
          </p>
        </div>
      </header>

      {/* Sticky tabs + month picker */}
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={(next) => setViewMonth(next)}
        totalBrands={totalBrandsActive}
        totalStreamers={totalStreamers}
        totalLinks={totalActiveLinks}
        totalViews={totalViewsMonth}
        readOnly={readOnly}
      />

      {/* Read-only context chips */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          <Filter size={11} />
          <span className="font-medium text-foreground">
            {monthTitleYm(viewMonth)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          <Briefcase size={11} /> {totalBrandsActive} aktif marka
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          <Link2 size={11} /> {totalActiveLinks} aktif link
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          <Users size={11} /> {totalStreamers} yayıncı
        </span>
        {momPct != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium",
              momPct >= 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-300"
            )}
          >
            {momPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {momPct >= 0 ? "+" : ""}
            {momPct.toFixed(1)}% aydan aya
          </span>
        )}
      </div>

      {/* Hero / KPI grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6 mb-6">
        <ViewDotCard
          target={totalViewsMonth}
          metricCaption="Views"
          label={`${monthTitleYm(viewMonth)} · Toplam`}
          sub={
            totalViewsLive > 0
              ? `Canlı toplam: ${fmtViews(totalViewsLive)}`
              : "Bu aya kayıtlı snapshot'ların toplamı"
          }
          accent="violet"
          className="col-span-2 lg:col-span-2"
        />
        <StatTile
          label="Aktif Marka"
          value={String(totalBrandsActive)}
          sub={`${brands.length} toplam kayıt`}
          icon={Briefcase}
          accent="indigo"
        />
        <StatTile
          label="Takip Edilen Link"
          value={String(totalActiveLinks)}
          sub={`${brandLinks.length} kayıt`}
          icon={Cable}
          accent="blue"
        />
        <StatTile
          label="Yayıncı (sahip)"
          value={String(totalStreamers)}
          sub="Link sahibi yayıncılar"
          icon={Users}
          accent="emerald"
        />
        <StatTile
          label="İçerik Harcaması"
          value={
            totalExpensesMonth > 0
              ? `$${totalExpensesMonth.toLocaleString("tr-TR")}`
              : "—"
          }
          sub={monthTitleYm(viewMonth)}
          icon={Layers}
          accent="amber"
          trend={momPct}
        />
      </div>

      {/* Trend mini chart */}
      <Card className="mb-6 overflow-hidden border-border/70">
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-600 dark:text-indigo-400" />
              Son 6 Ay · Toplam İzlenme Trendi
            </CardTitle>
            <CardDescription className="text-xs">
              Link snapshot'ları ve yayıncı raporlarının ay bazlı toplamı.
            </CardDescription>
          </div>
          <Link
            href="/izlenme/grafikler"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            Tüm grafikler <ArrowRight size={11} />
          </Link>
        </CardHeader>
        <CardContent className="pt-2">
          {trendHasData ? (
            <div className="h-44 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 8, left: -8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                    strokeOpacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmtViews(v as number)}
                    domain={[0, Math.max(1, trendMax * 1.1)]}
                    width={48}
                  />
                  <RTooltip
                    cursor={{ stroke: "#6366f1", strokeOpacity: 0.25, strokeWidth: 1 }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                    formatter={(v: number) => [fmtViews(v), "İzlenme"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#6366f1"
                    strokeWidth={2.2}
                    fill="url(#trend-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 sm:h-52 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
              <Activity size={28} className="opacity-50" />
              <p className="text-sm">Bu pencerede toplam izlenme verisi yok.</p>
              <p className="text-[11px]">
                Link snapshot eklendikçe veya API yenilemesi yapıldıkça grafik dolacak.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top brands + Top streamers */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card className="border-border/70">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy size={15} className="text-amber-600 dark:text-amber-400" />
                En çok izlenen markalar
              </CardTitle>
              <CardDescription className="text-xs">
                {monthTitleYm(viewMonth)} · ilk 5
              </CardDescription>
            </div>
            <Link
              href="/izlenme/markalar"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Tüm markalar <ArrowRight size={11} />
            </Link>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            {topBrands.length > 0 ? (
              topBrands.map((row, i) => (
                <TopBrandRow
                  key={row.brand.id}
                  brand={row.brand}
                  views={row.views}
                  maxViews={maxTopBrandViews}
                  rank={i + 1}
                  index={i}
                  href={`/izlenme/marka/${row.brand.id}?month=${viewMonth}`}
                />
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Bu ay için izlenme bulunan marka yok.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users size={15} className="text-emerald-600 dark:text-emerald-400" />
                En aktif yayıncılar
              </CardTitle>
              <CardDescription className="text-xs">
                Link sayısı + seçili ay izlenme · ilk 5
              </CardDescription>
            </div>
            <Link
              href="/izlenme/operatorler"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Operatörler <ArrowRight size={11} />
            </Link>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            {topStreamers.length > 0 ? (
              topStreamers.map((s, i) => (
                <TopStreamerRow
                  key={`${s.name}-${i}`}
                  name={s.name}
                  linkCount={s.linkCount}
                  views={s.views}
                  rank={i + 1}
                />
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Bu ay için kayıtlı yayıncı izlenmesi yok.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick navigation */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
            <Sparkles size={13} className="text-indigo-500" /> Hızlı yön bulma
          </h2>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            İlgili sekmeye atla
          </span>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <QuickNavCard
            href="/izlenme/markalar"
            title="Markalar"
            description="Marka kart listesi · ay bazlı performans"
            icon={Briefcase}
            accent="indigo"
          />
          <QuickNavCard
            href="/izlenme/operatorler"
            title="Operatörler"
            description="Yayıncı bazlı toplam izlenme ve linkler"
            icon={Users}
            accent="emerald"
          />
          <QuickNavCard
            href="/izlenme/grafikler"
            title="Grafikler"
            description="Çok aylı trendler ve marka karşılaştırmaları"
            icon={BarChart3}
            accent="blue"
          />
          <QuickNavCard
            href="/izlenme/api"
            title="API & Otomasyon"
            description="Rapid API durumu · cron · yenileme geçmişi"
            icon={RefreshCw}
            accent="amber"
          />
        </div>
      </section>

      {/* Empty state when nothing is configured */}
      {hasNoData && (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-400/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
            <Eye size={20} />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            İzlenme panosu boş
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Henüz marka veya link eklenmemiş. Markalar sekmesinden ekleyebilir
            ya da API sekmesinden otomasyonu kurabilirsiniz.
          </p>
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/izlenme/markalar"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-accent/40 px-3 h-9 text-xs font-medium transition-colors"
            >
              <Briefcase size={13} /> Markalara git
            </Link>
            <Link
              href="/izlenme/api"
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground text-background hover:opacity-90 px-3 h-9 text-xs font-medium transition-opacity"
            >
              <RefreshCw size={13} /> API'yi kontrol et
            </Link>
          </div>
        </div>
      )}

      {/* Footer info — current snapshot context */}
      <footer className="mt-8 mb-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <Calendar size={11} />
          <span>
            Görüntülenen ay: <span className="font-medium text-foreground">{monthTitleYm(viewMonth)}</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Activity size={11} />
          <span>
            {linkSnapshots.length.toLocaleString("tr-TR")} snapshot ·{" "}
            {brandViewership.length.toLocaleString("tr-TR")} yayıncı satırı
          </span>
        </div>
      </footer>
    </div>
  );
}
