"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Download,
  FileSpreadsheet,
  Target,
  LayoutGrid,
  Users,
  Filter,
  Pencil,
  Check,
  X,
  Globe2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/store/store";
import { sumBrandContentExpensesForMonth } from "@/lib/brand-month-metrics";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { MarkaViewershipCharts } from "@/components/marka-viewership-charts";
import { MarkaLinksPreviewModal } from "@/components/marka-links-preview-modal";
import { useMarkaPortal, monthLabelTr } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { markaHref } from "@/lib/use-marka-view-month";
import { toYearMonthLocal } from "@/lib/data";
import { buildBrandMonthExportPayload } from "@/lib/izlenme-brand-export";
import {
  downloadBrandMonthCsv,
  downloadBrandMonthPdf,
  weekOverlapsMonth,
} from "@/lib/marka-izlenme-pdf";
import {
  enrichBrandLinksForMonth,
  filterBrandLinksDisplay,
  sortBrandLinksDisplay,
} from "@/lib/brand-link-display";
import { BrandLinkListToolbar } from "@/components/brand-link-list-toolbar";
import { BrandLinkThumb } from "@/components/brand-link-thumb";
import type { BrandLinkSortKey } from "@/lib/brand-link-display";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SocialPlatformIcon, platformAccentClass } from "@/components/social-platform-icon";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ViewDotCard } from "@/components/view-dot-card";
import { Select } from "@/components/ui/field";
import { MarkaAchievementPanel } from "@/components/marka/marka-achievement-panel";
import { BrandLinkViewershipSummary } from "@/components/brand-link-viewership-summary";
import {
  buildBrandAggregatedActivity,
  buildBrandStreamerActivity,
  countActivityDaysInMonth,
  reelDisplayDate,
  scopeBrandActivityData,
} from "@/lib/brand-activity-dates";
import { fetchTrackingDomains } from "@/lib/marka-igaming-api";
import type { BrandTrackingDomain } from "@/types/brand-igaming";
import { fmtDateTime } from "@/lib/fmt-date";

const CARD_PREVIEW_LIMIT = 5;

