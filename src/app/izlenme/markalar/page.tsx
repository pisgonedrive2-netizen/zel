"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  ChevronRight,
  Eye,
  Flame,
  Layers,
  Link2,
  Rocket,
  Search,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandExpenseShareUsd } from "@/lib/content-expense-brands";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { useStore } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { cn } from "@/lib/utils";
import {
  brandContentExpensesForMonth,
  linkViewsForMonth,
  sumBrandContentExpensesForMonth,
  totalLinkViewsForMonth,
} from "@/lib/brand-month-metrics";
import { buildBrandMonthExportPayload } from "@/lib/izlenme-brand-export";
import {
  downloadBrandMonthPdf,
  downloadMarkalarOverviewCsv,
  downloadMarkalarOverviewPdf,
} from "@/lib/marka-izlenme-pdf";
import {
  findBrandMonthlyStats,
  fmtBrandCount,
  fmtBrandMoney,
  hasBrandMonthlyStatsData,
} from "@/lib/brand-monthly-stats";
import { shiftCalendarMonthYm } from "@/lib/data";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { ViewershipReloadBanner } from "@/components/izlenme/viewership-reload-banner";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";

type SortKey = "views" | "target" | "growth";
type StatusKey = "active" | "paused" | "inactive" | "all";

const SORT_OPTIONS: { value: SortKey; label: string; icon: ReactNode }[] = [
  { value: "views", label: "Toplam izlenme", icon: <Eye size={11} /> },
  { value: "growth", label: "Artış %", icon: <TrendingUp size={11} /> },
  { value: "target", label: "Hedef tutturma", icon: <Target size={11} /> },
];

const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "paused", label: "Duraklatılmış" },
  { value: "inactive", label: "Pasif" },
  { value: "all", label: "Tümü" },
];

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

const monthShort = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "short" });

/** "Son içerik: 12 Nis · 2 ay önce" gibi etiket. */
function lastContentDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return datePart;
  if (diffDays < 30) return `${datePart} · ${diffDays} gün önce`;
  const months = Math.floor(diffDays / 30);
  return `${datePart} · ${months} ay önce`;
}

/**
 * `/izlenme/markalar` — marka odaklı operasyon özet sayfası.
 *
 * Üst KPI bandı + yüksek performans vurguları + filtre çubuğu + kart ızgarası
 * + marka × yayıncı kırılım tablosu. Her kart `/izlenme/marka/[brandId]` detay
 * sayfasına derin link verir, salt-okunur kullanıcılar için CRUD aksiyonu yok.
 */
