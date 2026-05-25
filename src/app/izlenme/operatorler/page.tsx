"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  Users,
  Crown,
  Medal,
  Trophy,
  Star,
  TrendingUp,
  TrendingDown,
  Search,
  LayoutGrid,
  List,
  Activity,
  Target,
  Award,
  Briefcase,
  Sparkles,
  ArrowUpRight,
  X,
  Link2,
  CircleDot,
} from "lucide-react";
import { useStore, type BrandLink } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  linkViewsForMonth,
  totalLinkViewsForMonth,
} from "@/lib/brand-month-metrics";
import { shiftCalendarMonthYm } from "@/lib/data";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  AreaChart,
  Area,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────
const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

const shortMonth = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "short" });

// Renk paletinde top yayıncılar için sıralı paleti tutuyoruz.
const PIE_COLORS = [
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo (others)
];

const RANK_DOT: Record<number, { className: string; icon: typeof Crown }> = {
  1: { className: "text-amber-500", icon: Crown },
  2: { className: "text-slate-400", icon: Medal },
  3: { className: "text-orange-600 dark:text-orange-400", icon: Trophy },
};

type SortMode = "views" | "links" | "brands" | "alignment";
type ViewMode = "list" | "grid";
type StatusFilter = "active" | "all";

interface OperatorRow {
  employeeId: string;
  name: string;
  role: string;
  avatar: string;
  status: "active" | "inactive";
  views: number;
  prevViews: number;
  mom: number | null;
  brandIds: string[];
  topBrands: { id: string; name: string; views: number }[];
  linkCount: number;
  activeLinkCount: number;
  links: BrandLink[];
  sparkline: { ym: string; label: string; views: number }[];
  alignment: number | null; // hedef hizalama yüzdesi
  targetSum: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small subcomponents (aynı dosyada, sadece bu sayfada kullanılıyor)
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "violet",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  tone?: "violet" | "blue" | "emerald" | "amber";
}) {
  const toneClasses: Record<string, string> = {
    violet:
      "from-violet-500/10 to-violet-500/0 border-violet-200/60 dark:border-violet-500/30 text-violet-700 dark:text-violet-300",
    blue: "from-blue-500/10 to-blue-500/0 border-blue-200/60 dark:border-blue-500/30 text-blue-700 dark:text-blue-300",
    emerald:
      "from-emerald-500/10 to-emerald-500/0 border-emerald-200/60 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    amber:
      "from-amber-500/10 to-amber-500/0 border-amber-200/60 dark:border-amber-500/30 text-amber-700 dark:text-amber-300",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${toneClasses[tone]} p-3 sm:p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {label}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
          {hint && (
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground truncate">
              {hint}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-lg bg-background/60 backdrop-blur-sm border border-border/40 p-1.5">
          <Icon size={14} />
        </span>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cfg = RANK_DOT[rank];
  if (!cfg) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/60 text-[10px] font-mono font-semibold text-muted-foreground">
        {rank}
      </span>
    );
  }
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border ${cfg.className}`}
      title={`#${rank}`}
    >
      <Icon size={12} />
    </span>
  );
}

