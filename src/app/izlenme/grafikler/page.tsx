"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useStore } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Columns3,
  DollarSign,
  Eye,
  Grid3x3,
  Layers,
  Percent,
  PieChart as PieIcon,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  brandContentExpensesForMonth,
  totalLinkViewsForMonth,
} from "@/lib/brand-month-metrics";
import { shiftCalendarMonthYm } from "@/lib/data";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtViews = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toLocaleString("tr-TR");
};

const fmtUsd = (n: number) => {
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(n < 10 ? 2 : 0);
};

const fmtPct = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

const monthShortYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "short" });

const BRAND_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#a855f7",
];
const OTHERS_COLOR = "#94a3b8";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 8px 28px -8px rgba(0,0,0,0.18)",
  color: "var(--card-foreground)",
};

// ─── tabs definition ────────────────────────────────────────────────────────

type TabKey = "trend" | "share" | "bar" | "efficiency";

interface TabDef {
  key: TabKey;
  label: string;
  description: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabDef[] = [
  {
    key: "trend",
    label: "Trend",
    description: "Son aylarda markaların izlenme akışı · yığılı / yan yana / yüzde",
    Icon: TrendingUp,
  },
  {
    key: "share",
    label: "Pay dağılımı",
    description: "Bu ay markaların toplam izlenmedeki payı",
    Icon: PieIcon,
  },
  {
    key: "bar",
    label: "Karşılaştırma",
    description: "Bu ay vs geçen ay sütun karşılaştırma · büyüme & hedef",
    Icon: BarChart3,
  },
  {
    key: "efficiency",
    label: "Verimlilik",
    description: "İçerik harcaması × izlenme · scatter ve CPM",
    Icon: Target,
  },
];

// ─── small UI helpers ───────────────────────────────────────────────────────

interface ModeToggleOption<T extends string> {
  value: T;
  label: string;
  Icon?: ComponentType<{ size?: number; className?: string }>;
}

function ModeToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ModeToggleOption<T>[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5 border border-border/60"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
              active
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground border border-transparent",
            )}
          >
            {o.Icon ? <o.Icon size={11} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  title = "Bu ay için yeterli veri yok",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
      <div className="rounded-full bg-muted p-3.5">
        <AlertCircle size={22} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
      ) : null}
    </div>
  );
}

interface KpiToneCfg {
  surface: string;
  iconBg: string;
}

const KPI_TONES: Record<"info" | "warn" | "success" | "default", KpiToneCfg> = {
  info: {
    surface:
      "from-sky-50/80 via-sky-50/20 to-transparent dark:from-sky-950/40 dark:via-sky-950/10",
    iconBg:
      "bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  warn: {
    surface:
      "from-amber-50/80 via-amber-50/20 to-transparent dark:from-amber-950/40 dark:via-amber-950/10",
    iconBg:
      "bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  success: {
    surface:
      "from-emerald-50/80 via-emerald-50/20 to-transparent dark:from-emerald-950/40 dark:via-emerald-950/10",
    iconBg:
      "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  default: {
    surface:
      "from-muted/60 via-muted/10 to-transparent dark:from-muted/40",
    iconBg: "bg-muted text-foreground",
  },
};

function KpiCard({
  Icon,
  label,
  value,
  hint,
  delta,
  tone = "default",
}: {
  Icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  tone?: keyof typeof KPI_TONES;
}) {
  const t = KPI_TONES[tone];
  const deltaTone =
    delta == null
      ? ""
      : delta >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
  const DeltaIcon = delta == null ? null : delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 p-3 bg-gradient-to-br transition-shadow hover:shadow-sm",
        t.surface,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="text-lg font-semibold tabular-nums mt-0.5 truncate">
            {value}
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
            {DeltaIcon ? (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", deltaTone)}>
                <DeltaIcon size={10} />
                {fmtPct(delta ?? 0)}
              </span>
            ) : null}
            {hint ? <span className="truncate">{hint}</span> : null}
          </div>
        </div>
        <div className={cn("rounded-lg p-1.5 shrink-0", t.iconBg)}>
          <Icon size={14} />
        </div>
      </div>
    </div>
  );
}