export default function MarkalarPage() {
  const readOnly = useIsReadOnly();
  const {
    brands,
    brandLinks,
    linkSnapshots,
    contentExpenses,
    brandViewership,
    brandMonthlyStats,
    employees,
    weekBrandReels,
  } = useStore();

  const {
    viewMonth,
    setViewMonth,
    todayYm,
    linkScope,
    setLinkScope,
    apiDateMode,
    setApiDateMode,
    filterLinks,
  } = useIzlenmeViewMonth();
  const scopedLinks = useMemo(
    () => filterLinks(brandLinks, linkSnapshots),
    [brandLinks, linkSnapshots, filterLinks]
  );
  const allActiveLinkCount = useMemo(
    () => brandLinks.filter((l) => l.status === "active").length,
    [brandLinks]
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("views");

  const prevMonth = shiftCalendarMonthYm(viewMonth, -1);

  // Kategori chip'leri için benzersiz sıralı liste
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const b of brands) {
      const c = (b.category ?? "").trim();
      if (c) seen.add(c);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, "tr"));
  }, [brands]);

  // Tüm markaların hesaplanmış metrikleri (filtre ÖNCESİ, KPI/top performans için)
  const allRows = useMemo(() => {
    return brands.map((brand) => {
      const links = scopedLinks.filter((l) => l.brandId === brand.id);
      const totalNow = totalLinkViewsForMonth(links, viewMonth, linkSnapshots, todayYm);
      const totalPrev = totalLinkViewsForMonth(links, prevMonth, linkSnapshots, todayYm);
      const monthExpenses = brandContentExpensesForMonth(
        contentExpenses,
        brand,
        viewMonth,
        brands
      );
      const totalExpense = sumBrandContentExpensesForMonth(
        contentExpenses,
        brand,
        viewMonth,
        brands
      );
      const ownerIds = Array.from(
        new Set(links.map((l) => l.ownerId).filter((v): v is string => Boolean(v)))
      );
      const mom = totalPrev > 0 ? ((totalNow - totalPrev) / totalPrev) * 100 : null;
      const target = brand.monthlyTarget ?? null;
      const targetPct =
        target && target > 0 ? Math.min(999, (totalNow / target) * 100) : null;

      // 6 aylık sparkline serisi (eskiden yeniye)
      const spark: { month: string; views: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const ym = shiftCalendarMonthYm(viewMonth, -i);
        spark.push({
          month: ym,
          views: totalLinkViewsForMonth(links, ym, linkSnapshots, todayYm),
        });
      }

      // Bu marka için en son içerik harcaması tarihi (tüm geçmiş) ve toplam
      let lastContentDate: string | null = null;
      let lifetimeContentUsd = 0;
      let lifetimeContentCount = 0;
      for (const e of contentExpenses) {
        const share = brandExpenseShareUsd(e, brand.id, brands);
        if (share <= 0) continue;
        lifetimeContentUsd += share;
        lifetimeContentCount += 1;
        const d = e.date ?? `${e.month}-01`;
        if (!lastContentDate || d > lastContentDate) lastContentDate = d;
      }

      return {
        brand,
        links,
        ownerCount: ownerIds.length,
        totalNow,
        totalPrev,
        totalExpense,
        monthExpenseCount: monthExpenses.length,
        lastContentDate,
        lifetimeContentUsd,
        lifetimeContentCount,
        mom,
        target,
        targetPct,
        spark,
      };
    });
  }, [brands, scopedLinks, linkSnapshots, contentExpenses, viewMonth, prevMonth, todayYm]);

  // Filtre + sıralama
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allRows.filter(({ brand }) => {
      if (statusFilter !== "all" && brand.status !== statusFilter) return false;
      if (categoryFilter !== "all" && (brand.category ?? "") !== categoryFilter) return false;
      if (q) {
        const hay = `${brand.name} ${brand.shortName} ${brand.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "growth") {
        const av = a.mom ?? -Infinity;
        const bv = b.mom ?? -Infinity;
        if (av === bv) return b.totalNow - a.totalNow;
        return bv - av;
      }
      if (sortKey === "target") {
        const av = a.targetPct ?? -Infinity;
        const bv = b.targetPct ?? -Infinity;
        if (av === bv) return b.totalNow - a.totalNow;
        return bv - av;
      }
      return b.totalNow - a.totalNow;
    });
    return sorted;
  }, [allRows, search, statusFilter, categoryFilter, sortKey]);

  // KPI özet metrikleri
  const kpi = useMemo(() => {
    const active = allRows.filter((r) => r.brand.status === "active");
    const monthViews = active.reduce((s, r) => s + r.totalNow, 0);

    // Platform bazlı toplam izlenme — bu ay
    const platformMap = new Map<string, number>();
    for (const r of active) {
      for (const link of r.links) {
        if (link.status !== "active") continue;
        const v = linkViewsForMonth(link, viewMonth, linkSnapshots, todayYm).lastViews;
        if (v <= 0) continue;
        platformMap.set(link.platform, (platformMap.get(link.platform) ?? 0) + v);
      }
    }
    let topPlatform: { name: string; views: number } | null = null;
    for (const [name, views] of platformMap) {
      if (!topPlatform || views > topPlatform.views) topPlatform = { name, views };
    }

    // Ortalama hedef tutturma
    const withTarget = active.filter((r) => r.targetPct != null);
    const avgTargetPct =
      withTarget.length > 0
        ? withTarget.reduce((s, r) => s + (r.targetPct ?? 0), 0) / withTarget.length
        : null;

    return {
      activeBrandCount: active.length,
      monthViews,
      topPlatform,
      avgTargetPct,
    };
  }, [allRows, viewMonth, linkSnapshots, todayYm]);

  // Yükselişte — en yüksek pozitif artış gösteren ilk 3 aktif marka
  const topPerformers = useMemo(() => {
    return allRows
      .filter(
        (r) =>
          r.brand.status === "active" &&
          r.mom != null &&
          r.mom > 0 &&
          r.totalNow > 0
      )
      .sort((a, b) => (b.mom ?? 0) - (a.mom ?? 0))
      .slice(0, 3);
  }, [allRows]);

  const totalLinks = scopedLinks.length;
  const totalOwners = new Set(scopedLinks.map((l) => l.ownerId).filter(Boolean)).size;
  const grandTotal = allRows.reduce((s, r) => s + r.totalNow, 0);

  const operationRows = useMemo(() => {
    return brands
      .filter((b) => b.status !== "inactive")
      .map((b) => {
        const stats = findBrandMonthlyStats(brandMonthlyStats, b.id, viewMonth);
        const monthExpenses = brandContentExpensesForMonth(
          contentExpenses,
          b,
          viewMonth,
          brands
        );

        const byEmployee = new Map<string, { views: number; expenseUsd: number }>();
        for (const v of brandViewership) {
          if (v.brandId !== b.id || v.month !== viewMonth || !v.employeeId) continue;
          const cur = byEmployee.get(v.employeeId) ?? { views: 0, expenseUsd: 0 };
          cur.views += v.views;
          byEmployee.set(v.employeeId, cur);
        }
        let unassignedExpenseUsd = 0;
        for (const e of monthExpenses) {
          const empId = e.employeeId?.trim();
          if (!empId) {
            unassignedExpenseUsd += e.amountUsd;
            continue;
          }
          const cur = byEmployee.get(empId) ?? { views: 0, expenseUsd: 0 };
          cur.expenseUsd += e.amountUsd;
          byEmployee.set(empId, cur);
        }

        const streamers = [...byEmployee.entries()]
          .map(([employeeId, data]) => ({
            employeeId,
            name: employees.find((emp) => emp.id === employeeId)?.name ?? "—",
            views: data.views,
            expenseUsd: data.expenseUsd,
          }))
          .filter((s) => s.views > 0 || s.expenseUsd > 0)
          .sort(
            (a, b) =>
              b.views - a.views || b.expenseUsd - a.expenseUsd || a.name.localeCompare(b.name, "tr")
          );

        const views = streamers.reduce((s, x) => s + x.views, 0);
        const expenseUsd = sumBrandContentExpensesForMonth(
          contentExpenses,
          b,
          viewMonth,
          brands
        );
        const assignedExpenseUsd = expenseUsd - unassignedExpenseUsd;
        const cpr =
          stats && stats.newRegistrations > 0 ? expenseUsd / stats.newRegistrations : null;

        return {
          brand: b,
          stats,
          views,
          expenseUsd,
          assignedExpenseUsd,
          unassignedExpenseUsd,
          streamers,
          cpr,
        };
      })
      .sort((a, b) => {
        const aHas = a.stats && hasBrandMonthlyStatsData(a.stats) ? 1 : 0;
        const bHas = b.stats && hasBrandMonthlyStatsData(b.stats) ? 1 : 0;
        return bHas - aHas || b.views - a.views;
      });
  }, [brands, brandMonthlyStats, brandViewership, contentExpenses, employees, viewMonth]);

  const exportOverview = (kind: "pdf" | "csv") => {
    try {
      const payload = {
        monthYm: viewMonth,
        monthTitle: monthTitleYm(viewMonth),
        rows: rows.map((r) => ({
          marka: r.brand.name,
          kisa: r.brand.shortName,
          izlenme: fmtViews(r.totalNow),
          oncekiAy: fmtViews(r.totalPrev),
          degisim:
            r.mom == null ? "—" : `${r.mom >= 0 ? "+" : ""}${r.mom.toFixed(1)}%`,
          harcama:
            r.totalExpense > 0
              ? `$${r.totalExpense.toLocaleString("tr-TR")}`
              : "—",
          link: String(r.links.length),
          yayinci: String(r.ownerCount),
          hedef:
            r.target != null && r.target > 0
              ? `${fmtViews(r.target)} · ${r.targetPct != null ? `${r.targetPct.toFixed(0)}%` : "—"}`
              : r.targetPct != null
                ? `${r.targetPct.toFixed(0)}%`
                : "—",
          durum: r.brand.status,
        })),
      };
      if (kind === "pdf") downloadMarkalarOverviewPdf(payload);
      else downloadMarkalarOverviewCsv(payload);
    } catch (err) {
      window.alert(
        `Dışa aktarım başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`
      );
    }
  };

  const exportBrandPdf = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return;
    try {
      const payload = buildBrandMonthExportPayload({
        brand,
        viewMonth,
        todayYm,
        brands,
        brandLinks: scopedLinks.filter((l) => l.brandId === brandId),
        linkSnapshots,
        brandViewership,
        brandMonthlyStats,
        employees,
        weekBrandReels: useStore.getState().weekBrandReels ?? [],
      });
      if (!payload) return;
      const { downloadBrandMonthPdf } = require("@/lib/marka-izlenme-pdf") as typeof import("@/lib/marka-izlenme-pdf");
      downloadBrandMonthPdf(payload, brand.shortName);
    } catch (err) {
      window.alert(
        `PDF başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`
      );
    }
  };

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <ViewershipReloadBanner
        snapshotCount={linkSnapshots.length}
        linkCount={brandLinks.filter((l) => l.url?.trim()).length}
        viewMonth={viewMonth}
      />
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        linkScope={linkScope}
        onLinkScopeChange={setLinkScope}
        apiDateMode={apiDateMode}
        onApiDateModeChange={setApiDateMode}
        totalBrands={brands.filter((b) => b.status === "active").length}
        totalStreamers={totalOwners}
        totalLinks={totalLinks}
        totalAllLinks={allActiveLinkCount}
        totalViews={grandTotal}
        readOnly={readOnly}
      />

      {/* KPI üst bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
        <KpiTile
          icon={<Briefcase size={14} />}
          label="Aktif marka"
          value={kpi.activeBrandCount.toLocaleString("tr-TR")}
          hint={`${brands.length} toplam`}
          tone="indigo"
        />
        <KpiTile
          icon={<Eye size={14} />}
          label="Bu ay izlenme"
          value={fmtViews(kpi.monthViews)}
          hint={monthTitleYm(viewMonth)}
          tone="emerald"
        />
        <KpiTile
          icon={<Sparkles size={14} />}
          label="Lider platform"
          value={kpi.topPlatform?.name ?? "—"}
          hint={kpi.topPlatform ? `${fmtViews(kpi.topPlatform.views)} izlenme` : "Veri yok"}
          tone="amber"
        />
        <KpiTile
          icon={<Target size={14} />}
          label="Ort. hedef tutturma"
          value={kpi.avgTargetPct != null ? `${kpi.avgTargetPct.toFixed(0)}%` : "—"}
          hint={kpi.avgTargetPct != null ? "Hedefi olan markalar" : "Hedef tanımsız"}
          tone={
            kpi.avgTargetPct == null
              ? "muted"
              : kpi.avgTargetPct >= 80
                ? "emerald"
                : kpi.avgTargetPct >= 50
                  ? "amber"
                  : "rose"
          }
        />
      </div>

      {/* Yükselişte vurgu — sadece pozitif MoM artışı olan en iyi 3 marka */}
      {topPerformers.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Rocket size={13} className="text-emerald-500" />
              Yükselişte
            </div>
            <span className="text-[11px] text-muted-foreground">
              Bir önceki aya göre en güçlü artış · {monthTitleYm(viewMonth)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topPerformers.map((r, idx) => (
              <TopPerformerCard
                key={r.brand.id}
                rank={idx + 1}
                brandId={r.brand.id}
                brandName={r.brand.name}
                shortName={r.brand.shortName}
                category={r.brand.category}
                totalNow={r.totalNow}
                totalPrev={r.totalPrev}
                mom={r.mom ?? 0}
                viewMonth={viewMonth}
              />
            ))}
          </div>
        </section>
      )}

      {/* Filtre çubuğu + kart grid */}
      <Card className="mb-5">
        <CardHeader className="pb-3 gap-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base inline-flex items-center gap-1.5">
                <Layers size={14} className="text-muted-foreground" />
                Markalar
              </CardTitle>
              <CardDescription className="text-xs">
                Tıklanan her kart marka detay sayfasını açar — {monthTitleYm(viewMonth)} özeti
                ile.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => exportOverview("pdf")}
                disabled={rows.length === 0}
              >
                <Download size={13} />
                PDF özet
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => exportOverview("csv")}
                disabled={rows.length === 0}
              >
                <FileSpreadsheet size={13} />
                CSV özet
              </Button>
              <div className="relative w-full sm:w-[200px]">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  placeholder="Marka ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="!h-8 !text-xs !pl-7"
                />
              </div>
            </div>
          </div>

          {/* Status & kategori & sıralama chip satırları */}
          <div className="flex flex-col gap-2 mt-1.5">
            <ChipRow label="Durum">
              {STATUS_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={statusFilter === opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </Chip>
              ))}
            </ChipRow>
            {categories.length > 0 && (
              <ChipRow label="Kategori">
                <Chip
                  active={categoryFilter === "all"}
                  onClick={() => setCategoryFilter("all")}
                >
                  Tümü
                </Chip>
                {categories.map((c) => (
                  <Chip
                    key={c}
                    active={categoryFilter === c}
                    onClick={() => setCategoryFilter(c)}
                  >
                    {c}
                  </Chip>
                ))}
              </ChipRow>
            )}
            <ChipRow label="Sırala">
              {SORT_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={sortKey === opt.value}
                  onClick={() => setSortKey(opt.value)}
                  icon={opt.icon}
                >
                  {opt.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <EmptyState hasBrands={brands.length > 0} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((row) => (
                <BrandCard
                  key={row.brand.id}
                  row={row}
                  viewMonth={viewMonth}
                  onDownloadPdf={() => exportBrandPdf(row.brand.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marka × yayıncı operasyon özeti (toplanır kart) */}
      <CollapsibleSection
        defaultOpen={false}
        className="mb-6"
        title={
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 size={14} className="text-emerald-500" />
            Marka × yayıncı operasyon özeti
          </span>
        }
        description={
          <>
            Kayıt, FTD, net yatırım ve yayıncı izlenmesi; marka harcaması ay toplamıdır
            (yayıncı satırında yalnızca o kişinin kayıtlı harcaması). —{" "}
            {monthTitleYm(viewMonth)}
          </>
        }
        trailing={
          <Badge variant="outline" className="text-[10px]">
            {operationRows.length} marka
          </Badge>
        }
      >
        {operationRows.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">
            Bu ay için operasyon verisi yok.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Marka</th>
                  <th className="pb-2 pr-3 font-medium">Yayıncılar</th>
                  <th className="pb-2 pr-3 font-medium text-right">Yayıncı izlenme</th>
                  <th className="pb-2 pr-3 font-medium text-right">Kayıt</th>
                  <th className="pb-2 pr-3 font-medium text-right">FTD</th>
                  <th className="pb-2 pr-3 font-medium text-right">Net yatırım</th>
                  <th className="pb-2 pr-3 font-medium text-right">Harcama</th>
                  <th className="pb-2 pr-3 font-medium text-right">CPR</th>
                </tr>
              </thead>
              <tbody>
                {operationRows.map((r) => {
                  const cur = r.stats?.currency ?? "USD";
                  const net = r.stats
                    ? Number(r.stats.depositAmount) - Number(r.stats.withdrawalAmount)
                    : 0;
                  return (
                    <tr
                      key={r.brand.id}
                      className="border-b border-border/50 hover:bg-accent/20"
                    >
                      <td className="py-2 pr-3 font-medium text-foreground">
                        <Link
                          href={`/izlenme/marka/${r.brand.id}?month=${viewMonth}`}
                          className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                        >
                          <BrandLogo
                            brandId={r.brand.id}
                            title={r.brand.name}
                            size={18}
                            className="rounded-sm"
                          />
                          {r.brand.shortName}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[220px]">
                        {r.streamers.length === 0 ? (
                          "—"
                        ) : (
                          <ul className="space-y-1">
                            {r.streamers.slice(0, 4).map((s) => (
                              <li key={s.employeeId} className="leading-snug">
                                <span className="font-medium text-foreground">{s.name}</span>
                                {s.views > 0 ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {fmtViews(s.views)} izlenme
                                  </span>
                                ) : null}
                                {s.expenseUsd > 0 ? (
                                  <span className="text-amber-700 dark:text-amber-300">
                                    {" "}
                                    · ${s.expenseUsd.toLocaleString("tr-TR")}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/70"> · harcama yok</span>
                                )}
                              </li>
                            ))}
                            {r.streamers.length > 4 ? (
                              <li className="text-[10px] opacity-70">
                                +{r.streamers.length - 4} yayıncı daha
                              </li>
                            ) : null}
                            {r.unassignedExpenseUsd > 0 ? (
                              <li className="text-[10px] text-amber-800/90 dark:text-amber-200/90 pt-0.5 border-t border-border/40 mt-1">
                                Genel (yayıncısız): $
                                {r.unassignedExpenseUsd.toLocaleString("tr-TR")}
                              </li>
                            ) : null}
                          </ul>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.views > 0 ? fmtViews(r.views) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.stats && hasBrandMonthlyStatsData(r.stats)
                          ? fmtBrandCount(r.stats.newRegistrations)
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.stats && hasBrandMonthlyStatsData(r.stats)
                          ? fmtBrandCount(r.stats.firstTimeDepositors)
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 text-right tabular-nums font-semibold",
                          net > 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : net < 0
                              ? "text-red-700 dark:text-red-300"
                              : ""
                        )}
                      >
                        {r.stats && hasBrandMonthlyStatsData(r.stats)
                          ? fmtBrandMoney(net, cur)
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-300">
                        {r.expenseUsd > 0 ? (
                          <div className="leading-snug">
                            <div>${r.expenseUsd.toLocaleString("tr-TR")}</div>
                            {r.unassignedExpenseUsd > 0 &&
                            r.assignedExpenseUsd > 0 &&
                            r.unassignedExpenseUsd !== r.expenseUsd ? (
                              <div className="text-[10px] font-normal text-muted-foreground">
                                Yayıncı: ${r.assignedExpenseUsd.toLocaleString("tr-TR")}
                              </div>
                            ) : r.unassignedExpenseUsd > 0 && r.assignedExpenseUsd === 0 ? (
                              <div className="text-[10px] font-normal text-muted-foreground">
                                Tamamı genel
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.cpr != null && Number.isFinite(r.cpr)
                          ? `$${r.cpr.toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

type KpiTone = "emerald" | "indigo" | "amber" | "rose" | "muted";

const KPI_TONE: Record<KpiTone, { ring: string; icon: string; halo: string }> = {
  emerald: {
    ring: "border-emerald-200/60 dark:border-emerald-500/30",
    icon: "text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40",
    halo: "from-emerald-100/60 dark:from-emerald-500/10",
  },
  indigo: {
    ring: "border-indigo-200/60 dark:border-indigo-500/30",
    icon: "text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40",
    halo: "from-indigo-100/60 dark:from-indigo-500/10",
  },
  amber: {
    ring: "border-amber-200/60 dark:border-amber-500/30",
    icon: "text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40",
    halo: "from-amber-100/60 dark:from-amber-500/10",
  },
  rose: {
    ring: "border-rose-200/60 dark:border-rose-500/30",
    icon: "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40",
    halo: "from-rose-100/60 dark:from-rose-500/10",
  },
  muted: {
    ring: "border-border",
    icon: "text-muted-foreground bg-muted/60",
    halo: "from-muted/40",
  },
};

function KpiTile({
  icon,
  label,
  value,
  hint,
  tone = "muted",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
}) {
  const t = KPI_TONE[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card px-3 py-3 shadow-sm",
        t.ring
      )}
    >
      <div
        className={cn(
          "absolute inset-0 -z-0 bg-gradient-to-br to-transparent opacity-70",
          t.halo
        )}
      />
      <div className="relative flex items-start gap-2.5">
        <div
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            t.icon
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-bold leading-tight truncate">{value}</p>
          {hint && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mr-1 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  icon,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
        active
          ? "border-foreground bg-foreground text-background shadow-sm"
          : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent/40"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyState({ hasBrands }: { hasBrands: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
        <Briefcase size={22} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {hasBrands ? "Eşleşen marka bulunamadı" : "Henüz marka eklenmemiş"}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {hasBrands
            ? "Filtreleri sıfırlayarak veya farklı bir arama deneyerek tekrar bakabilirsin."
            : "İzlenme takibi yapmak için /izlenme sayfasından marka oluşturabilirsin."}
        </p>
      </div>
      {!hasBrands && (
        <Link
          href="/izlenme"
          className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          İzlenme sayfasına git <ArrowUpRight size={12} />
        </Link>
      )}
    </div>
  );
}

interface BrandRowVm {
  brand: ReturnType<typeof useStore.getState>["brands"][number];
  links: ReturnType<typeof useStore.getState>["brandLinks"];
  ownerCount: number;
  totalNow: number;
  totalPrev: number;
  totalExpense: number;
  monthExpenseCount: number;
  lastContentDate: string | null;
  lifetimeContentUsd: number;
  lifetimeContentCount: number;
  mom: number | null;
  target: number | null;
  targetPct: number | null;
  spark: { month: string; views: number }[];
}

function BrandCard({
  row,
  viewMonth,
  onDownloadPdf,
}: {
  row: BrandRowVm;
  viewMonth: string;
  onDownloadPdf: () => void;
}) {
  const {
    brand,
    links,
    ownerCount,
    totalNow,
    totalExpense,
    monthExpenseCount,
    lastContentDate,
    lifetimeContentUsd,
    lifetimeContentCount,
    mom,
    target,
    targetPct,
    spark,
  } = row;
  const lastContentLabel = lastContentDate
    ? lastContentDateLabel(lastContentDate)
    : null;
  const positive = (mom ?? 0) >= 0;
  const trendColor =
    mom == null
      ? "text-muted-foreground"
      : positive
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-rose-600 dark:text-rose-300";

  const sparkStroke = mom == null
    ? "var(--color-muted-foreground)"
    : positive
      ? "#10b981"
      : "#f43f5e";

  const sparkFill = positive ? "url(#brandSparkEmerald)" : "url(#brandSparkRose)";

  const statusVariant =
    brand.status === "active"
      ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-500/45 dark:text-emerald-300 dark:bg-emerald-950/30"
      : brand.status === "paused"
        ? "border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-500/45 dark:text-amber-300 dark:bg-amber-950/30"
        : "border-border text-muted-foreground bg-muted/40";

  return (
    <Link
      href={`/izlenme/marka/${brand.id}?month=${viewMonth}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-2xl"
    >
      <Card
        className={cn(
          "relative h-full overflow-hidden border-border/70 transition-all duration-200",
          "hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5",
          "gap-2 py-4"
        )}
      >
        {/* Hover gradient glow */}
        <div className="pointer-events-none absolute inset-0 -z-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5" />

        <CardHeader className="pb-1 relative">
          <div className="flex items-start gap-2.5">
            <BrandLogo
              brandId={brand.id}
              title={brand.name}
              size={40}
              className="rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm flex items-center gap-1.5 group-hover:text-primary transition-colors truncate">
                <span className="truncate">{brand.name}</span>
              </CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                  {brand.shortName}
                </span>
                {brand.category && (
                  <Badge
                    variant="outline"
                    className="text-[9px] !h-4 px-1.5 text-muted-foreground"
                  >
                    {brand.category}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="outline" className={cn("text-[9px]", statusVariant)}>
                {brand.status}
              </Badge>
              <button
                type="button"
                title="Bu marka için izlenme PDF"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDownloadPdf();
                }}
                className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download size={10} />
                PDF
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2 text-xs relative">
          {/* Ana izlenme + MoM */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                <Eye size={10} /> Bu ay izlenme
              </p>
              <p className="text-xl font-bold tabular-nums leading-tight">
                {fmtViews(totalNow)}
              </p>
            </div>
            {mom != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  positive
                    ? "bg-emerald-100/70 dark:bg-emerald-950/40"
                    : "bg-rose-100/70 dark:bg-rose-950/40",
                  trendColor
                )}
                title="Önceki aya göre değişim"
              >
                {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {positive ? "+" : ""}
                {mom.toFixed(1)}%
              </span>
            )}
          </div>

          {/* Sparkline (son 6 ay) */}
          <div className="h-12 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="brandSparkEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="brandSparkRose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <RTooltip
                  cursor={false}
                  contentStyle={{
                    fontSize: 10,
                    padding: "4px 6px",
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    borderRadius: 6,
                  }}
                  labelFormatter={(label: string) => monthShort(label)}
                  formatter={(value: number) => [fmtViews(value), "İzlenme"]}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke={sparkStroke}
                  strokeWidth={1.5}
                  fill={sparkFill}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Hedef tamamlama */}
          {target != null && target > 0 && targetPct != null && (
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Target size={10} /> Hedef · {fmtViews(target)}
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    targetPct >= 100
                      ? "text-emerald-600 dark:text-emerald-300"
                      : targetPct >= 60
                        ? "text-foreground"
                        : "text-rose-600 dark:text-rose-300"
                  )}
                >
                  {targetPct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    targetPct >= 100
                      ? "bg-emerald-500"
                      : targetPct >= 60
                        ? "bg-indigo-500"
                        : "bg-rose-500"
                  )}
                  style={{ width: `${Math.min(100, targetPct)}%` }}
                />
              </div>
            </div>
          )}

          {/* Alt meta — link, yayıncı, harcama */}
          <div className="flex items-center justify-between pt-1 border-t border-border/50 mt-1.5">
            <MetaPill icon={<Link2 size={10} />} label={`${links.length} link`} />
            <MetaPill
              icon={<Users size={10} />}
              label={`${ownerCount} yayıncı`}
            />
            {totalExpense > 0 ? (
              <MetaPill
                icon={<Wallet size={10} />}
                label={`$${totalExpense.toLocaleString("tr-TR")} · ${monthExpenseCount}`}
                tone="amber"
                title={`Bu ay ${monthExpenseCount} içerik harcaması — ortak kayıtlar paylaştırılır`}
              />
            ) : (
              <MetaPill
                icon={<Wallet size={10} />}
                label="Bu ay içerik yok"
                tone="muted"
                title="Bu ay bu markaya atanmış içerik harcaması yok"
              />
            )}
          </div>

          {totalExpense === 0 && (lastContentLabel || lifetimeContentCount > 0) && (
            <p className="text-[10px] text-muted-foreground italic -mt-1">
              {lastContentLabel
                ? `Son içerik: ${lastContentLabel}`
                : "Bu markaya hiç içerik yazılmamış"}
              {lifetimeContentCount > 0 &&
                ` · toplam ${lifetimeContentCount} kayıt, $${lifetimeContentUsd.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`}
            </p>
          )}

          {/* Detay CTA — hover'da görünür */}
          <div className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 pt-1">
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
              Detay sayfası <ChevronRight size={12} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MetaPill({
  icon,
  label,
  tone = "default",
  title,
}: {
  icon: ReactNode;
  label: string;
  tone?: "default" | "amber" | "muted";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] tabular-nums",
        tone === "amber" && "text-amber-700 dark:text-amber-300",
        tone === "muted" && "text-muted-foreground",
        tone === "default" && "text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function TopPerformerCard({
  rank,
  brandId,
  brandName,
  shortName,
  category,
  totalNow,
  totalPrev,
  mom,
  viewMonth,
}: {
  rank: number;
  brandId: string;
  brandName: string;
  shortName: string;
  category: string;
  totalNow: number;
  totalPrev: number;
  mom: number;
  viewMonth: string;
}) {
  const rankIcon =
    rank === 1 ? (
      <Trophy size={13} className="text-amber-500" />
    ) : rank === 2 ? (
      <Sparkles size={13} className="text-indigo-400" />
    ) : (
      <Flame size={13} className="text-rose-400" />
    );

  return (
    <Link
      href={`/izlenme/marka/${brandId}?month=${viewMonth}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-xl"
    >
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-xl border px-3.5 py-3 shadow-sm transition-all",
          "border-emerald-200/60 dark:border-emerald-500/30",
          "bg-gradient-to-br from-emerald-50/80 via-card to-card dark:from-emerald-950/30 dark:via-card dark:to-card",
          "hover:shadow-md hover:-translate-y-0.5"
        )}
      >
        <div className="flex items-start gap-2.5">
          <BrandLogo brandId={brandId} title={brandName} size={36} className="rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300">
                {rankIcon}
                #{rank} Yükselişte
              </span>
            </div>
            <p className="text-sm font-bold truncate group-hover:text-primary transition-colors mt-0.5">
              {brandName}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
              {shortName}
              {category ? ` · ${category}` : ""}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold tabular-nums"
            title="Önceki aya göre değişim"
          >
            <TrendingUp size={11} /> +{mom.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-end justify-between gap-3 mt-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Bu ay izlenme
            </p>
            <p className="text-lg font-bold tabular-nums leading-tight">
              {fmtViews(totalNow)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Önceki ay
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {fmtViews(totalPrev)}
            </p>
          </div>
          <ChevronRight
            size={16}
            className="text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    </Link>
  );
}
