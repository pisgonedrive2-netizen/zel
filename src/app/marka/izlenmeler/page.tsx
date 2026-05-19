"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink, Download, FileSpreadsheet, Target } from "lucide-react";
import { useStore } from "@/store/store";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal, monthLabelTr } from "@/hooks/use-marka-portal";
import { toYearMonthLocal } from "@/lib/data";
import {
  downloadBrandMonthCsv,
  downloadBrandMonthPdf,
  weekOverlapsMonth,
  type BrandMonthPdfInput,
} from "@/lib/marka-izlenme-pdf";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  const todayYm = toYearMonthLocal(new Date());

  const linksForBrand = useMemo(
    () => brandLinks.filter((l) => l.brandId === brandId),
    [brandLinks, brandId]
  );

  const viewRows = useMemo(
    () => brandViewership.filter((v) => v.brandId === brandId && v.month === month),
    [brandViewership, brandId, month]
  );

  const reelsInMonth = useMemo(
    () => weekBrandReels.filter((r) => r.brandId === brandId && weekOverlapsMonth(r.weekStart, month)),
    [weekBrandReels, brandId, month]
  );

  const linkViewsForMonth = useMemo(() => {
    let sum = 0;
    for (const l of linksForBrand) {
      const monthSnaps = linkSnapshots
        .filter((s) => s.linkId === l.id && s.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date));
      if (monthSnaps.length > 0) sum += monthSnaps[0].views;
      else if (month === todayYm) sum += l.lastViews ?? 0;
    }
    return sum;
  }, [linksForBrand, linkSnapshots, month, todayYm]);

  const hasTarget = Boolean(brand?.monthlyTarget != null && brand.monthlyTarget > 0);
  const targetPct =
    brand && hasTarget
      ? Math.min(100, (linkViewsForMonth / brand.monthlyTarget!) * 100)
      : null;

  const empName = (id?: string) => employees.find((e) => e.id === id)?.name ?? id ?? "—";

  const buildExportPayload = (): BrandMonthPdfInput | null => {
    if (!brand) return null;
    const linkRows = linksForBrand.map((l) => ({
      platform: l.platform,
      handle: l.handle || "-",
      url: l.url || "-",
      lastViews: l.lastViews != null ? fmtViews(l.lastViews) : "-",
      lastSnapshot: l.lastSnapshotDate ?? "-",
    }));
    const monthlyRows = viewRows.map((v) => ({
      kaynak: v.employeeId ? `Yayinci: ${empName(v.employeeId)}` : "Genel / admin",
      izlenme: fmtViews(v.views),
      url: v.url || "-",
      not: v.notes || "-",
    }));
    if (monthlyRows.length === 0 && linkViewsForMonth > 0) {
      monthlyRows.push({
        kaynak: "Marka linkleri toplami (hesaplanan)",
        izlenme: fmtViews(linkViewsForMonth),
        url: "-",
        not: "-",
      });
    }
    const reels = reelsInMonth.map((r) => ({
      hafta: weekRangeLabel(r.weekStart),
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
                    {fmtViews(linkViewsForMonth)} ({targetPct.toFixed(0)}%)
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
                <CardTitle className="text-base">Marka linkleri</CardTitle>
                <CardDescription>Tüm platform URL’leri · {linksForBrand.length} kayıt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                {linksForBrand.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz link yok.</p>
                ) : (
                  linksForBrand.map((l) => (
                    <div key={l.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{l.platform}</span>
                        <Badge variant="secondary" className="text-[10px] tabular-nums">
                          {l.lastViews != null ? fmtViews(l.lastViews) : "—"}
                        </Badge>
                      </div>
                      {l.handle && <p className="text-xs text-muted-foreground">{l.handle}</p>}
                      {l.url ? (
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener"
                          className="text-[11px] text-blue-600 inline-flex items-center gap-1 mt-1 break-all"
                        >
                          {l.url} <ExternalLink size={10} />
                        </a>
                      ) : null}
                    </div>
                  ))
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
                  <p className="text-xs text-muted-foreground">Bu ay marka linkleri toplamı (hesaplanan)</p>
                  <p className="text-lg font-bold tabular-nums">{fmtViews(linkViewsForMonth)}</p>
                </div>
                {viewRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu ay için yayıncı izlenme kaydı yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {viewRows.map((v) => (
                      <li key={v.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex justify-between gap-2">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Haftalık içerik linkleri (reel / post)</CardTitle>
              <CardDescription>Bu ay içine denk gelen haftalar · tüm yayıncılar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {reelsInMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kayıt yok.</p>
              ) : (
                reelsInMonth.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">{weekRangeLabel(r.weekStart)}</p>
                    <p className="text-xs">{empName(r.employeeId)} · {r.platform}</p>
                    <a href={r.contentUrl} target="_blank" rel="noopener" className="text-[11px] text-blue-600 break-all">
                      {r.contentUrl}
                    </a>
                    {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </MarkaPageGuard>
  );
}
