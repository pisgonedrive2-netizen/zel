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
import { toYearMonthLocal } from "@/lib/data";
import { linkViewsForMonth } from "@/lib/brand-month-metrics";
import {
  downloadBrandMonthCsv,
  downloadBrandMonthPdf,
  weekOverlapsMonth,
  type BrandMonthPdfInput,
} from "@/lib/marka-izlenme-pdf";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SocialPlatformIcon, platformAccentClass } from "@/components/social-platform-icon";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Select } from "@/components/ui/field";

const CARD_PREVIEW_LIMIT = 5;
const PLATFORM_LEGEND = ["YouTube", "Instagram", "TikTok", "Kick", "Twitch", "Telegram"];

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
  const { brandLinks, brandViewership, weekBrandReels, linkSnapshots, employees } = useStore();
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [reelStreamerFilter, setReelStreamerFilter] = useState<string>("all");

  const todayYm = toYearMonthLocal(new Date());

  const linksForBrand = useMemo(
    () => brandLinks.filter((l) => l.brandId === brandId),
    [brandLinks, brandId]
  );

  const linksWithMonthViews = useMemo(
    () =>
      linksForBrand
        .map((link) => ({
          link,
          ...linkViewsForMonth(link, month, linkSnapshots, todayYm),
        }))
        .sort((a, b) => {
          if (b.lastViews !== a.lastViews) return b.lastViews - a.lastViews;
          return a.link.platform.localeCompare(b.link.platform, "tr");
        }),
    [linksForBrand, month, linkSnapshots, todayYm]
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
    () => linksWithMonthViews.reduce((s, r) => s + r.lastViews, 0),
    [linksWithMonthViews]
  );

  const hasTarget = Boolean(brand?.monthlyTarget != null && brand.monthlyTarget > 0);
  const targetPct =
    brand && hasTarget
      ? Math.min(100, (totalLinkViewsMonth / brand.monthlyTarget!) * 100)
      : null;

  const empName = (id?: string) => employees.find((e) => e.id === id)?.name ?? id ?? "—";

  const buildExportPayload = (): BrandMonthPdfInput | null => {
    if (!brand) return null;
    const linkRows = linksWithMonthViews.map(({ link, lastViews, refDate }) => ({
      platform: link.platform,
      handle: link.handle || "-",
      url: link.url || "-",
      owner: link.ownerId ? empName(link.ownerId) : "Genel / atanmamış",
      lastViews: lastViews > 0 ? fmtViews(lastViews) : "-",
      lastSnapshot: refDate ?? "-",
    }));
    const monthlyRows = viewRows.map((v) => ({
      kaynak: v.employeeId ? `Yayinci: ${empName(v.employeeId)}` : "Genel / admin",
      izlenme: fmtViews(v.views),
      url: v.url || "-",
      not: v.notes || "-",
    }));
    if (monthlyRows.length === 0 && totalLinkViewsMonth > 0) {
      monthlyRows.push({
        kaynak: "Marka linkleri toplami (hesaplanan)",
        izlenme: fmtViews(totalLinkViewsMonth),
        url: "-",
        not: "-",
      });
    }
    const reels = reelsInMonth.map((r) => ({
      hafta: weekRangeLabel(r.weekStart),
      yayıncı: empName(r.employeeId),
      platform: r.platform,
      link: r.contentUrl,
      not: r.notes || "-",
    }));
    return {
      brandFullName: brand.name,
      monthYm: month,
      monthTitle,
      links: linkRows,
      monthlyRows,
      reels,
    };
  };

  const doExport = (kind: "pdf" | "csv") => {
    const p = buildExportPayload();
    if (!p) return;
    if (kind === "pdf") downloadBrandMonthPdf(p, brand?.shortName);
    else downloadBrandMonthCsv(p, brand?.shortName);
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
                <Link href="/marka/operasyon" className="text-primary underline">
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
                      {monthLabelTr(month)} · {linksForBrand.length} kayıt · önizleme{" "}
                      {Math.min(CARD_PREVIEW_LIMIT, linksForBrand.length)}
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
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {PLATFORM_LEGEND.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      title={p}
                    >
                      <SocialPlatformIcon platform={p} size={14} />
                      <span className="hidden sm:inline">{p}</span>
                    </span>
                  ))}
                </div>
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
                        <SocialPlatformIcon platform={link.platform} size={22} />
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
                {linksForBrand.length > CARD_PREVIEW_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setLinksModalOpen(true)}
                    className="w-full text-center text-xs text-primary hover:underline py-2"
                  >
                    +{linksForBrand.length - CARD_PREVIEW_LIMIT} link daha · tümünü aç
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
