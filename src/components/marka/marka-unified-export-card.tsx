"use client";

import Link from "next/link";
import { Download, FileSpreadsheet, ExternalLink } from "lucide-react";
import { useStore } from "@/store/store";
import { buildBrandMonthExportPayload } from "@/lib/izlenme-brand-export";
import {
  downloadBrandMonthCsv,
  downloadBrandMonthPdf,
  downloadBrandOperationCsv,
  downloadBrandOperationPdf,
  type BrandOperationPdfInput,
} from "@/lib/marka-izlenme-pdf";
import {
  findBrandMonthlyStats,
  deriveBrandMonthlyStats,
  brandStatsExportRows,
} from "@/lib/brand-monthly-stats";
import { sumBrandContentExpensesForMonth } from "@/lib/brand-month-metrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { markaHref } from "@/lib/use-marka-view-month";
import type { Brand } from "@/store/store";

type Props = {
  brand: Brand;
  brandId: string;
  month: string;
  monthTitle: string;
  todayYm: string;
};

export function MarkaUnifiedExportCard({ brand, brandId, month, monthTitle, todayYm }: Props) {
  const {
    brands,
    brandLinks,
    linkSnapshots,
    brandViewership,
    brandMonthlyStats,
    employees,
    weekBrandReels,
    contentExpenses,
  } = useStore();

  const exportIzlenme = (kind: "pdf" | "csv") => {
    try {
      const payload = buildBrandMonthExportPayload({
        brand,
        viewMonth: month,
        todayYm,
        brands,
        brandLinks: brandLinks.filter((l) => l.brandId === brandId),
        linkSnapshots,
        brandViewership,
        brandMonthlyStats,
        employees,
        weekBrandReels,
        contentExpenses,
      });
      if (!payload) return;
      if (kind === "pdf") downloadBrandMonthPdf(payload, brand.shortName);
      else downloadBrandMonthCsv(payload, brand.shortName);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "İzlenme export başarısız");
    }
  };

  const exportOperasyon = (kind: "pdf" | "csv") => {
    const row = findBrandMonthlyStats(brandMonthlyStats, brandId, month);
    const monthExpense = sumBrandContentExpensesForMonth(contentExpenses, brand, month, brands);
    const operationStats = row
      ? brandStatsExportRows(row, deriveBrandMonthlyStats(row))
      : [];
    if (monthExpense > 0) {
      operationStats.push({
        label: "İçerik harcaması (pay)",
        value: `$${monthExpense.toLocaleString("tr-TR")}`,
      });
    }
    if (operationStats.length === 0) {
      window.alert("Bu ay için operasyon verisi yok.");
      return;
    }
    const p: BrandOperationPdfInput = {
      brandFullName: brand.name,
      monthYm: month,
      monthTitle,
      operationStats,
    };
    if (kind === "pdf") downloadBrandOperationPdf(p, brand.shortName);
    else downloadBrandOperationCsv(p, brand.shortName);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Birleşik dışa aktarım</CardTitle>
        <CardDescription>
          İzlenme ve operasyon raporları — mevcut store verisiyle anında indirilir
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ExportGroup
            title="İzlenme raporu"
            description="Link, yayıncı ve içerik özeti"
            onPdf={() => exportIzlenme("pdf")}
            onCsv={() => exportIzlenme("csv")}
            href={markaHref("/marka/izlenmeler", month)}
          />
          <ExportGroup
            title="Operasyon raporu"
            description="Kayıt, FTD, yatırım/çekim KPI"
            onPdf={() => exportOperasyon("pdf")}
            onCsv={() => exportOperasyon("csv")}
            href={markaHref("/marka/operasyon", month)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ExportGroup({
  title,
  description,
  onPdf,
  onCsv,
  href,
}: {
  title: string;
  description: string;
  onPdf: () => void;
  onCsv: () => void;
  href: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 p-3 space-y-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1 h-8" onClick={onPdf}>
          <Download size={13} /> PDF
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1 h-8" onClick={onCsv}>
          <FileSpreadsheet size={13} /> CSV
        </Button>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
        >
          Sayfaya git <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
}