// ─── treemap custom renderer ────────────────────────────────────────────────

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  fill?: string;
  total?: number;
  highlighted?: string | null;
}

function TreemapCell(props: TreemapContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name, value, fill, total, highlighted } = props;
  if (width <= 0 || height <= 0) return null;
  const pct = total && total > 0 && value != null ? (value / total) * 100 : 0;
  const dim = highlighted && name && highlighted !== name;
  const showLabel = width > 56 && height > 36;
  const showValue = width > 56 && height > 56;
  return (
    <g style={{ opacity: dim ? 0.25 : 1, transition: "opacity 0.2s" }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="var(--background)"
        strokeWidth={2}
        rx={4}
      />
      {showLabel ? (
        <text
          x={x + 8}
          y={y + 16}
          fill="#fff"
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {name}
        </text>
      ) : null}
      {showValue ? (
        <>
          <text
            x={x + 8}
            y={y + 32}
            fill="rgba(255,255,255,0.85)"
            fontSize={10}
            style={{ pointerEvents: "none" }}
          >
            {fmtViews(value ?? 0)}
          </text>
          <text
            x={x + 8}
            y={y + 46}
            fill="rgba(255,255,255,0.72)"
            fontSize={10}
            fontWeight={500}
            style={{ pointerEvents: "none" }}
          >
            %{pct.toFixed(1)}
          </text>
        </>
      ) : null}
    </g>
  );
}

// ─── scatter tooltip ────────────────────────────────────────────────────────

