"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, AlertCircle, Archive, BarChart3, Bot, Camera, Download, ExternalLink, FileSpreadsheet,
  Eye, Globe, History, Instagram, Loader2, LogIn, MessageCircle, Music2, Plus,
  RefreshCw, Send, Target, Trash2, TrendingDown, TrendingUp, Twitch, Youtube,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, LineChart, Line,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
  Legend,
} from "recharts";
import { useStore, type BrandLink, type LinkSnapshot } from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import {
  brandContentExpensesForMonth,
  filterLinksForViewMonth,
  linkEngagementForMonth,
  linkViewsForMonth,
  sumBrandContentExpensesForMonth,
  totalLinkViewsForMonth,
} from "@/lib/brand-month-metrics";
import { buildBrandMonthExportPayload } from "@/lib/izlenme-brand-export";
import {
  downloadBrandMonthCsv,
  downloadBrandMonthPdf,
  downloadBrandOperationCsv,
  downloadBrandOperationPdf,
} from "@/lib/marka-izlenme-pdf";
import {
  brandStatsExportRows,
  deriveBrandMonthlyStats,
} from "@/lib/brand-monthly-stats";
import {
  enrichBrandLinksForMonth,
  filterBrandLinksDisplay,
  sortBrandLinksDisplay,
  type BrandLinkSortKey,
} from "@/lib/brand-link-display";
import { BrandLinkListToolbar } from "@/components/brand-link-list-toolbar";
import { BrandLinkThumb } from "@/components/brand-link-thumb";
import { isAutoTrackable } from "@/lib/social-api/platform-detect";
import { applyLinkMetricsToStore } from "@/lib/social-api/link-store-sync";
import { LinkDetailsModal } from "@/components/link-details-modal";
import { findBrandMonthlyStats, fmtBrandMoney, fmtBrandCount } from "@/lib/brand-monthly-stats";
import { shiftCalendarMonthYm, defaultSnapshotDateInMonth } from "@/lib/data";
import { useIzlenmeViewMonth, izlenmeHref } from "@/lib/use-izlenme-view-month";
import { archiveBrandAsAdmin, deleteBrandAsAdmin } from "@/lib/brand-delete";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { BrandLinkFormModal } from "@/components/brand-link-form-modal";
import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ViewDotCard } from "@/components/view-dot-card";
import { BrandMonthlyStatsPanel } from "@/components/brand-monthly-stats-panel";
import { BrandLinksPanel } from "@/components/brand-links-panel";
import { BrandLinkViewershipSummary } from "@/components/brand-link-viewership-summary";
import { MarkaViewershipCharts } from "@/components/marka-viewership-charts";
import Modal from "@/components/ui/modal";
import { Field, Input, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return Youtube;
  if (p.includes("twitch")) return Twitch;
  if (p.includes("instagram")) return Instagram;
  if (p.includes("tiktok")) return Music2;
  if (p.includes("telegram")) return Send;
  if (p.includes("twitter") || p.includes("x")) return MessageCircle;
  return Globe;
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function BrandDetailClient({ brandId }: { brandId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const readOnly = useIsReadOnly();
  const enterBrandPanel = usePanelView((s) => s.enterBrandPanel);

  const {
    brands, brandLinks, linkSnapshots, brandViewership, brandMonthlyStats,
    contentExpenses, employees, weekBrandReels,
    addLinkSnapshot, updateLinkSnapshot, deleteLinkSnapshot,
    updateBrandLink, upsertLinkSnapshot,
    addBrandLink, deleteBrandLink,
  } = useStore();

  const {
    viewMonth,
    setViewMonth,
    todayYm,
    linkScope,
    setLinkScope,
    apiDateMode,
    setApiDateMode,
  } = useIzlenmeViewMonth();
  const showAllLinks = linkScope === "all";
  const [linksPanelOpen, setLinksPanelOpen] = useState(false);
  const [linkForm, setLinkForm] = useState<BrandLink | null | undefined>(undefined);
  const [snapshotModal, setSnapshotModal] = useState<{ link: BrandLink; snapshot?: LinkSnapshot } | null>(null);
  const [historyModal, setHistoryModal] = useState<BrandLink | null>(null);
  const [detailsLink, setDetailsLink] = useState<BrandLink | null>(null);
  const [refreshingLinkId, setRefreshingLinkId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkPlatform, setLinkPlatform] = useState("all");
  const [linkOwnerId, setLinkOwnerId] = useState("all");
  const [linkSort, setLinkSort] = useState<BrandLinkSortKey>("views");
  const [brandActionBusy, setBrandActionBusy] = useState(false);
  const isAdmin = user?.role === "admin" || user?.role === "auditor";
  const canManageBrand = user?.role === "admin" && !readOnly;

  const brand = brands.find((b) => b.id === brandId);

  const allBrandLinks = useMemo(
    () => brandLinks.filter((l) => l.brandId === brandId),
    [brandLinks, brandId]
  );

  const links = useMemo(
    () =>
      filterLinksForViewMonth(
        allBrandLinks,
        viewMonth,
        linkSnapshots,
        todayYm,
        showAllLinks
      ),
    [allBrandLinks, viewMonth, linkSnapshots, todayYm, showAllLinks]
  );

  const totalCurrentMonth = useMemo(
    () => totalLinkViewsForMonth(links, viewMonth, linkSnapshots, todayYm),
    [links, viewMonth, linkSnapshots, todayYm]
  );

  const monthExpenses = useMemo(
    () =>
      brand
        ? brandContentExpensesForMonth(contentExpenses, brand, viewMonth, brands)
        : [],
    [brand, contentExpenses, viewMonth]
  );
  const stats = useMemo(
    () => findBrandMonthlyStats(brandMonthlyStats, brandId, viewMonth),
    [brandMonthlyStats, brandId, viewMonth]
  );

  const totalExpenses = brand
    ? sumBrandContentExpensesForMonth(contentExpenses, brand, viewMonth, brands)
    : 0;

  const scopedLinkFilters = useMemo(() => {
    const enriched = enrichBrandLinksForMonth(
      links,
      viewMonth,
      linkSnapshots,
      todayYm,
      employees
    );
    const owners = Array.from(
      new Map(
        allBrandLinks.map((l) => {
          const id = l.ownerId ?? "_none";
          const name = l.ownerId
            ? employees.find((e) => e.id === l.ownerId)?.name ?? "?"
            : "Genel";
          return [id, name] as const;
        })
      ).entries()
    ).map(([id, name]) => ({ id, name }));
    const platforms = [...new Set(allBrandLinks.map((l) => l.platform))].sort((a, b) =>
      a.localeCompare(b, "tr")
    );
    const filtered = sortBrandLinksDisplay(
      filterBrandLinksDisplay(enriched, {
        search: linkSearch,
        platform: linkPlatform,
        ownerId: linkOwnerId,
      }),
      linkSort
    );
    return { filtered, owners, platforms };
  }, [
    links,
    allBrandLinks,
    viewMonth,
    linkSnapshots,
    todayYm,
    employees,
    linkSearch,
    linkPlatform,
    linkOwnerId,
    linkSort,
  ]);

  const exportBrandReport = (kind: "pdf" | "csv") => {
    if (!brand) return;
    try {
      const p = buildBrandMonthExportPayload({
        brand,
        viewMonth,
        todayYm,
        brands,
        brandLinks: allBrandLinks,
        linkSnapshots,
        brandViewership,
        brandMonthlyStats,
        employees,
        weekBrandReels,
        contentExpenses,
      });
      if (!p) return;
      if (kind === "pdf") downloadBrandMonthPdf(p, brand.shortName);
      else downloadBrandMonthCsv(p, brand.shortName);
    } catch (err) {
      window.alert(
        `Dışa aktarım başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`
      );
    }
  };

  const exportOperationReport = (kind: "pdf" | "csv") => {
    if (!brand || !stats) return;
    const operationStats = brandStatsExportRows(stats, deriveBrandMonthlyStats(stats));
    if (totalExpenses > 0) {
      operationStats.push({
        label: "İçerik harcaması (pay)",
        value: `$${totalExpenses.toLocaleString("tr-TR")}`,
      });
    }
    const payload = {
      brandFullName: brand.name,
      monthYm: viewMonth,
      monthTitle: monthTitleYm(viewMonth),
      operationStats,
    };
    if (kind === "pdf") downloadBrandOperationPdf(payload, brand.shortName);
    else downloadBrandOperationCsv(payload, brand.shortName);
  };

  // Platforma göre dağılım
  const platformBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of allBrandLinks) {
      const v = linkViewsForMonth(l, viewMonth, linkSnapshots, todayYm).lastViews;
      if (v <= 0) continue;
      map.set(l.platform, (map.get(l.platform) ?? 0) + v);
    }
    return Array.from(map.entries())
      .map(([platform, views]) => ({ platform, views }))
      .sort((a, b) => b.views - a.views);
  }, [allBrandLinks, linkSnapshots, viewMonth, todayYm]);

  // Yayıncı / link sahibi bazlı izlenme dağılımı — link snapshot + manuel yayıncı raporu
  const ownerBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; views: number; count: number; source: "link" | "manual" | "mixed" }>();
    for (const l of allBrandLinks) {
      const v = linkViewsForMonth(l, viewMonth, linkSnapshots, todayYm).lastViews;
      if (v <= 0) continue;
      const key = l.ownerId ?? "_none";
      const name = l.ownerId
        ? employees.find((e) => e.id === l.ownerId)?.name ?? "?"
        : "Genel";
      const e = map.get(key) ?? { name, views: 0, count: 0, source: "link" as const };
      e.views += v;
      e.count += 1;
      map.set(key, e);
    }
    if (brand) {
      for (const v of brandViewership) {
        if (v.brandId !== brand.id || v.month !== viewMonth) continue;
        if (!v.views) continue;
        const key = v.employeeId ?? "_manual";
        const name = v.employeeId
          ? employees.find((e) => e.id === v.employeeId)?.name ?? "?"
          : "Manuel yayıncı raporu";
        const prev = map.get(key);
        if (prev) {
          prev.views += v.views;
          prev.source = prev.source === "link" ? "mixed" : prev.source;
        } else {
          map.set(key, { name, views: v.views, count: 0, source: "manual" });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.views - a.views);
  }, [allBrandLinks, linkSnapshots, viewMonth, todayYm, employees, brand, brandViewership]);

  // Geçmiş ayla karşılaştırma
  const prevMonth = shiftCalendarMonthYm(viewMonth, -1);
  const prevTotal = totalLinkViewsForMonth(allBrandLinks, prevMonth, linkSnapshots, todayYm);
  const momPct =
    prevTotal > 0 ? ((totalCurrentMonth - prevTotal) / prevTotal) * 100 : null;

  // Hedefe ilerleme
  const hasTarget = brand?.monthlyTarget != null && brand.monthlyTarget > 0;
  const targetPct = hasTarget
    ? Math.min(100, (totalCurrentMonth / brand!.monthlyTarget!) * 100)
    : null;

  if (!brand) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/izlenme" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={14} /> İzlenmeye dön
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Marka bulunamadı</CardTitle>
            <CardDescription>
              Bu marka silinmiş veya henüz yüklenmemiş olabilir.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const navbarBrands = brands.filter((b) => b.status === "active").length;
  const navbarStreamers = new Set(allBrandLinks.map((l) => l.ownerId).filter(Boolean)).size;
  const navbarLinks = allBrandLinks.length;

  const refreshLink = async (linkId: string) => {
    if (!isAdmin || readOnly) return;
    setRefreshingLinkId(linkId);
    try {
      const res = await fetch(`/api/admin/refresh-link/${linkId}`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        result?: { ok: boolean; linkUpdate?: Parameters<typeof applyLinkMetricsToStore>[1]; error?: string };
      };
      const update = json.result?.linkUpdate;
      if (json.result?.ok && update) {
        applyLinkMetricsToStore(linkId, update, { updateBrandLink, upsertLinkSnapshot });
      } else if (json.result?.error) {
        updateBrandLink(linkId, { lastCheckError: json.result.error });
      }
    } finally {
      setRefreshingLinkId(null);
    }
  };

  const fmtEngagement = (n?: number | null) => {
    if (n == null) return null;
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return n.toLocaleString("tr-TR");
  };

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        linkScope={linkScope}
        onLinkScopeChange={setLinkScope}
        apiDateMode={apiDateMode}
        onApiDateModeChange={setApiDateMode}
        totalBrands={navbarBrands}
        totalStreamers={navbarStreamers}
        totalLinks={links.length}
        totalAllLinks={allBrandLinks.length}
        totalViews={totalCurrentMonth}
        readOnly={readOnly}
      />

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Link
          href={izlenmeHref("/izlenme/markalar", viewMonth)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Tüm markalar
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <div className="flex items-center gap-2 min-w-0">
          <BrandLogo brandId={brand.id} title={brand.name} size={28} className="rounded-lg shrink-0" />
          <span className="text-sm font-medium truncate">{brand.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 h-8"
            onClick={() => exportBrandReport("pdf")}
          >
            <Download size={12} /> İzlenme PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 h-8"
            onClick={() => exportBrandReport("csv")}
          >
            <FileSpreadsheet size={12} /> CSV
          </Button>
          {stats && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 h-8"
              onClick={() => exportOperationReport("pdf")}
            >
              <Download size={12} /> Operasyon PDF
            </Button>
          )}
          {user?.role === "admin" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-8 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/45 dark:text-amber-300 dark:hover:bg-amber-950/40"
              onClick={() => {
                enterBrandPanel(brand.id, brand.name);
                router.push("/marka/anasayfa");
              }}
              title="Bu markanın paneline gir"
            >
              <LogIn size={12} /> Marka paneli
            </Button>
          )}
          {canManageBrand && brand.status !== "inactive" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-8"
              disabled={brandActionBusy}
              onClick={async () => {
                if (
                  !window.confirm(
                    `“${brand.name}” pasifleştirilsin mi? Varsayılan listede görünmez.`
                  )
                ) {
                  return;
                }
                setBrandActionBusy(true);
                const res = await archiveBrandAsAdmin(brand.id, { status: "inactive" });
                setBrandActionBusy(false);
                if (!res.ok) window.alert(res.reason);
              }}
            >
              <Archive size={12} /> Pasifleştir
            </Button>
          )}
          {canManageBrand && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-8 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/45 dark:text-rose-300"
              disabled={brandActionBusy}
              onClick={async () => {
                if (
                  !window.confirm(
                    `“${brand.name}” kalıcı silinsin mi? Tüm marka verileri kaldırılır.`
                  )
                ) {
                  return;
                }
                setBrandActionBusy(true);
                const res = await deleteBrandAsAdmin(brand.id, brand.name);
                setBrandActionBusy(false);
                if (!res.ok) {
                  window.alert(res.reason);
                  return;
                }
                router.push("/izlenme/markalar");
              }}
            >
              <Trash2 size={12} /> Sil
            </Button>
          )}
        </div>
      </div>

      <BrandLinkViewershipSummary
        links={allBrandLinks}
        snapshots={linkSnapshots}
        viewMonth={viewMonth}
        todayYm={todayYm}
        title={`${brand.name} · link izlenme özeti`}
      />

      {/* KPI kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <ViewDotCard
          target={totalCurrentMonth}
          metricCaption="Views"
          label={monthTitleYm(viewMonth)}
          sub={
            showAllLinks
              ? `${allBrandLinks.length} link`
              : `${links.length} / ${allBrandLinks.length} link (bu ay)`
          }
          accent="violet"
        />
        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Geçen ayla
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p
              className={`text-2xl font-bold tabular-nums ${
                momPct == null
                  ? "text-muted-foreground"
                  : momPct >= 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
              }`}
            >
              {momPct == null ? "—" : `${momPct >= 0 ? "+" : ""}${momPct.toFixed(1)}%`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {monthTitleYm(prevMonth)}: {fmtViews(prevTotal)}{" "}
              {momPct != null && (
                momPct >= 0
                  ? <TrendingUp size={10} className="inline text-emerald-500" />
                  : <TrendingDown size={10} className="inline text-red-500" />
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              İçerik harcaması
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              ${totalExpenses.toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {monthExpenses.length} kayıt
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Hedef
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0 space-y-1">
            {hasTarget && targetPct != null ? (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {targetPct.toFixed(0)}%
                </p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${targetPct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                    style={{ width: `${targetPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  <Target size={9} className="inline mr-1" />
                  {fmtViews(brand.monthlyTarget!)} hedef
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">Hedef yok</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operasyon metrikleri */}
      {stats && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Operasyon · {monthTitleYm(viewMonth)}</CardTitle>
            <CardDescription className="text-xs">
              Kayıt, yatırım, çekim ve canlı/demo ayrıştırması
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandMonthlyStatsPanel brandId={brand.id} monthYm={viewMonth} readOnly={readOnly} className="shadow-none" />
          </CardContent>
        </Card>
      )}

      {brand && (
        <div className="mb-6">
          <MarkaViewershipCharts
            brand={brand}
            brandLinks={brandLinks}
            linkSnapshots={linkSnapshots}
            brandViewership={brandViewership}
            monthYm={viewMonth}
            todayYm={todayYm}
          />
        </div>
      )}

      {/* Platform + Yayıncı dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Platforma göre izlenme</CardTitle>
            <CardDescription className="text-xs">{monthTitleYm(viewMonth)} dönemi</CardDescription>
          </CardHeader>
          <CardContent>
            {platformBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">
                Bu ay için platform verisi yok.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={platformBreakdown}
                    dataKey="views"
                    nameKey="platform"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {platformBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: number) => fmtViews(v)} contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Yayıncı / operatör dağılımı</CardTitle>
              <CardDescription className="text-xs">Link sahiplerinin katkısı</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {ownerBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">
                Bu ay için yayıncı izlenme verisi yok.
              </p>
            ) : (
              <div className="space-y-2">
                {ownerBreakdown.map((o, i) => {
                  const total = ownerBreakdown.reduce((s, x) => s + x.views, 0);
                  const pct = total > 0 ? (o.views / total) * 100 : 0;
                  return (
                    <div key={o.name + i}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium flex items-center gap-1.5">
                          {o.name}
                          {o.source !== "link" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] !h-4 px-1.5 border-amber-300 text-amber-700 dark:border-amber-500/45 dark:text-amber-300"
                              title={
                                o.source === "manual"
                                  ? "Manuel yayıncı izlenme raporu — bağlı link yok"
                                  : "Link + manuel rapor birlikte sayılıyor"
                              }
                            >
                              {o.source === "manual" ? "manuel" : "link+manuel"}
                            </Badge>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtViews(o.views)}{" "}
                          <span className="text-[10px] opacity-60">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linkler listesi — ay bazlı filtre + API yenileme */}
      <Card className="mb-6" key={viewMonth}>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">
              Linkler ({links.length}
              {!showAllLinks && allBrandLinks.length !== links.length
                ? ` · ${allBrandLinks.length} toplam`
                : ""}
              )
            </CardTitle>
            <CardDescription className="text-xs">
              {monthTitleYm(viewMonth)} — yalnızca bu aya ait veriler gösterilir
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllLinks}
                onChange={(e) => setLinkScope(e.target.checked ? "all" : "month")}
                className="rounded"
              />
              Tüm linkleri göster
            </label>
            <Button size="sm" variant="outline" onClick={() => setLinksPanelOpen(true)}>
              <Plus size={12} /> Yönet
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {allBrandLinks.length > 0 && (
            <BrandLinkListToolbar
              search={linkSearch}
              onSearchChange={setLinkSearch}
              platform={linkPlatform}
              onPlatformChange={setLinkPlatform}
              platforms={scopedLinkFilters.platforms}
              ownerId={linkOwnerId}
              onOwnerChange={setLinkOwnerId}
              owners={scopedLinkFilters.owners}
              sortKey={linkSort}
              onSortChange={setLinkSort}
              showMonthToggle={false}
            />
          )}
          {allBrandLinks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">Henüz link yok.</p>
          ) : scopedLinkFilters.filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              {monthTitleYm(viewMonth)} için kayıtlı snapshot veya canlı veri yok.{" "}
              {!showAllLinks && (
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setLinkScope("all")}
                >
                  Tüm linkleri göster
                </button>
              )}
            </p>
          ) : (
            scopedLinkFilters.filtered.map((l) => {
              const Icon = platformIcon(l.platform);
              const monthMeta = linkViewsForMonth(l, viewMonth, linkSnapshots, todayYm);
              const { lastViews, refDate, stale, snapsInMonth } = monthMeta;
              const engagement = linkEngagementForMonth(l, viewMonth, linkSnapshots, todayYm);
              const owner = l.ownerId ? employees.find((e) => e.id === l.ownerId) : null;
              const apiSupported = isAutoTrackable(l.url, l.platform, l.handle, l.externalRef);
              const canRefresh = isAdmin && !readOnly && viewMonth === todayYm && apiSupported;
              const showStale =
                stale &&
                lastViews === 0 &&
                !engagement.likes &&
                !engagement.comments &&
                !engagement.shares;
              return (
                <div
                  key={`${l.id}-${viewMonth}`}
                  className="flex items-center gap-2 px-2.5 py-2.5 rounded-md border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <BrandLinkThumb link={l} className="h-9 w-9 rounded-md shrink-0" />
                  <Icon size={14} className="shrink-0 text-muted-foreground hidden sm:block" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-sm">{l.platform}</span>
                      {l.handle && (
                        <span className="text-xs text-muted-foreground truncate">{l.handle}</span>
                      )}
                      {owner && (
                        <Badge variant="outline" className="text-[10px]">
                          {owner.name}
                        </Badge>
                      )}
                      {l.autoTrack && apiSupported && (
                        <Badge
                          variant="outline"
                          className="text-[9px] gap-0.5 border-emerald-300 text-emerald-700 dark:border-emerald-500/45 dark:text-emerald-300"
                        >
                          <Bot size={9} /> API
                        </Badge>
                      )}
                      {l.lastCheckError && viewMonth === todayYm && (
                        <Badge
                          variant="outline"
                          className="text-[9px] gap-0.5 border-red-300 text-red-700 dark:border-red-500/45 dark:text-red-300"
                          title={l.lastCheckError}
                        >
                          <AlertCircle size={9} /> hata
                        </Badge>
                      )}
                      {l.url && (
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener"
                          className="text-blue-600 hover:text-blue-700"
                          title="Linki aç"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {snapsInMonth.length} snapshot ({monthTitleYm(viewMonth)})
                      {refDate ? ` · kayıt: ${refDate}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 min-w-[88px]">
                    <p className="text-sm font-bold tabular-nums">
                      {lastViews > 0 ? fmtViews(lastViews) : "—"}
                    </p>
                    {(engagement.likes != null ||
                      engagement.comments != null ||
                      engagement.shares != null) && (
                      <p className="text-[9px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                        {engagement.likes != null && (
                          <span className="text-rose-600 dark:text-rose-400">
                            ♥{fmtEngagement(engagement.likes)}
                          </span>
                        )}
                        {engagement.comments != null && (
                          <span className="ml-1 text-amber-700 dark:text-amber-300">
                            💬{fmtEngagement(engagement.comments)}
                          </span>
                        )}
                        {engagement.shares != null && (
                          <span className="ml-1 text-violet-700 dark:text-violet-300">
                            ↗{fmtEngagement(engagement.shares)}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {showStale ? (
                        <span className="text-amber-600 dark:text-amber-400">bu ay yok</span>
                      ) : (
                        monthTitleYm(viewMonth)
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {apiSupported && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-emerald-700 dark:text-emerald-300"
                        title="Detaylı metrikler"
                        onClick={() => setDetailsLink(l)}
                      >
                        <BarChart3 size={12} />
                      </Button>
                    )}
                    {canRefresh && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="API ile yenile (izlenme + etkileşim)"
                        disabled={refreshingLinkId === l.id}
                        onClick={() => void refreshLink(l.id)}
                      >
                        {refreshingLinkId === l.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                      </Button>
                    )}
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        title="Snapshot ekle"
                        onClick={() => setSnapshotModal({ link: l })}
                      >
                        <Camera size={12} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title="Snapshot geçmişi"
                      onClick={() => setHistoryModal(l)}
                    >
                      <History size={12} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <LinkDetailsModal
        link={detailsLink}
        open={detailsLink !== null}
        onClose={() => setDetailsLink(null)}
      />

      <BrandLinkFormModal
        open={linkForm !== undefined}
        onClose={() => setLinkForm(undefined)}
        brand={brand}
        employees={employees}
        existingLinks={brandLinks.filter((l) => l.brandId === brandId)}
        initial={linkForm ?? undefined}
        onSave={(d) => {
          if (linkForm) {
            updateBrandLink(linkForm.id, d);
          } else {
            addBrandLink(d);
          }
        }}
        onDelete={
          linkForm
            ? () => {
                deleteBrandLink(linkForm.id);
                setLinkForm(undefined);
              }
            : undefined
        }
      />

      <BrandLinksPanel
        brand={linksPanelOpen ? brand : null}
        open={linksPanelOpen}
        onClose={() => setLinksPanelOpen(false)}
        viewMonth={viewMonth}
        todayYm={todayYm}
        readOnly={readOnly}
        employees={employees}
        onAddLink={() => {
          setLinksPanelOpen(false);
          router.push(`/izlenme?brand=${brand.id}`);
        }}
        onEditLink={() => {
          setLinksPanelOpen(false);
          router.push(`/izlenme?brand=${brand.id}`);
        }}
        onAddSnapshot={(l) => {
          setLinksPanelOpen(false);
          setSnapshotModal({ link: l });
        }}
        onViewHistory={(l) => {
          setLinksPanelOpen(false);
          setHistoryModal(l);
        }}
      />

      {/* Snapshot ekle/düzenle */}
      <Modal
        open={snapshotModal !== null}
        onClose={() => setSnapshotModal(null)}
        title={snapshotModal?.snapshot ? "Snapshot'ı Düzenle" : "Yeni İzlenme Snapshot'ı"}
      >
        {snapshotModal && readOnly && (
          <p className="text-sm text-muted-foreground py-4">
            Denetçi görünümünde snapshot eklenemez veya düzenlenemez.
          </p>
        )}
        {snapshotModal && !readOnly && (
          <SnapshotForm
            key={snapshotModal.snapshot?.id ?? `new-${snapshotModal.link.id}-${viewMonth}`}
            link={snapshotModal.link}
            initial={snapshotModal.snapshot}
            defaultDateForNew={defaultSnapshotDateInMonth(viewMonth)}
            suggestedViewsForNew={
              snapshotModal.snapshot
                ? undefined
                : linkViewsForMonth(snapshotModal.link, viewMonth, linkSnapshots, todayYm).lastViews
            }
            onSave={(d) => {
              if (snapshotModal.snapshot) {
                updateLinkSnapshot(snapshotModal.snapshot.id, d);
              } else {
                addLinkSnapshot({ ...d, linkId: snapshotModal.link.id });
              }
              setSnapshotModal(null);
            }}
            onDelete={
              snapshotModal.snapshot
                ? () => {
                    deleteLinkSnapshot(snapshotModal.snapshot!.id);
                    setSnapshotModal(null);
                  }
                : undefined
            }
            onClose={() => setSnapshotModal(null)}
          />
        )}
      </Modal>

      {/* Snapshot geçmişi */}
      <Modal
        open={historyModal !== null}
        onClose={() => setHistoryModal(null)}
        title={`Snapshot geçmişi · ${historyModal?.platform ?? ""}`}
      >
        {historyModal && (
          <SnapshotHistory
            link={historyModal}
            snapshots={linkSnapshots.filter((s) => s.linkId === historyModal.id)}
            readOnly={readOnly}
            onEdit={(s) => {
              setHistoryModal(null);
              setSnapshotModal({ link: historyModal, snapshot: s });
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Snapshot Form ─────────────────────────────────────────────────────────
function SnapshotForm({
  link,
  initial,
  defaultDateForNew,
  suggestedViewsForNew,
  onSave,
  onDelete,
  onClose,
}: {
  link: BrandLink;
  initial?: LinkSnapshot;
  defaultDateForNew: string;
  suggestedViewsForNew?: number;
  onSave: (d: Omit<LinkSnapshot, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<LinkSnapshot, "id">>({
    linkId: link.id,
    date: initial?.date ?? defaultDateForNew,
    views: initial?.views ?? suggestedViewsForNew ?? 0,
    notes: initial?.notes ?? "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <FormGrid>
        <Field label="Tarih">
          <DateTimePicker
            mode="date"
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
            required
          />
        </Field>
        <Field label="Toplam izlenme">
          <Input
            type="number"
            min={0}
            value={form.views}
            onChange={(e) => setForm({ ...form, views: Number(e.target.value) || 0 })}
            required
          />
        </Field>
      </FormGrid>
      <Field label="Not" hint="Opsiyonel açıklama (kampanya, kaynak vs.)">
        <Textarea
          rows={2}
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <FormActions
        onCancel={onClose}
        onDelete={onDelete}
        submitLabel={initial ? "Güncelle" : "Snapshot Kaydet"}
      />
    </form>
  );
}

// ── Snapshot history ──────────────────────────────────────────────────────
function SnapshotHistory({
  link,
  snapshots,
  onEdit,
  readOnly,
}: {
  link: BrandLink;
  snapshots: LinkSnapshot[];
  onEdit: (s: LinkSnapshot) => void;
  readOnly: boolean;
}) {
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots]
  );
  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-4">
        Henüz snapshot yok.
      </p>
    );
  }
  const max = Math.max(...sorted.map((s) => s.views), 1);
  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={sorted}>
            <defs>
              <linearGradient id="snaphist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
            <YAxis
              stroke="#6b7280"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <RTooltip
              contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => v.toLocaleString("tr-TR")}
            />
            <Area type="monotone" dataKey="views" stroke="#10b981" strokeWidth={2} fill="url(#snaphist)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5">
        {[...sorted].reverse().map((s, i, arr) => {
          const next = arr[i + 1];
          const delta = next ? s.views - next.views : null;
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border/60 bg-card"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium tabular-nums">
                  {s.date} · {s.views.toLocaleString("tr-TR")} izlenme
                  {delta != null && (
                    <span
                      className={`ml-2 text-[10px] tabular-nums ${
                        delta > 0
                          ? "text-emerald-600 dark:text-emerald-300"
                          : delta < 0
                            ? "text-red-600 dark:text-red-300"
                            : "text-muted-foreground"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toLocaleString("tr-TR")}
                    </span>
                  )}
                </p>
                {s.notes && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.notes}</p>
                )}
              </div>
              {!readOnly && (
                <Button size="sm" variant="ghost" className="h-7" onClick={() => onEdit(s)}>
                  Düzenle
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
