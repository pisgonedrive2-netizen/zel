"use client";

import Link from "next/link";
import { Download, FileSpreadsheet, BarChart3, Wallet } from "lucide-react";
import { useStore } from "@/store/store";
import { sumBrandContentExpensesForMonth } from "@/lib/brand-month-metrics";
import { BrandLogo } from "@/components/brand-logo";
import { BrandMonthlyStatsPanel } from "@/components/brand-monthly-stats-panel";
import { BrandMonthlyTrend } from "@/components/brand-monthly-trend";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import {
  findBrandMonthlyStats,
  brandStatsExportRows,
  deriveBrandMonthlyStats,
  hasBrandMonthlyStatsData,
} from "@/lib/brand-monthly-stats";
import {
  downloadBrandOperationPdf,
  downloadBrandOperationCsv,
  type BrandOperationPdfInput,
} from "@/lib/marka-izlenme-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarkaOperasyonPage() {
  const { brandMonthlyStats, brands, contentExpenses } = useStore();
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle } = portal;
  const izlenmeHref = markaHref("/marka/izlenmeler", month);

  const statsRow = brandId
    ? findBrandMonthlyStats(brandMonthlyStats, brandId, month)
    : undefined;
  const hasStats = statsRow ? hasBrandMonthlyStatsData(statsRow) : false;

  const monthExpense = brand
    ? sumBrandContentExpensesForMonth(contentExpenses, brand, month, brands)
    : 0;

  const buildOperationExport = (): BrandOperationPdfInput | null => {
    if (!brand || !brandId) return null;
    const row = findBrandMonthlyStats(brandMonthlyStats, brandId, month);
    const operationStats = row
      ? brandStatsExportRows(row, deriveBrandMonthlyStats(row))
      : [];
    if (monthExpense > 0) {
      operationStats.push({
        label: "İçerik harcaması (pay)",
        value: `$${monthExpense.toLocaleString("tr-TR")}`,
      });
    }
    return {
      brandFullName: brand.name,
      monthYm: month,
      monthTitle,
      operationStats,
    };
  };

  const doExport = (kind: "pdf" | "csv") => {
    const p = buildOperationExport();
    if (!p) return;
    if (kind === "pdf") downloadBrandOperationPdf(p, brand?.shortName);
    else downloadBrandOperationCsv(p, brand?.shortName);
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
        <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
                <h1 className="text-xl font-semibold text-foreground">{brand.name} · Operasyon özeti</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Kayıt olan üye, yatırım yapan üye, tutarlar ve canlı demo bakiyesi — ay bazında giriş ve raporlama.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                İzlenme ve link verileri için{" "}
                <Link href={izlenmeHref} className="text-primary underline">
                  İzlenmeler
                </Link>{" "}
                sayfasına gidin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => doExport("pdf")}
                disabled={!hasStats && monthExpense <= 0}
                title={hasStats || monthExpense > 0 ? undefined : "Önce bu ay için veri kaydedin"}
              >
                <Download size={14} /> PDF indir
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => doExport("csv")}
                disabled={!hasStats && monthExpense <= 0}
              >
                <FileSpreadsheet size={14} /> CSV
              </Button>
            </div>
          </div>

          <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />

          {monthExpense > 0 && (
            <Card className="border-amber-200/60 bg-amber-50/20 dark:border-amber-500/40 dark:bg-amber-950/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet size={16} className="text-amber-700 dark:text-amber-300" />
                  İçerik harcaması · {monthTitle}
                </CardTitle>
                <CardDescription>
                  Bu markaya yazılan pay (ortak harcamalar eşit bölünür)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-200">
                  ${monthExpense.toLocaleString("tr-TR")}
                </p>
              </CardContent>
            </Card>
          )}

          {!hasStats && (
            <Card className="border-violet-200/60 bg-violet-50/20 dark:border-violet-500/40 dark:bg-violet-950/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={16} className="text-violet-700 dark:text-violet-300" />
                  Bu ay henüz kayıt yok
                </CardTitle>
                <CardDescription>
                  Aşağıdaki formu doldurup kaydedin; ardından PDF/CSV ile paylaşabilirsiniz.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <BrandMonthlyStatsPanel brandId={brandId} monthYm={month} />

          <BrandMonthlyTrend brandId={brandId} monthYm={month} months={6} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rapor içeriği</CardTitle>
              <CardDescription>PDF ve CSV dosyalarında yer alan metrikler</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Kayıt olan üye sayısı</li>
                <li>Yatırım yapan üye ve ilk yatırım (FTD)</li>
                <li>Toplam yatırım, çekim ve net yatırım</li>
                <li>Ortalama yatırım / üye ve kayıt → yatırım oranı</li>
                <li>Canlı demo tahsis, kalan ve kullanım</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </MarkaPageGuard>
  );
}