function Sparkline({
  data,
  color = "#8b5cf6",
  height = 32,
  width = 100,
}: {
  data: { ym: string; label: string; views: number }[];
  color?: string;
  height?: number;
  width?: number | string;
}) {
  if (!data.length || data.every((d) => d.views === 0)) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-muted-foreground/60"
        style={{ height, width }}
      >
        —
      </div>
    );
  }
  const gid = `sg-${color.replace("#", "")}`;
  return (
    <div style={{ height, width }} className="pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="views"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gid})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MomChip({ mom }: { mom: number | null }) {
  if (mom == null || !Number.isFinite(mom)) {
    return <span className="text-[10px] text-muted-foreground tabular-nums">—</span>;
  }
  const up = mom >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] tabular-nums font-medium ${
        up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
      }`}
    >
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? "+" : ""}
      {mom.toFixed(1)}%
    </span>
  );
}

function AlignmentBar({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="text-[10px] text-muted-foreground italic">hedef yok</span>;
  }
  const clamped = Math.max(0, Math.min(100, pct));
  const tone =
    clamped >= 100
      ? "bg-emerald-500"
      : clamped >= 75
        ? "bg-blue-500"
        : clamped >= 40
          ? "bg-amber-500"
          : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted/70 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-right">
        %{Math.round(clamped)}
      </span>
    </div>
  );
}

function StreamerAvatar({
  name,
  avatar,
  size = "md",
}: {
  name: string;
  avatar?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initial = (avatar || name?.[0] || "?").toUpperCase();
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  // Yayıncıya göre stabil renk
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = [
    "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  ];
  const tone = palette[hash % palette.length];
  return (
    <Avatar className={sizes[size]}>
      <AvatarFallback className={`font-bold ${tone}`}>{initial}</AvatarFallback>
    </Avatar>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Operatör / yayıncı bazlı izlenme dağılımı.
 * Aynı kişinin farklı markalarda ne kadar izlenme ürettiğini gösterir.
 */
export default function OperatorlerPage() {
  const readOnly = useIsReadOnly();
  const { employees, brands, brandLinks, linkSnapshots, brandViewership } = useStore();
  const { viewMonth, setViewMonth, todayYm } = useIzlenmeViewMonth();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("views");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const prevMonth = shiftCalendarMonthYm(viewMonth, -1);

  // Son 6 ay
  const months6 = useMemo(() => {
    const arr: { ym: string; label: string }[] = [];
    for (let i = -5; i <= 0; i++) {
      const ym = shiftCalendarMonthYm(viewMonth, i);
      arr.push({ ym, label: shortMonth(ym) });
    }
    return arr;
  }, [viewMonth]);

  // Tüm operatör satırları (filtre uygulanmadan önce — KPI ve grafikler için)
  const allRows = useMemo<OperatorRow[]>(() => {
    type Acc = {
      employeeId: string;
      views: number;
      prevViews: number;
      brandIds: Set<string>;
      brandViews: Map<string, number>;
      links: BrandLink[];
      activeLinkCount: number;
    };
    const acc = new Map<string, Acc>();

    for (const l of brandLinks) {
      if (!l.ownerId) continue;
      const v = linkViewsForMonth(l, viewMonth, linkSnapshots, todayYm).lastViews;
      const vPrev = linkViewsForMonth(l, prevMonth, linkSnapshots, todayYm).lastViews;
      const cur =
        acc.get(l.ownerId) ??
        ({
          employeeId: l.ownerId,
          views: 0,
          prevViews: 0,
          brandIds: new Set<string>(),
          brandViews: new Map<string, number>(),
          links: [],
          activeLinkCount: 0,
        } satisfies Acc);
      cur.views += v;
      cur.prevViews += vPrev;
      cur.brandIds.add(l.brandId);
      cur.brandViews.set(l.brandId, (cur.brandViews.get(l.brandId) ?? 0) + v);
      cur.links.push(l);
      if (l.status === "active") cur.activeLinkCount += 1;
      acc.set(l.ownerId, cur);
    }

    for (const v of brandViewership) {
      if (v.month !== viewMonth || !v.employeeId) continue;
      const cur =
        acc.get(v.employeeId) ??
        ({
          employeeId: v.employeeId,
          views: 0,
          prevViews: 0,
          brandIds: new Set<string>(),
          brandViews: new Map<string, number>(),
          links: [],
          activeLinkCount: 0,
        } satisfies Acc);
      cur.views += v.views;
      const vPrevRow = brandViewership.find(
        (x) =>
          x.employeeId === v.employeeId &&
          x.brandId === v.brandId &&
          x.month === prevMonth
      );
      cur.prevViews += vPrevRow?.views ?? 0;
      if (v.brandId) {
        cur.brandIds.add(v.brandId);
        cur.brandViews.set(v.brandId, (cur.brandViews.get(v.brandId) ?? 0) + v.views);
      }
      acc.set(v.employeeId, cur);
    }

    return Array.from(acc.values()).map((a) => {
      const emp = employees.find((e) => e.id === a.employeeId);
      const brandList = Array.from(a.brandIds);

      // Top 3 marka (bu ayki izlenmeye göre)
      const topBrands = brandList
        .map((bid) => {
          const b = brands.find((x) => x.id === bid);
          return {
            id: bid,
            name: b?.shortName ?? "?",
            views: a.brandViews.get(bid) ?? 0,
          };
        })
        .sort((x, y) => y.views - x.views)
        .slice(0, 3);

      // 6 aylık sparkline
      const sparkline = months6.map(({ ym, label }) => {
        const manual = brandViewership
          .filter((v) => v.employeeId === a.employeeId && v.month === ym)
          .reduce((s, v) => s + v.views, 0);
        return {
          ym,
          label,
          views: totalLinkViewsForMonth(a.links, ym, linkSnapshots, todayYm) + manual,
        };
      });

      // Hedef hizalama: yayıncının yönettiği markaların toplam aylık hedefi vs bu ay izlenmesi
      const targetSum = brandList.reduce((s, bid) => {
        const b = brands.find((x) => x.id === bid);
        return s + (b?.monthlyTarget ?? 0);
      }, 0);
      const alignment = targetSum > 0 ? (a.views / targetSum) * 100 : null;

      const mom =
        a.prevViews > 0 ? ((a.views - a.prevViews) / a.prevViews) * 100 : null;

      return {
        employeeId: a.employeeId,
        name: emp?.name ?? "?",
        role: emp?.role ?? "Yayıncı",
        avatar: emp?.avatar ?? "",
        status: (emp?.status ?? "active") as "active" | "inactive",
        views: a.views,
        prevViews: a.prevViews,
        mom,
        brandIds: brandList,
        topBrands,
        linkCount: a.links.length,
        activeLinkCount: a.activeLinkCount,
        links: a.links,
        sparkline,
        alignment,
        targetSum,
      } satisfies OperatorRow;
    });
  }, [brandLinks, brandViewership, linkSnapshots, viewMonth, prevMonth, todayYm, employees, brands, months6]);

  // Filter + sort
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allRows.filter((r) => {
      if (statusFilter === "active" && r.status !== "active") return false;
      if (q) {
        const hay = `${r.name} ${r.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case "links":
          return b.linkCount - a.linkCount || b.views - a.views;
        case "brands":
          return b.brandIds.length - a.brandIds.length || b.views - a.views;
        case "alignment": {
          const av = a.alignment ?? -1;
          const bv = b.alignment ?? -1;
          return bv - av;
        }
        case "views":
        default:
          return b.views - a.views;
      }
    });
    return sorted;
  }, [allRows, statusFilter, search, sortMode]);

  // KPIs
  const grandTotal = allRows.reduce((s, r) => s + r.views, 0);
  const totalOwners = allRows.length;
  const topRow = allRows.slice().sort((a, b) => b.views - a.views)[0];
  const avgPerOwner = totalOwners > 0 ? grandTotal / totalOwners : 0;
  const multiBrandCount = allRows.filter((r) => r.brandIds.length > 1).length;

  // Pie: top 8 + Diğerleri
  const pieData = useMemo(() => {
    const sorted = allRows.slice().sort((a, b) => b.views - a.views).filter((r) => r.views > 0);
    if (sorted.length <= 8) {
      return sorted.map((r) => ({ name: r.name, value: r.views }));
    }
    const top8 = sorted.slice(0, 8);
    const rest = sorted.slice(8).reduce((s, r) => s + r.views, 0);
    return [
      ...top8.map((r) => ({ name: r.name, value: r.views })),
      { name: "Diğerleri", value: rest },
    ];
  }, [allRows]);

  // Bar: top 10
  const barData = useMemo(() => {
    return allRows
      .slice()
      .sort((a, b) => b.views - a.views)
      .filter((r) => r.views > 0)
      .slice(0, 10)
      .map((r) => ({ name: r.name, views: r.views }));
  }, [allRows]);

  // Navbar için aktif link / yayıncı toplamları
  const navTotalLinks = brandLinks.filter((l) => l.status === "active").length;
  const navTotalOwners = new Set(brandLinks.map((l) => l.ownerId).filter(Boolean)).size;

  const selected = useMemo(
    () => (selectedId ? allRows.find((r) => r.employeeId === selectedId) ?? null : null),
    [selectedId, allRows]
  );

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        totalBrands={brands.filter((b) => b.status === "active").length}
        totalStreamers={navTotalOwners}
        totalLinks={navTotalLinks}
        totalViews={grandTotal}
        readOnly={readOnly}
      />

      {/* KPI BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
        <KpiCard
          icon={Users}
          tone="violet"
          label="Toplam yayıncı"
          value={totalOwners.toLocaleString("tr-TR")}
          hint={`${monthTitleYm(viewMonth)} · katkı sağlayan`}
        />
        <KpiCard
          icon={Crown}
          tone="amber"
          label="Top yayıncı"
          value={topRow ? fmtViews(topRow.views) : "—"}
          hint={topRow ? topRow.name : "veri yok"}
        />
        <KpiCard
          icon={Activity}
          tone="blue"
          label="Ortalama izlenme"
          value={fmtViews(Math.round(avgPerOwner))}
          hint="yayıncı başına"
        />
        <KpiCard
          icon={Sparkles}
          tone="emerald"
          label="Çoklu marka"
          value={multiBrandCount.toLocaleString("tr-TR")}
          hint="2+ markada görev alan"
        />
      </div>

      {/* CHARTS: Pie + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CircleDot size={14} className="text-violet-500" /> İzlenme payı
            </CardTitle>
            <CardDescription className="text-[11px]">
              Top 8 yayıncı + diğerleri · {monthTitleYm(viewMonth)}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {pieData.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-8 text-center">
                Bu ay için yayıncı verisi yok.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={82}
                      paddingAngle={1}
                      stroke="none"
                    >
                      {pieData.map((d, i) => (
                        <Cell
                          key={d.name}
                          fill={
                            d.name === "Diğerleri"
                              ? "#94a3b8"
                              : PIE_COLORS[i % PIE_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(v: number) => fmtViews(v)}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                  {pieData.map((d, i) => {
                    const pct = grandTotal > 0 ? (d.value / grandTotal) * 100 : 0;
                    return (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{
                            backgroundColor:
                              d.name === "Diğerleri"
                                ? "#94a3b8"
                                : PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                        <span className="flex-1 font-medium truncate">{d.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtViews(d.value)}
                        </span>
                        <Badge variant="outline" className="text-[10px] tabular-nums">
                          %{pct.toFixed(1)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Award size={14} className="text-amber-500" /> Top 10 yayıncı · bu ay
            </CardTitle>
            <CardDescription className="text-[11px]">
              En çok izlenme üreten yayıncılar
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {barData.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-8 text-center">
                Bu ay için yayıncı verisi yok.
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, barData.length * 28)}
              >
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10 }}
                    tickFormatter={fmtViews}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    width={84}
                  />
                  <RTooltip
                    formatter={(v: number) => fmtViews(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="views" radius={[0, 6, 6, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FILTER BAR + LEADERBOARD */}
      <Card>
        <CardHeader className="pb-2 gap-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-1.5">
                <Users size={15} /> Yayıncı leaderboard
              </CardTitle>
              <CardDescription className="text-xs">
                {monthTitleYm(viewMonth)} · {rows.length} yayıncı
                {rows.length !== allRows.length ? ` · ${allRows.length} toplam` : ""}
              </CardDescription>
            </div>
            <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                title="Liste görünümü"
                className={`inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List size={12} /> Liste
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                title="Kart görünümü"
                className={`inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] font-medium transition-colors ${
                  viewMode === "grid"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid size={12} /> Kart
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-[280px]">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Yayıncı ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="!h-8 !text-xs !pl-7"
              />
            </div>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-8 text-xs rounded-md border border-border bg-background px-2 cursor-pointer"
              title="Sıralama"
            >
              <option value="views">En yüksek izlenme</option>
              <option value="links">En çok link</option>
              <option value="brands">En çok marka</option>
              <option value="alignment">En iyi hedef hizalama</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-8 text-xs rounded-md border border-border bg-background px-2 cursor-pointer"
              title="Durum"
            >
              <option value="active">Aktif</option>
              <option value="all">Tümü</option>
            </select>

            {(search || sortMode !== "views" || statusFilter !== "active") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSortMode("views");
                  setStatusFilter("active");
                }}
                className="h-8 text-[11px] gap-1"
              >
                <X size={11} /> Filtreleri temizle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-10 text-center">
              {allRows.length === 0
                ? "Bu ay için operatör verisi yok."
                : "Filtreyle eşleşen yayıncı yok."}
            </p>
          ) : viewMode === "list" ? (
            <LeaderboardList
              rows={rows}
              grandTotal={grandTotal}
              onOpen={setSelectedId}
            />
          ) : (
            <LeaderboardGrid
              rows={rows}
              grandTotal={grandTotal}
              onOpen={setSelectedId}
            />
          )}
        </CardContent>
      </Card>

      {/* DETAY MODAL */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <StreamerAvatar
                    name={selected.name}
                    avatar={selected.avatar}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-base flex items-center gap-2">
                      {selected.name}
                      {selected.status !== "active" && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-border text-muted-foreground"
                        >
                          inactive
                        </Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {selected.role} · {monthTitleYm(viewMonth)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Mini KPI ızgarası */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    İzlenme
                  </p>
                  <p className="text-sm font-bold tabular-nums inline-flex items-center gap-1">
                    <Eye size={11} /> {fmtViews(selected.views)}
                  </p>
                  <div className="mt-0.5">
                    <MomChip mom={selected.mom} />
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Marka
                  </p>
                  <p className="text-sm font-bold tabular-nums inline-flex items-center gap-1">
                    <Briefcase size={11} /> {selected.brandIds.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Aktif link
                  </p>
                  <p className="text-sm font-bold tabular-nums inline-flex items-center gap-1">
                    <Link2 size={11} /> {selected.activeLinkCount}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      / {selected.linkCount}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Hedef
                  </p>
                  <p className="text-sm font-bold tabular-nums inline-flex items-center gap-1">
                    <Target size={11} />
                    {selected.alignment != null
                      ? `%${Math.round(selected.alignment)}`
                      : "—"}
                  </p>
                  {selected.targetSum > 0 && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtViews(selected.targetSum)} hedef
                    </p>
                  )}
                </div>
              </div>

              {/* 6 ay sparkline */}
              <div className="mt-3 rounded-lg border border-border/60 bg-card p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Son 6 ay izlenme trendi
                </p>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart
                    data={selected.sparkline}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="modal-spark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 10 }}
                      tickFormatter={fmtViews}
                      width={36}
                    />
                    <RTooltip
                      formatter={(v: number) => fmtViews(v)}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#modal-spark)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Marka kırılımı */}
              <div className="mt-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Marka kırılımı
                </p>
                <div className="space-y-1.5">
                  {selected.brandIds.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Marka yok.</p>
                  ) : (
                    selected.brandIds
                      .map((bid) => {
                        const b = brands.find((x) => x.id === bid);
                        const brandLinksOfStreamer = selected.links.filter(
                          (l) => l.brandId === bid
                        );
                        const v = brandLinksOfStreamer.reduce(
                          (s, l) =>
                            s +
                            linkViewsForMonth(l, viewMonth, linkSnapshots, todayYm)
                              .lastViews,
                          0
                        );
                        return { bid, name: b?.shortName ?? "?", links: brandLinksOfStreamer, v };
                      })
                      .sort((a, b) => b.v - a.v)
                      .map((r) => {
                        const pct =
                          selected.views > 0 ? (r.v / selected.views) * 100 : 0;
                        return (
                          <div
                            key={r.bid}
                            className="flex items-center gap-2 p-2 rounded-md border border-border/60 bg-card"
                          >
                            <span className="text-xs font-semibold w-20 truncate">
                              {r.name}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted/70 overflow-hidden">
                              <div
                                className="h-full bg-violet-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] tabular-nums w-14 text-right">
                              {fmtViews(r.v)}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] tabular-nums w-12 justify-center"
                            >
                              {r.links.length} link
                            </Badge>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Link listesi */}
              <div className="mt-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Linkler ({selected.links.length})
                </p>
                <div className="rounded-md border border-border/60 max-h-[220px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 px-2 font-medium">Marka</th>
                        <th className="py-1.5 px-2 font-medium">Platform</th>
                        <th className="py-1.5 px-2 font-medium">Handle</th>
                        <th className="py-1.5 px-2 font-medium text-right">İzlenme</th>
                        <th className="py-1.5 px-2 font-medium text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.links.map((l) => {
                        const v = linkViewsForMonth(
                          l,
                          viewMonth,
                          linkSnapshots,
                          todayYm
                        ).lastViews;
                        const b = brands.find((x) => x.id === l.brandId);
                        return (
                          <tr
                            key={l.id}
                            className="border-t border-border/50 hover:bg-accent/20"
                          >
                            <td className="py-1.5 px-2 font-medium">
                              {b?.shortName ?? "?"}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground">
                              {l.platform}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[140px]">
                              {l.url ? (
                                <a
                                  href={l.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 hover:text-primary"
                                >
                                  {l.handle || l.url}
                                  <ArrowUpRight size={10} className="opacity-60" />
                                </a>
                              ) : (
                                l.handle || "—"
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {v > 0 ? fmtViews(v) : "—"}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span
                                className={`inline-flex items-center gap-0.5 text-[10px] ${
                                  l.status === "active"
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-muted-foreground"
                                }`}
                              >
                                <Star size={9} />
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard variants
// ─────────────────────────────────────────────────────────────────────────────

function LeaderboardList({
  rows,
  grandTotal,
  onOpen,
}: {
  rows: OperatorRow[];
  grandTotal: number;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pl-2 pr-2 font-medium w-10">#</th>
            <th className="pb-2 pr-2 font-medium">Yayıncı</th>
            <th className="pb-2 pr-2 font-medium text-center">Marka</th>
            <th className="pb-2 pr-2 font-medium text-center">Link</th>
            <th className="pb-2 pr-2 font-medium text-right">İzlenme</th>
            <th className="pb-2 pr-2 font-medium text-right">MoM</th>
            <th className="pb-2 pr-2 font-medium">6 ay</th>
            <th className="pb-2 pr-2 font-medium">Hedef</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = grandTotal > 0 ? (r.views / grandTotal) * 100 : 0;
            return (
              <tr
                key={r.employeeId}
                onClick={() => onOpen(r.employeeId)}
                className="border-b border-border/40 hover:bg-accent/30 cursor-pointer transition-colors"
              >
                <td className="py-2 pl-2 pr-2">
                  <RankBadge rank={i + 1} />
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StreamerAvatar name={r.name} avatar={r.avatar} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold truncate inline-flex items-center gap-1.5">
                        {r.name}
                        {r.status !== "active" && (
                          <Badge
                            variant="outline"
                            className="text-[9px] border-border text-muted-foreground"
                          >
                            inactive
                          </Badge>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {r.role}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-2 pr-2 text-center">
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    {r.brandIds.length}
                  </Badge>
                </td>
                <td className="py-2 pr-2 text-center">
                  <span className="text-xs tabular-nums">
                    {r.activeLinkCount}
                    {r.linkCount !== r.activeLinkCount && (
                      <span className="text-[10px] text-muted-foreground">
                        /{r.linkCount}
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2 pr-2 text-right">
                  <p className="font-bold tabular-nums inline-flex items-center gap-1">
                    <Eye size={11} className="text-muted-foreground" />
                    {fmtViews(r.views)}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    %{pct.toFixed(1)} · pay
                  </p>
                </td>
                <td className="py-2 pr-2 text-right">
                  <MomChip mom={r.mom} />
                </td>
                <td className="py-2 pr-2">
                  <Sparkline data={r.sparkline} color="#8b5cf6" width={110} height={28} />
                </td>
                <td className="py-2 pr-2">
                  <AlignmentBar pct={r.alignment} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardGrid({
  rows,
  grandTotal,
  onOpen,
}: {
  rows: OperatorRow[];
  grandTotal: number;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((r, i) => {
        const pct = grandTotal > 0 ? (r.views / grandTotal) * 100 : 0;
        return (
          <button
            key={r.employeeId}
            type="button"
            onClick={() => onOpen(r.employeeId)}
            className="text-left rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:bg-accent/20 transition-colors p-3 sm:p-4 group"
          >
            <div className="flex items-start gap-3">
              <StreamerAvatar name={r.name} avatar={r.avatar} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <RankBadge rank={i + 1} />
                  <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {r.name}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{r.role}</p>
              </div>
              <ArrowUpRight
                size={14}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground"
              />
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  İzlenme
                </p>
                <p className="text-lg font-bold tabular-nums inline-flex items-center gap-1">
                  <Eye size={12} className="text-muted-foreground" />
                  {fmtViews(r.views)}
                </p>
                <div className="flex items-center gap-1.5">
                  <MomChip mom={r.mom} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    · %{pct.toFixed(1)} pay
                  </span>
                </div>
              </div>
              <Sparkline data={r.sparkline} color="#8b5cf6" width={90} height={36} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {r.topBrands.length === 0 ? (
                <span className="text-[10px] text-muted-foreground italic">
                  Marka yok
                </span>
              ) : (
                r.topBrands.map((b) => (
                  <Badge
                    key={b.id}
                    variant="outline"
                    className="text-[10px] gap-1 font-normal"
                  >
                    {b.name}
                    <span className="tabular-nums text-muted-foreground">
                      {fmtViews(b.views)}
                    </span>
                  </Badge>
                ))
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-md bg-muted/40 px-2 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  Marka
                </p>
                <p className="font-semibold tabular-nums">{r.brandIds.length}</p>
              </div>
              <div className="rounded-md bg-muted/40 px-2 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  Link
                </p>
                <p className="font-semibold tabular-nums">
                  {r.activeLinkCount}
                  {r.linkCount !== r.activeLinkCount && (
                    <span className="text-[10px] text-muted-foreground">
                      /{r.linkCount}
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 px-2 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  Hedef
                </p>
                <p className="font-semibold tabular-nums">
                  {r.alignment != null ? `%${Math.round(r.alignment)}` : "—"}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