function weekRangeLabel(weekStartIso: string) {
  const a = new Date(weekStartIso + "T00:00:00");
  const b = new Date(weekStartIso + "T00:00:00");
  b.setDate(b.getDate() + 6);
  return `${a.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${b.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

export default function MarkaIzlenmelerPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle, isAdminView } = portal;
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const operasyonHref = markaHref("/marka/operasyon", month);
  const {
    brands,
    brandLinks,
    brandViewership,
    weekBrandReels,
    linkSnapshots,
    employees,
    contentExpenses,
    brandMonthlyStats,
    brandPosts,
    brandDeals,
    updateBrand,
    affiliateDailyStats,
  } = useStore();
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [reelStreamerFilter, setReelStreamerFilter] = useState<string>("all");
  const [linkSearch, setLinkSearch] = useState("");
  const [linkPlatform, setLinkPlatform] = useState("all");
  const [linkOwnerId, setLinkOwnerId] = useState("all");
  const [linkSort, setLinkSort] = useState<BrandLinkSortKey>("views");
  const [linkMonthOnly, setLinkMonthOnly] = useState(true);
  const [trackingDomains, setTrackingDomains] = useState<BrandTrackingDomain[]>([]);

  const todayYm = toYearMonthLocal(new Date());

  useEffect(() => {
    if (!brandId) return;
    fetchTrackingDomains(brandId)
      .then(setTrackingDomains)
      .catch(() => setTrackingDomains([]));
  }, [brandId]);

  const linksForBrand = useMemo(
    () => brandLinks.filter((l) => l.brandId === brandId),
    [brandLinks, brandId]
  );

  const enrichedLinks = useMemo(
    () => enrichBrandLinksForMonth(linksForBrand, month, linkSnapshots, todayYm, employees),
    [linksForBrand, month, linkSnapshots, todayYm, employees]
  );

  const linkOwners = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of linksForBrand) {
      const id = l.ownerId ?? "_none";
      const name = l.ownerId
        ? employees.find((e) => e.id === id)?.name ?? "?"
        : "Genel / atanmamış";
      map.set(id, name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [linksForBrand, employees]);

  const linkPlatforms = useMemo(
    () => [...new Set(linksForBrand.map((l) => l.platform))].sort((a, b) => a.localeCompare(b, "tr")),
    [linksForBrand]
  );

  const filteredLinks = useMemo(() => {
    const list = filterBrandLinksDisplay(enrichedLinks, {
      search: linkSearch,
      platform: linkPlatform,
      ownerId: linkOwnerId,
      monthOnly: linkMonthOnly,
      monthYm: month,
      todayYm,
    });
    return sortBrandLinksDisplay(list, linkSort);
  }, [
    enrichedLinks,
    linkSearch,
    linkPlatform,
    linkOwnerId,
    linkMonthOnly,
    month,
    todayYm,
    linkSort,
  ]);

  const linksWithMonthViews = useMemo(
    () =>
      filteredLinks.map((link) => ({
        link,
        lastViews: link.lastViews,
        refDate: link.refDate,
        stale: link.stale,
      })),
    [filteredLinks]
  );

  const viewRows = useMemo(
    () => brandViewership.filter((v) => v.brandId === brandId && v.month === month),
    [brandViewership, brandId, month]
  );

  const reelsInMonth = useMemo(
    () => weekBrandReels.filter((r) => r.brandId === brandId && weekOverlapsMonth(r.weekStart, month)),
    [weekBrandReels, brandId, month]
  );

  const reelStreamers = useMemo(() => {
    const ids = new Set(reelsInMonth.map((r) => r.employeeId));
    return employees.filter((e) => ids.has(e.id));
  }, [reelsInMonth, employees]);

  const filteredReels = useMemo(() => {
    if (reelStreamerFilter === "all") return reelsInMonth;
    return reelsInMonth.filter((r) => r.employeeId === reelStreamerFilter);
  }, [reelsInMonth, reelStreamerFilter]);

  const activityScope = useMemo(
    () =>
      brandId
        ? scopeBrandActivityData(brandId, {
            weekBrandReels,
            brandPosts,
            brandLinks,
            brandDeals,
          })
        : null,
    [brandId, weekBrandReels, brandPosts, brandLinks, brandDeals]
  );

  const sharingDaysThisMonth = useMemo(() => {
    if (!activityScope) return 0;
    const { byDate } =
      reelStreamerFilter === "all"
        ? buildBrandAggregatedActivity(activityScope)
        : buildBrandStreamerActivity(reelStreamerFilter, activityScope);
    return countActivityDaysInMonth(byDate, month);
  }, [activityScope, reelStreamerFilter, month]);

  const totalLinkViewsMonth = useMemo(
    () => enrichedLinks.reduce((s, r) => s + r.lastViews, 0),
    [enrichedLinks]
  );

  const totalStreamerViewsMonth = useMemo(
    () => viewRows.reduce((s, v) => s + v.views, 0),
    [viewRows]
  );

  const staleLinkCount = useMemo(
    () => enrichedLinks.filter((l) => l.stale && l.url?.trim()).length,
    [enrichedLinks]
  );

  const monthContentExpense = useMemo(
    () =>
      brand ? sumBrandContentExpensesForMonth(contentExpenses, brand, month, brands) : 0,
    [contentExpenses, brand, month, brands]
  );

  const affiliateMonthStats = useMemo(() => {
    if (!brandId) return { clicks: 0, registrations: 0, ftd: 0 };
    const prefix = `${month}-`;
    const rows = affiliateDailyStats.filter(
      (s) => s.brandId === brandId && s.statDate.startsWith(prefix)
    );
    return {
      clicks: rows.reduce((sum, s) => sum + (s.clicks ?? 0), 0),
      registrations: rows.reduce((sum, s) => sum + (s.registrations ?? 0), 0),
      ftd: rows.reduce((sum, s) => sum + (s.ftdCount ?? 0), 0),
    };
  }, [affiliateDailyStats, brandId, month]);

  const hasTarget = Boolean(brand?.monthlyTarget != null && brand.monthlyTarget > 0);
  const targetPct =
    brand && hasTarget
      ? Math.min(100, (totalLinkViewsMonth / brand.monthlyTarget!) * 100)
      : null;

  const canEditTarget =
    !readOnly &&
    (user?.role === "admin" ||
      (user?.role === "brand" && user.brandId === brandId));
  const [targetEditing, setTargetEditing] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(
    brand?.monthlyTarget != null ? String(brand.monthlyTarget) : ""
  );
  const [targetBusy, setTargetBusy] = useState(false);

  const saveTarget = async () => {
    if (!brand || !brandId) return;
    const trimmed = targetInput.trim();
    const next = trimmed === "" ? null : Math.max(0, Math.round(Number(trimmed)));
    if (next != null && (!Number.isFinite(next) || Number.isNaN(next))) {
      window.alert("Geçersiz sayı");
      return;
    }
    setTargetBusy(true);
    try {
      const res = await fetch("/api/marka/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brandId, monthlyTarget: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Kayıt başarısız");
      }
      updateBrand(brandId, { monthlyTarget: next ?? undefined });
      setTargetEditing(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setTargetBusy(false);
    }
  };

  const empName = (id?: string) => employees.find((e) => e.id === id)?.name ?? id ?? "—";

  const doExport = (kind: "pdf" | "csv") => {
    if (!brand) return;
    try {
      const p = buildBrandMonthExportPayload({
        brand,
        viewMonth: month,
        todayYm,
        brands,
        brandLinks: linksForBrand,
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

  const previewLinks = linksWithMonthViews.slice(0, CARD_PREVIEW_LIMIT);

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
        <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
                <h1 className="text-xl font-semibold text-foreground">{brand.name} · İzlenmeler</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Marka linkleri ve yayıncı izlenmeleri salt okunur; aylık izlenme hedefi bu sayfadan düzenlenebilir.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Kayıt / yatırım metrikleri için{" "}
                <Link href={operasyonHref} className="text-primary underline">
                  Operasyon özeti
                </Link>{" "}
                sayfasına gidin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => doExport("pdf")}>
                <Download size={14} /> PDF
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => doExport("csv")}>
                <FileSpreadsheet size={14} /> CSV
              </Button>
            </div>
          </div>

          <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />

          {staleLinkCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {staleLinkCount} linkte bu ay güncel snapshot yok
                </p>
                <p className="text-xs mt-0.5 opacity-90">
                  İzlenme rakamları eksik veya eski olabilir. Link listesinden kontrol edin veya
                  admin panelinden yenileyin.
                </p>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary underline mt-1"
                  onClick={() => setLinksModalOpen(true)}
                >
                  Linkleri incele
                </button>
              </div>
            </div>
          )}

          <BrandLinkViewershipSummary
            links={linksForBrand}
            snapshots={linkSnapshots}
            viewMonth={month}
            todayYm={todayYm}
            title="Tüm linkler · izlenme özeti"
          />

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl">
            <ViewDotCard
              target={totalLinkViewsMonth + totalStreamerViewsMonth}
              metricCaption="Views"
              label={`${monthTitle} · Toplam`}
              sub="Link + yayıncı kayıtları"
              accent="violet"
            />
            <ViewDotCard
              target={totalLinkViewsMonth}
              metricCaption="Views"
              label="Marka linkleri"
              sub={`${linksForBrand.length} link`}
              accent="blue"
            />
            <ViewDotCard
              target={totalStreamerViewsMonth}
              metricCaption="Views"
              label="Yayıncı kayıtları"
              sub={`${viewRows.length} satır`}
              accent="emerald"
              size="sm"
            />
            <ViewDotCard
              target={monthContentExpense}
              metricCaption="USD"
              label="İçerik harcaması"
              sub={monthContentExpense > 0 ? "Bu ay marka payı" : "Bu ay kayıt yok"}
              accent="amber"
              size="sm"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe2 size={16} className="text-[#FF6B00]" />
                Affiliate takip domainleri
              </CardTitle>
              <CardDescription>
                Landing ve yönlendirme domainleri · SSL ve son kontrol
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trackingDomains.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Henüz takip domaini kaydı yok.{" "}
                  <Link href={markaHref("/marka/entegrasyon", month)} className="text-primary underline">
                    Entegrasyon
                  </Link>{" "}
                  sayfasından domain ekleyebilirsiniz.
                </p>
              ) : (
                <>
                  {(affiliateMonthStats.clicks > 0 ||
                    affiliateMonthStats.registrations > 0 ||
                    affiliateMonthStats.ftd > 0) && (
                    <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/25 p-3 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Affiliate tıklama</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {affiliateMonthStats.clicks.toLocaleString("tr-TR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Kayıt</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {affiliateMonthStats.registrations.toLocaleString("tr-TR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">FTD</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {affiliateMonthStats.ftd.toLocaleString("tr-TR")}
                        </p>
                      </div>
                    </div>
                  )}
                <ul className="space-y-2">
                  {trackingDomains.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{d.domain}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] shrink-0",
                            d.sslOk
                              ? "border-[#22C55E]/50 text-[#16A34A]"
                              : "border-red-300 text-red-700"
                          )}
                        >
                          <ShieldCheck size={10} className="mr-0.5 inline" />
                          SSL {d.sslOk ? "OK" : "Hata"}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {d.lastCheckedAt
                          ? fmtDateTime(d.lastCheckedAt)
                          : "Kontrol yok"}
                      </span>
                    </li>
                  ))}
                </ul>
                </>
              )}
            </CardContent>
          </Card>

          <CollapsibleSection
            defaultOpen
            title="İzlenme grafikleri ve kıyaslama"
            description="Aylık trend, platform dağılımı, önceki aya göre değişim"
          >
            <MarkaViewershipCharts
              brand={brand}
              brandLinks={brandLinks}
              linkSnapshots={linkSnapshots}
              brandViewership={brandViewership}
              monthYm={month}
              todayYm={todayYm}
            />
          </CollapsibleSection>

          <CollapsibleSection
            defaultOpen
            title="Linkler ve ay özeti"
            description={monthLabelTr(month)}
          >
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="md:col-span-2 border-blue-200/60 bg-blue-50/20 dark:border-blue-500/40 dark:bg-blue-950/30">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target size={16} className="text-blue-700 dark:text-blue-300" />
                      Aylık izlenme hedefi
                    </CardTitle>
                    <CardDescription>
                      {hasTarget
                        ? `${monthLabelTr(month)} · hedef ${fmtViews(brand.monthlyTarget!)} · link toplamı ${fmtViews(totalLinkViewsMonth)} (${targetPct!.toFixed(0)}%)`
                        : "Bu marka için aylık izlenme hedefi henüz tanımlanmamış."}
                    </CardDescription>
                  </div>
                  {canEditTarget && !targetEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 shrink-0"
                      onClick={() => {
                        setTargetInput(
                          brand.monthlyTarget != null ? String(brand.monthlyTarget) : ""
                        );
                        setTargetEditing(true);
                      }}
                    >
                      <Pencil size={12} />
                      {hasTarget ? "Hedefi düzenle" : "Hedef gir"}
                    </Button>
                  )}
                  {canEditTarget && targetEditing && (
                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        placeholder="örn. 500000"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        className="h-8 w-32 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={targetBusy}
                        onClick={() => void saveTarget()}
                      >
                        <Check size={12} />
                        Kaydet
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={targetBusy}
                        onClick={() => setTargetEditing(false)}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {hasTarget && targetPct !== null ? (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${targetPct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Hedef belirlendiğinde gerçekleşme yüzdesi burada görünür ve yönetici panelinde
                    tüm raporlara yansır.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Marka linkleri</CardTitle>
                    <CardDescription>
                      {monthLabelTr(month)} · {filteredLinks.length} / {linksForBrand.length} link
                      · önizleme {Math.min(CARD_PREVIEW_LIMIT, filteredLinks.length)}
                    </CardDescription>
                  </div>
                  {linksForBrand.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => setLinksModalOpen(true)}
                    >
                      <LayoutGrid size={14} />
                      Tümünü göster
                    </Button>
                  )}
                </div>
                <BrandLinkListToolbar
                  className="pt-2"
                  search={linkSearch}
                  onSearchChange={setLinkSearch}
                  platform={linkPlatform}
                  onPlatformChange={setLinkPlatform}
                  platforms={linkPlatforms}
                  ownerId={linkOwnerId}
                  onOwnerChange={setLinkOwnerId}
                  owners={linkOwners}
                  sortKey={linkSort}
                  onSortChange={setLinkSort}
                  monthOnly={linkMonthOnly}
                  onMonthOnlyChange={setLinkMonthOnly}
                />
              </CardHeader>
              <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
                {linksForBrand.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                    <p>Henüz link yok.</p>
                    <p className="mt-1 text-xs">
                      Linkler yönetici veya yayıncı tarafından eklenir. Aylık hedefinizi{" "}
                      <Link href={markaHref("/marka/profil", month)} className="text-primary underline">
                        profil sayfasından
                      </Link>{" "}
                      ayarlayabilirsiniz.
                    </p>
                  </div>
                ) : previewLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Bu ay için izlenme kaydı olan link yok. Tümünü göster ile listeyi inceleyebilirsiniz.
                  </p>
                ) : (
                  previewLinks.map(({ link, lastViews, refDate, stale }) => (
                    <div
                      key={link.id}
                      className={`rounded-lg border px-3 py-2.5 text-sm ${platformAccentClass(link.platform)}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <BrandLinkThumb link={link} className="h-10 w-10 rounded-md shrink-0" />
                        <SocialPlatformIcon platform={link.platform} size={18} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{link.platform}</span>
                            <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">
                              {lastViews > 0 ? fmtViews(lastViews) : "—"}
                            </Badge>
                          </div>
                          {link.handle && (
                            <p className="text-xs text-muted-foreground truncate">{link.handle}</p>
                          )}
                          <p className="text-xs flex items-center gap-1 mt-0.5 text-foreground/90">
                            <Users size={11} className="shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">Yayıncı:</span>
                            <span className="font-medium truncate">
                              {link.ownerId ? empName(link.ownerId) : "Atanmamış / genel"}
                            </span>
                          </p>
                          {stale && month !== todayYm && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              Bu ay snapshot yok
                            </p>
                          )}
                          {refDate && !stale && (
                            <p className="text-[10px] text-muted-foreground">{refDate}</p>
                          )}
                        </div>
                      </div>
                      {link.url ? (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener"
                          className="text-[11px] text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 mt-1.5 break-all hover:underline"
                        >
                          {link.url.replace(/^https?:\/\/(www\.)?/, "")}
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : null}
                    </div>
                  ))
                )}
                {filteredLinks.length > CARD_PREVIEW_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setLinksModalOpen(true)}
                    className="w-full text-center text-xs text-primary hover:underline py-2"
                  >
                    +{filteredLinks.length - CARD_PREVIEW_LIMIT} link daha · tümünü aç
                  </button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{monthLabelTr(month)} özet</CardTitle>
                <CardDescription>Yayıncı bazlı aylık kayıtlar + hesaplanan link toplamı</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">Bu ay marka linkleri toplamı</p>
                  <p className="text-lg font-bold tabular-nums">{fmtViews(totalLinkViewsMonth)}</p>
                </div>
                {viewRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu ay için yayıncı izlenme kaydı yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {viewRows.map((v) => (
                      <li key={v.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-muted-foreground text-xs">{empName(v.employeeId)}</span>
                          <span className="font-semibold tabular-nums">{fmtViews(v.views)}</span>
                        </div>
                        {v.url && (
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noopener"
                            className="text-[11px] text-blue-600 break-all"
                          >
                            {v.url}
                          </a>
                        )}
                        {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          </CollapsibleSection>

          {brandId && (
            <MarkaAchievementPanel
              brandId={brandId}
              brandName={brand.name}
              monthYm={month}
              defaultEmployeeId={reelStreamerFilter === "all" ? "" : reelStreamerFilter}
              defaultOpen
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2 max-w-md">
            <ViewDotCard
              target={sharingDaysThisMonth}
              metricCaption="Gün"
              label={`${monthTitle} · Paylaşım günü`}
              sub={
                reelStreamerFilter === "all"
                  ? "Tüm partner yayıncılar"
                  : empName(reelStreamerFilter)
              }
              accent="emerald"
              size="sm"
            />
          </div>

          <CollapsibleSection
            defaultOpen={false}
            title={`Haftalık içerik / videolar (${filteredReels.length})`}
            description="Yayıncıların bu marka için paylaştığı reel ve post linkleri"
            trailing={
              reelStreamers.length > 0 ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Filter size={12} className="text-muted-foreground" />
                  <Select
                    value={reelStreamerFilter}
                    onChange={(e) => setReelStreamerFilter(e.target.value)}
                    className="h-7 text-[10px] min-w-[120px]"
                    options={[
                      { value: "all", label: "Tüm yayıncılar" },
                      ...reelStreamers.map((e) => ({ value: e.id, label: e.name })),
                    ]}
                  />
                </div>
              ) : undefined
            }
          >
            <div className="space-y-2">
              {filteredReels.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kayıt yok.</p>
              ) : (
                filteredReels.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <Badge variant="secondary" className="text-[11px] gap-1 font-medium">
                        <Users size={12} />
                        Yayıncı: {empName(r.employeeId)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{weekRangeLabel(r.weekStart)}</span>
                    </div>
                    <p className="text-xs flex items-center gap-1.5 flex-wrap">
                      <SocialPlatformIcon platform={r.platform} size={14} />
                      {r.platform}
                      {reelDisplayDate(r) && (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                          · {reelDisplayDate(r)}
                        </span>
                      )}
                      {r.brandLinkId && (
                        <span className="text-[10px] text-muted-foreground">· link eşleşmesi</span>
                      )}
                    </p>
                    <a
                      href={r.contentUrl}
                      target="_blank"
                      rel="noopener"
                      className="text-[11px] text-blue-600 dark:text-blue-400 break-all inline-flex items-center gap-1 mt-1 hover:underline"
                    >
                      {r.contentUrl}
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                    {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          <MarkaLinksPreviewModal
            brand={brand}
            open={linksModalOpen}
            onClose={() => setLinksModalOpen(false)}
            monthYm={month}
            todayYm={todayYm}
            links={linksForBrand}
            linkSnapshots={linkSnapshots}
            employees={employees}
          />
        </div>
      )}
    </MarkaPageGuard>
  );
}