interface ScatterPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  cpm: number;
  linkCount: number;
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="font-semibold text-xs mb-1">{p.name}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-muted-foreground">İzlenme</span>
        <span className="tabular-nums text-right">{fmtViews(p.y)}</span>
        <span className="text-muted-foreground">Harcama</span>
        <span className="tabular-nums text-right">{fmtUsd(p.x)}</span>
        <span className="text-muted-foreground">CPM</span>
        <span className="tabular-nums text-right">
          {p.x > 0 && p.y > 0 ? fmtUsd(p.cpm) : "—"}
        </span>
        <span className="text-muted-foreground">Link</span>
        <span className="tabular-nums text-right">{p.linkCount}</span>
      </div>
    </div>
  );
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function GrafiklerPage() {
  const readOnly = useIsReadOnly();
  const { brands, brandLinks, linkSnapshots, contentExpenses } = useStore();

  const { viewMonth, setViewMonth, todayYm } = useIzlenmeViewMonth();
  const [activeTab, setActiveTab] = useState<TabKey>("trend");

  // Tab-local controls
  const [trendMode, setTrendMode] = useState<"stacked" | "grouped" | "percent">("stacked");
  const [trendMonths, setTrendMonths] = useState<6 | 12>(6);
  const [showOthers, setShowOthers] = useState(true);

  const [shareMode, setShareMode] = useState<"pie" | "donut" | "treemap">("donut");
  const [highlightedBrand, setHighlightedBrand] = useState<string | null>(null);

  const [barOrientation, setBarOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [barSort, setBarSort] = useState<"views" | "growth" | "target">("views");
  const activeBrands = useMemo(
    () => brands.filter((b) => b.status === "active"),
    [brands],
  );
  const lastMonthYm = useMemo(() => shiftCalendarMonthYm(viewMonth, -1), [viewMonth]);

  // ── derived datasets ──────────────────────────────────────────────────────

  const monthsRange = useMemo(() => {
    const arr: { ym: string; label: string }[] = [];
    for (let i = -(trendMonths - 1); i <= 0; i++) {
      const m = shiftCalendarMonthYm(viewMonth, i);
      arr.push({ ym: m, label: monthShortYm(m) });
    }
    return arr;
  }, [viewMonth, trendMonths]);

  // brand × month total view matrix to avoid redundant work
  const brandMonthlyViews = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const b of activeBrands) {
      const links = brandLinks.filter((l) => l.brandId === b.id);
      const inner = new Map<string, number>();
      for (const { ym } of monthsRange) {
        inner.set(ym, totalLinkViewsForMonth(links, ym, linkSnapshots, todayYm));
      }
      inner.set(lastMonthYm, totalLinkViewsForMonth(links, lastMonthYm, linkSnapshots, todayYm));
      inner.set(viewMonth, totalLinkViewsForMonth(links, viewMonth, linkSnapshots, todayYm));
      map.set(b.id, inner);
    }
    return map;
  }, [activeBrands, brandLinks, linkSnapshots, monthsRange, lastMonthYm, viewMonth, todayYm]);

  const thisMonthByBrand = useMemo(() => {
    return activeBrands.map((b) => {
      const linksForBrand = brandLinks.filter((l) => l.brandId === b.id);
      const views = brandMonthlyViews.get(b.id)?.get(viewMonth) ?? 0;
      return {
        brand: b,
        views,
        linkCount: linksForBrand.filter((l) => l.status === "active").length,
      };
    });
  }, [activeBrands, brandLinks, brandMonthlyViews, viewMonth]);

  const lastMonthByBrand = useMemo(() => {
    return activeBrands.map((b) => ({
      brand: b,
      views: brandMonthlyViews.get(b.id)?.get(lastMonthYm) ?? 0,
    }));
  }, [activeBrands, brandMonthlyViews, lastMonthYm]);

  const topBrandIds = useMemo(() => {
    return [...thisMonthByBrand]
      .filter((d) => d.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 8)
      .map((d) => d.brand.id);
  }, [thisMonthByBrand]);

  const brandColorMap = useMemo(() => {
    const map = new Map<string, string>();
    topBrandIds.forEach((id, i) => map.set(id, BRAND_COLORS[i % BRAND_COLORS.length]));
    return map;
  }, [topBrandIds]);

  const trendData = useMemo(() => {
    return monthsRange.map(({ ym, label }) => {
      const row: Record<string, number | string> = { label, ym };
      let othersSum = 0;
      let totalSum = 0;
      for (const b of activeBrands) {
        const v = brandMonthlyViews.get(b.id)?.get(ym) ?? 0;
        if (topBrandIds.includes(b.id)) {
          row[b.shortName] = v;
        } else {
          othersSum += v;
        }
        totalSum += v;
      }
      if (showOthers && othersSum > 0) row["Diğer"] = othersSum;
      row.__total = totalSum;
      return row;
    });
  }, [monthsRange, activeBrands, brandMonthlyViews, topBrandIds, showOthers]);

  const trendKeys = useMemo(() => {
    const keys: string[] = [];
    for (const id of topBrandIds) {
      const b = activeBrands.find((x) => x.id === id);
      if (b) keys.push(b.shortName);
    }
    if (showOthers && trendData.some((r) => Number(r["Diğer"] ?? 0) > 0)) {
      keys.push("Diğer");
    }
    return keys;
  }, [topBrandIds, activeBrands, showOthers, trendData]);

  const trendHasData = useMemo(
    () => trendData.some((r) => Number(r.__total) > 0),
    [trendData],
  );

  const shareData = useMemo(() => {
    return thisMonthByBrand
      .filter((d) => d.views > 0)
      .sort((a, b) => b.views - a.views)
      .map((d, i) => ({
        id: d.brand.id,
        name: d.brand.shortName,
        value: d.views,
        linkCount: d.linkCount,
        fill: BRAND_COLORS[i % BRAND_COLORS.length],
      }));
  }, [thisMonthByBrand]);

  const totalThisMonth = useMemo(
    () => shareData.reduce((s, d) => s + d.value, 0),
    [shareData],
  );

  const barData = useMemo(() => {
    const rows = activeBrands
      .map((b) => {
        const thisV = brandMonthlyViews.get(b.id)?.get(viewMonth) ?? 0;
        const lastV = brandMonthlyViews.get(b.id)?.get(lastMonthYm) ?? 0;
        const growth =
          lastV > 0 ? ((thisV - lastV) / lastV) * 100 : thisV > 0 ? 100 : 0;
        const target = b.monthlyTarget ?? 0;
        const targetPct = target > 0 ? (thisV / target) * 100 : 0;
        return {
          id: b.id,
          name: b.shortName,
          thisMonth: thisV,
          lastMonth: lastV,
          growth,
          target,
          targetPct,
        };
      })
      .filter((d) => d.thisMonth > 0 || d.lastMonth > 0);

    if (barSort === "views") rows.sort((a, b) => b.thisMonth - a.thisMonth);
    else if (barSort === "growth") rows.sort((a, b) => b.growth - a.growth);
    else rows.sort((a, b) => b.targetPct - a.targetPct);
    return rows;
  }, [activeBrands, brandMonthlyViews, viewMonth, lastMonthYm, barSort]);

  const efficiencyData = useMemo<ScatterPoint[]>(() => {
    return activeBrands
      .map((b) => {
        const links = brandLinks.filter((l) => l.brandId === b.id);
        const activeLinks = links.filter((l) => l.status === "active");
        const views = brandMonthlyViews.get(b.id)?.get(viewMonth) ?? 0;
        const expenses = brandContentExpensesForMonth(contentExpenses, b, viewMonth)
          .reduce((s, e) => s + e.amountUsd, 0);
        const cpm = views > 0 ? expenses / (views / 1000) : 0;
        return {
          id: b.id,
          name: b.shortName,
          x: expenses,
          y: views,
          z: Math.max(activeLinks.length, 1) * 120,
          cpm,
          linkCount: activeLinks.length,
        };
      })
      .filter((d) => d.x > 0 || d.y > 0);
  }, [activeBrands, brandLinks, brandMonthlyViews, contentExpenses, viewMonth]);

  const topEfficient = useMemo(() => {
    const candidates = efficiencyData.filter((d) => d.x > 0 && d.y > 0);
    if (!candidates.length) return null;
    return [...candidates].sort((a, b) => a.cpm - b.cpm)[0];
  }, [efficiencyData]);

  // ── KPI bar ────────────────────────────────────────────────────────────────

  const kpi = useMemo(() => {
    const total = thisMonthByBrand.reduce((s, d) => s + d.views, 0);
    const lastTotal = lastMonthByBrand.reduce((s, d) => s + d.views, 0);
    const totalGrowth = lastTotal > 0 ? ((total - lastTotal) / lastTotal) * 100 : 0;

    const totalExpense = activeBrands.reduce(
      (s, b) =>
        s +
        brandContentExpensesForMonth(contentExpenses, b, viewMonth).reduce(
          (sx, e) => sx + e.amountUsd,
          0,
        ),
      0,
    );
    const avgCpm = total > 0 ? totalExpense / (total / 1000) : 0;

    let topGrowth: { name: string; growth: number; views: number } | null = null;
    for (const d of barData) {
      if (d.thisMonth < 100) continue;
      if (!topGrowth || d.growth > topGrowth.growth) {
        topGrowth = { name: d.name, growth: d.growth, views: d.thisMonth };
      }
    }
    return { total, lastTotal, totalGrowth, totalExpense, avgCpm, topGrowth };
  }, [thisMonthByBrand, lastMonthByBrand, activeBrands, contentExpenses, viewMonth, barData]);

  const totalLinks = brandLinks.filter((l) => l.status === "active").length;
  const totalOwners = new Set(brandLinks.map((l) => l.ownerId).filter(Boolean)).size;

  // ── render ────────────────────────────────────────────────────────────────

  const trendRangeLabel = `${monthShortYm(monthsRange[0]?.ym ?? viewMonth)} – ${monthShortYm(
    viewMonth,
  )}`;

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        totalBrands={activeBrands.length}
        totalStreamers={totalOwners}
        totalLinks={totalLinks}
        totalViews={kpi.total}
        readOnly={readOnly}
      />

      {/* ── KPI bar ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <KpiCard
          Icon={Eye}
          label="Toplam izlenme"
          value={fmtViews(kpi.total)}
          delta={kpi.lastTotal > 0 ? kpi.totalGrowth : undefined}
          hint={`${monthTitleYm(viewMonth)}`}
          tone="info"
        />
        <KpiCard
          Icon={DollarSign}
          label="Ortalama CPM"
          value={kpi.avgCpm > 0 ? fmtUsd(kpi.avgCpm) : "—"}
          hint={kpi.totalExpense > 0 ? `Harcama ${fmtUsd(kpi.totalExpense)}` : "Harcama yok"}
          tone="warn"
        />
        <KpiCard
          Icon={Sparkles}
          label="En yüksek büyüme"
          value={kpi.topGrowth ? kpi.topGrowth.name : "—"}
          delta={kpi.topGrowth ? kpi.topGrowth.growth : undefined}
          hint={kpi.topGrowth ? `${fmtViews(kpi.topGrowth.views)} izlenme` : "Karşılaştırma yok"}
          tone="success"
        />
        <KpiCard
          Icon={Trophy}
          label="En verimli marka"
          value={topEfficient ? topEfficient.name : "—"}
          hint={
            topEfficient
              ? `CPM ${fmtUsd(topEfficient.cpm)} · ${topEfficient.linkCount} link`
              : "Harcama/izlenme eşleşmesi yok"
          }
          tone="default"
        />
      </div>

      {/* ── Tab chip selector ─────────────────────────────────────────── */}
      <div className="mb-4">
        <div
          role="tablist"
          aria-label="Grafik türü"
          className="inline-flex items-center gap-1 rounded-xl bg-muted/40 p-1 border border-border/60 overflow-x-auto max-w-full no-scrollbar"
        >
          {TABS.map(({ key, label, Icon }) => {
            const active = key === activeTab;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                  active
                    ? "bg-background text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground border border-transparent",
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2 ml-1 flex items-center gap-1.5">
          <Activity size={11} className="text-muted-foreground/70" />
          {TABS.find((t) => t.key === activeTab)?.description}
        </p>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}

      {activeTab === "trend" && (
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingUp size={14} className="text-primary" />
              Aylık izlenme trendi
            </CardTitle>
            <CardDescription className="text-xs">
              {trendRangeLabel} · Top 8 marka{showOthers ? " + diğer" : ""}
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <ModeToggle
                  ariaLabel="Aralık"
                  value={String(trendMonths) as "6" | "12"}
                  onChange={(v) => setTrendMonths(v === "12" ? 12 : 6)}
                  options={[
                    { value: "6", label: "6 ay" },
                    { value: "12", label: "12 ay" },
                  ]}
                />
                <ModeToggle
                  ariaLabel="Görünüm modu"
                  value={trendMode}
                  onChange={setTrendMode}
                  options={[
                    { value: "stacked", label: "Yığılı", Icon: Layers },
                    { value: "grouped", label: "Yan yana", Icon: Columns3 },
                    { value: "percent", label: "Yüzde", Icon: Percent },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setShowOthers((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
                    showOthers
                      ? "bg-muted/70 border-border text-foreground"
                      : "bg-background border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={showOthers}
                >
                  <Grid3x3 size={11} />
                  Diğer
                </button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            {!trendHasData || trendKeys.length === 0 ? (
              <EmptyState description="Son aylarda hiçbir markada izlenme görmek için yeterli snapshot yok." />
            ) : trendMode === "grouped" ? (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={trendData} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={fmtViews}
                  />
                  <RTooltip
                    formatter={(v: number) => fmtViews(v)}
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                  {trendKeys.map((k, i) => {
                    const brand = activeBrands.find((b) => b.shortName === k);
                    const color =
                      k === "Diğer"
                        ? OTHERS_COLOR
                        : brand
                        ? brandColorMap.get(brand.id) ?? BRAND_COLORS[i % BRAND_COLORS.length]
                        : BRAND_COLORS[i % BRAND_COLORS.length];
                    return (
                      <Bar
                        key={k}
                        dataKey={k}
                        fill={color}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 8, right: 12, left: -4, bottom: 0 }}
                  stackOffset={trendMode === "percent" ? "expand" : undefined}
                >
                  <defs>
                    {trendKeys.map((k, i) => {
                      const brand = activeBrands.find((b) => b.shortName === k);
                      const color =
                        k === "Diğer"
                          ? OTHERS_COLOR
                          : brand
                          ? brandColorMap.get(brand.id) ?? BRAND_COLORS[i % BRAND_COLORS.length]
                          : BRAND_COLORS[i % BRAND_COLORS.length];
                      return (
                        <linearGradient key={k} id={`tg-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.65} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={
                      trendMode === "percent"
                        ? (v: number) => `${Math.round(v * 100)}%`
                        : fmtViews
                    }
                    domain={trendMode === "percent" ? [0, 1] : undefined}
                  />
                  <RTooltip
                    formatter={(v: number) =>
                      trendMode === "percent" ? `${(v * 100).toFixed(1)}%` : fmtViews(v)
                    }
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                  {trendKeys.map((k, i) => {
                    const brand = activeBrands.find((b) => b.shortName === k);
                    const color =
                      k === "Diğer"
                        ? OTHERS_COLOR
                        : brand
                        ? brandColorMap.get(brand.id) ?? BRAND_COLORS[i % BRAND_COLORS.length]
                        : BRAND_COLORS[i % BRAND_COLORS.length];
                    return (
                      <Area
                        key={k}
                        type="monotone"
                        dataKey={k}
                        stackId="1"
                        stroke={color}
                        fill={`url(#tg-${i})`}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "share" && (
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <PieIcon size={14} className="text-primary" />
              Marka payı · {monthTitleYm(viewMonth)}
            </CardTitle>
            <CardDescription className="text-xs">
              {shareData.length} marka · toplam {fmtViews(totalThisMonth)} izlenme
            </CardDescription>
            <CardAction>
              <ModeToggle
                ariaLabel="Görselleştirme"
                value={shareMode}
                onChange={(v) => {
                  setShareMode(v);
                  setHighlightedBrand(null);
                }}
                options={[
                  { value: "pie", label: "Pasta", Icon: PieIcon },
                  { value: "donut", label: "Halka", Icon: Activity },
                  { value: "treemap", label: "Treemap", Icon: Grid3x3 },
                ]}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            {shareData.length === 0 ? (
              <EmptyState description="Seçili ayda hiçbir markada izlenme yok. Önce snapshot eklemen gerekiyor." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
                  {shareMode === "treemap" ? (
                    <ResponsiveContainer width="100%" height={360}>
                      <Treemap
                        data={shareData}
                        dataKey="value"
                        nameKey="name"
                        stroke="var(--background)"
                        isAnimationActive={false}
                        content={
                          <TreemapCell
                            total={totalThisMonth}
                            highlighted={highlightedBrand}
                          />
                        }
                      />
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <PieChart>
                        <Pie
                          data={shareData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={shareMode === "donut" ? 72 : 0}
                          outerRadius={130}
                          paddingAngle={shareMode === "donut" ? 1.5 : 0.5}
                          isAnimationActive={false}
                        >
                          {shareData.map((d) => {
                            const dim =
                              highlightedBrand && d.name !== highlightedBrand;
                            return (
                              <Cell
                                key={d.id}
                                fill={d.fill}
                                opacity={dim ? 0.25 : 1}
                                stroke="var(--background)"
                                strokeWidth={2}
                              />
                            );
                          })}
                        </Pie>
                        <RTooltip
                          formatter={(v: number, _name, entry) => {
                            const pct =
                              totalThisMonth > 0
                                ? ((v / totalThisMonth) * 100).toFixed(1)
                                : "0";
                            return [
                              `${fmtViews(v)} · %${pct}`,
                              entry?.payload?.name ?? "",
                            ];
                          }}
                          contentStyle={TOOLTIP_STYLE}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
                  {shareData.map((d) => {
                    const pct =
                      totalThisMonth > 0 ? (d.value / totalThisMonth) * 100 : 0;
                    const active = highlightedBrand === d.name;
                    const dim = highlightedBrand && !active;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setHighlightedBrand((curr) =>
                            curr === d.name ? null : d.name,
                          )
                        }
                        className={cn(
                          "w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border transition-all text-left",
                          active
                            ? "border-border bg-muted/60"
                            : "border-transparent hover:border-border hover:bg-muted/40",
                          dim && "opacity-50",
                        )}
                      >
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: d.fill }}
                        />
                        <span className="flex-1 font-medium truncate">
                          {d.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtViews(d.value)}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] tabular-nums shrink-0"
                        >
                          %{pct.toFixed(1)}
                        </Badge>
                      </button>
                    );
                  })}
                  {highlightedBrand ? (
                    <button
                      type="button"
                      onClick={() => setHighlightedBrand(null)}
                      className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 mt-1"
                    >
                      Highlight'ı temizle
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "bar" && (
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <BarChart3 size={14} className="text-primary" />
              Bu ay vs geçen ay
            </CardTitle>
            <CardDescription className="text-xs">
              {monthTitleYm(viewMonth)} ↔ {monthTitleYm(lastMonthYm)} ·{" "}
              {barSort === "views"
                ? "izlenmeye göre sıralı"
                : barSort === "growth"
                ? "büyümeye göre sıralı"
                : "hedef tutturma oranına göre sıralı"}
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <ModeToggle
                  ariaLabel="Sıralama"
                  value={barSort}
                  onChange={setBarSort}
                  options={[
                    { value: "views", label: "İzlenme", Icon: Eye },
                    { value: "growth", label: "Büyüme", Icon: TrendingUp },
                    { value: "target", label: "Hedef", Icon: Target },
                  ]}
                />
                <ModeToggle
                  ariaLabel="Yön"
                  value={barOrientation}
                  onChange={setBarOrientation}
                  options={[
                    { value: "horizontal", label: "Yatay", Icon: Columns3 },
                    { value: "vertical", label: "Dikey", Icon: BarChart3 },
                  ]}
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <EmptyState description="Bu ay veya geçen ay için izlenme verisi yok." />
            ) : barOrientation === "horizontal" ? (
              <ResponsiveContainer
                width="100%"
                height={Math.max(360, barData.length * 44)}
              >
                <ComposedChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  barCategoryGap="22%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={fmtViews}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    width={86}
                  />
                  <RTooltip
                    formatter={(v: number, name: string) =>
                      name === "growth" ? fmtPct(v) : fmtViews(v)
                    }
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                  <Bar
                    dataKey="lastMonth"
                    name="Geçen ay"
                    fill="#94a3b8"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="thisMonth"
                    name="Bu ay"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(360, Math.min(520, barData.length * 60))}
              >
                <BarChart
                  data={barData}
                  margin={{ top: 8, right: 12, left: -4, bottom: 36 }}
                  barCategoryGap="22%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={fmtViews}
                  />
                  <RTooltip
                    formatter={(v: number, name: string) =>
                      name === "growth" ? fmtPct(v) : fmtViews(v)
                    }
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                  <Bar
                    dataKey="lastMonth"
                    name="Geçen ay"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="thisMonth"
                    name="Bu ay"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Compact table for context */}
            {barData.length > 0 ? (
              <div className="mt-4 rounded-lg border border-border/60 overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="text-muted-foreground">
                        <th className="text-left font-medium px-3 py-2">Marka</th>
                        <th className="text-right font-medium px-3 py-2">
                          Bu ay
                        </th>
                        <th className="text-right font-medium px-3 py-2">
                          Geçen ay
                        </th>
                        <th className="text-right font-medium px-3 py-2">Büyüme</th>
                        <th className="text-right font-medium px-3 py-2">Hedef</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barData.map((d) => (
                        <tr
                          key={d.id}
                          className="border-t border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-1.5 font-medium">{d.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {fmtViews(d.thisMonth)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {fmtViews(d.lastMonth)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-1.5 text-right tabular-nums font-medium",
                              d.growth >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {d.lastMonth > 0 || d.thisMonth > 0
                              ? fmtPct(d.growth)
                              : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {d.target > 0 ? `%${d.targetPct.toFixed(0)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {activeTab === "efficiency" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Target size={14} className="text-primary" />
                Harcama × İzlenme · CPM dağılımı
              </CardTitle>
              <CardDescription className="text-xs">
                Bubble boyutu = aktif link sayısı · sol üst köşeye yakın markalar
                en verimli
              </CardDescription>
            </CardHeader>
            <CardContent>
              {efficiencyData.length === 0 ? (
                <EmptyState description="Bu ay için harcama veya izlenme verisi yok." />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Harcama"
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 11 }}
                      tickFormatter={fmtUsd}
                      label={{
                        value: "İçerik harcaması ($)",
                        position: "insideBottom",
                        offset: -8,
                        fontSize: 11,
                        fill: "var(--muted-foreground)",
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="İzlenme"
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 11 }}
                      tickFormatter={fmtViews}
                      label={{
                        value: "Toplam izlenme",
                        angle: -90,
                        position: "insideLeft",
                        offset: 18,
                        fontSize: 11,
                        fill: "var(--muted-foreground)",
                      }}
                    />
                    <ZAxis type="number" dataKey="z" range={[80, 520]} />
                    <RTooltip
                      cursor={{ strokeDasharray: "3 3", stroke: "var(--muted-foreground)" }}
                      content={<ScatterTooltip />}
                    />
                    <Scatter data={efficiencyData}>
                      {efficiencyData.map((d, i) => (
                        <Cell
                          key={d.id}
                          fill={BRAND_COLORS[i % BRAND_COLORS.length]}
                          fillOpacity={0.7}
                          stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                          strokeWidth={1.5}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {topEfficient ? (
              <div className="relative overflow-hidden rounded-xl border border-emerald-200/70 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-emerald-50/20 to-transparent dark:from-emerald-950/40 dark:via-emerald-950/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg p-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Trophy size={14} />
                  </div>
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300">
                    En verimli marka
                  </div>
                </div>
                <div className="text-xl font-semibold mb-0.5">
                  {topEfficient.name}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  Her 1.000 izlenme için yalnızca {fmtUsd(topEfficient.cpm)} harcama.
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md bg-background/60 border border-border/50 p-2">
                    <div className="text-muted-foreground">İzlenme</div>
                    <div className="font-semibold tabular-nums">
                      {fmtViews(topEfficient.y)}
                    </div>
                  </div>
                  <div className="rounded-md bg-background/60 border border-border/50 p-2">
                    <div className="text-muted-foreground">Harcama</div>
                    <div className="font-semibold tabular-nums">
                      {fmtUsd(topEfficient.x)}
                    </div>
                  </div>
                  <div className="rounded-md bg-background/60 border border-border/50 p-2">
                    <div className="text-muted-foreground">CPM</div>
                    <div className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {fmtUsd(topEfficient.cpm)}
                    </div>
                  </div>
                  <div className="rounded-md bg-background/60 border border-border/50 p-2">
                    <div className="text-muted-foreground">Aktif link</div>
                    <div className="font-semibold tabular-nums">
                      {topEfficient.linkCount}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Verimlilik karşılaştırması için hem harcaması hem de izlenmesi olan en
                az bir marka gerekiyor.
              </div>
            )}

            {efficiencyData.length > 0 ? (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground bg-muted/40 border-b border-border/60">
                  CPM sıralaması
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {[...efficiencyData]
                    .filter((d) => d.x > 0 && d.y > 0)
                    .sort((a, b) => a.cpm - b.cpm)
                    .map((d, i) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: BRAND_COLORS[
                              efficiencyData.findIndex((x) => x.id === d.id) %
                                BRAND_COLORS.length
                            ],
                          }}
                        />
                        <span className="font-medium flex-1 truncate">
                          {d.name}
                        </span>
                        <span
                          className={cn(
                            "tabular-nums",
                            i === 0
                              ? "font-semibold text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {fmtUsd(d.cpm)}
                        </span>
                      </div>
                    ))}
                  {efficiencyData.filter((d) => d.x > 0 && d.y > 0).length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground">
                      CPM hesaplaması için eşleşen veri yok.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
