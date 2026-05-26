"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Download, FileSpreadsheet, Target, LayoutGrid, Users, Filter } from "lucide-react";
import { useStore } from "@/store/store";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { MarkaViewershipCharts } from "@/components/marka-viewership-charts";
import { MarkaLinksPreviewModal } from "@/components/marka-links-preview-modal";
import { useMarkaPortal, monthLabelTr } from "@/hooks/use-marka-portal";
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
import { Badge } from "@/components/ui/badge";
import { SocialPlatformIcon, platformAccentClass } from "@/components/social-platform-icon";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ViewDotCard } from "@/components/view-dot-card";
import { Select } from "@/components/ui/field";

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
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle } = portal;
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
  } = useStore();
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [reelStreamerFilter, setReelStreamerFilter] = useState<string>("all");
  const [linkSearch, setLinkSearch] = useState("");
  const [linkPlatform, setLinkPlatform] = useState("all");
  const [linkOwnerId, setLinkOwnerId] = useState("all");
  const [linkSort, setLinkSort] = useState<BrandLinkSortKey>("views");
  const [linkMonthOnly, setLinkMonthOnly] = useState(true);

  const todayYm = toYearMonthLocal(new Date());

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

  const totalLinkViewsMonth = useMemo(
    () => enrichedLinks.reduce((s, r) => s + r.lastViews, 0),
    [enrichedLinks]
  );

  const totalStreamerViewsMonth = useMemo(
    () => viewRows.reduce((s, v) => s + v.views, 0),
    [viewRows]
  );

  const hasTarget = Boolean(brand?.monthlyTarget != null && brand.monthlyTarget > 0);
  const targetPct =
    brand && hasTarget
      ? Math.min(100, (totalLinkViewsMonth / brand.monthlyTarget!) * 100)
      : null;

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
                Marka linkleri, yayıncı aylık izlenmeleri ve haftalık içerik linkleri — salt okunur.
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

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
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
          </div>

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
            {hasTarget && targetPct !== null && (
              <Card className="md:col-span-2 border-blue-200/60 bg-blue-50/20 dark:border-blue-500/40 dark:bg-blue-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target size={16} className="text-blue-700 dark:text-blue-300" />
                    Aylık izlenme hedefi
                  </CardTitle>
                  <CardDescription>
                    {monthLabelTr(month)} · hedef {fmtViews(brand.monthlyTarget!)} · link toplamı{" "}
                    {fmtViews(totalLinkViewsMonth)} ({targetPct.toFixed(0)}%)
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${targetPct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

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
                  <p className="text-sm text-muted-foreground">Henüz link yok.</p>
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
                    <p className="text-xs flex items-center gap-1.5">
                      <SocialPlatformIcon platform={r.platform} size={14} />
                      {r.platform}
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
