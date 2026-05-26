"use client";

import { useMemo } from "react";
import { ModernSmoothLineChart } from "@/components/modern-smooth-line-chart";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Brand, BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";
import {
  buildBrandViewershipSeries,
  monthOverMonthChange,
  platformBreakdownForMonth,
  brandDataSpanLabel,
  collectBrandDataMonths,
} from "@/lib/brand-viewership-series";
import { monthLabelTr } from "@/hooks/use-marka-portal";
import { ViewDotCard } from "@/components/view-dot-card";

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899"];

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

export function MarkaViewershipCharts({
  brand,
  brandLinks,
  linkSnapshots,
  brandViewership,
  monthYm,
  todayYm,
}: {
  brand: Brand;
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  monthYm: string;
  todayYm: string;
}) {
  const links = useMemo(
    () => brandLinks.filter((l) => l.brandId === brand.id),
    [brandLinks, brand.id]
  );

  const series = useMemo(
    () =>
      buildBrandViewershipSeries({
        brandId: brand.id,
        brandLinks,
        linkSnapshots,
        brandViewership,
        endMonthYm: monthYm,
        todayYm,
        maxMonths: 24,
      }),
    [brand.id, brandLinks, linkSnapshots, brandViewership, monthYm, todayYm]
  );

  const mom = useMemo(() => monthOverMonthChange(series, monthYm), [series, monthYm]);

  const platformSlices = useMemo(
    () =>
      platformBreakdownForMonth({
        brandLinks: links,
        linkSnapshots,
        monthYm,
        todayYm,
      }),
    [links, linkSnapshots, monthYm, todayYm]
  );

  const dataMonths = useMemo(
    () =>
      collectBrandDataMonths({
        brandId: brand.id,
        brandLinks,
        linkSnapshots,
        brandViewership,
      }),
    [brand.id, brandLinks, linkSnapshots, brandViewership]
  );

  const hasChartData = series.some((r) => r.totalViews > 0);
  const selectedRow = series.find((r) => r.month === monthYm);
  const highlightIndex = series.findIndex((r) => r.month === monthYm);

  const chartLabels = series.map((r) => r.monthLabel);
  const smoothSeries = [
    {
      key: "total",
      label: "Toplam",
      color: "#6366f1",
      values: series.map((r) => r.totalViews),
      fillOpacity: 0.12,
    },
    {
      key: "links",
      label: "Linkler",
      color: "#3b82f6",
      values: series.map((r) => r.linkViews),
      fillOpacity: 0.08,
    },
    {
      key: "streamer",
      label: "Yayıncı",
      color: "#10b981",
      values: series.map((r) => r.streamerViews),
      fillOpacity: 0.06,
    },
  ];

  if (!hasChartData) {
    return (
      <Card className="border-dashed border-violet-300/50 dark:border-violet-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-600 dark:text-violet-300" />
            İzlenme trendi
          </CardTitle>
          <CardDescription>
            Henüz aylık izlenme verisi yok. Link snapshot veya yayıncı kayıtları eklendikçe grafikler
            dolacak.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <ViewDotCard
          target={selectedRow?.totalViews ?? 0}
          metricCaption="Views"
          label={`${monthLabelTr(monthYm)} · Toplam`}
          sub="Link + yayıncı"
          accent="violet"
        />
        <ViewDotCard
          target={selectedRow?.linkViews ?? 0}
          metricCaption="Views"
          label="Linkler"
          accent="blue"
        />
        <ViewDotCard
          target={selectedRow?.streamerViews ?? 0}
          metricCaption="Views"
          label="Yayıncı"
          accent="emerald"
        />
        <ViewDotCard
          displayText={
            mom.pct == null ? "—" : `${mom.pct >= 0 ? "+" : ""}${mom.pct.toFixed(0)}%`
          }
          metricCaption="Değişim"
          label="Önceki aya göre"
          sub={
            mom.prevMonth
              ? `${monthLabelTr(mom.prevMonth)}: ${fmtViews(mom.previous)}`
              : "Karşılaştırma yok"
          }
          accent={mom.pct != null && mom.pct >= 0 ? "emerald" : "amber"}
        />
        <ViewDotCard
          displayText={brandDataSpanLabel(dataMonths)}
          metricCaption={null}
          label="Veri aralığı"
          sub={`${dataMonths.length} ay kayıtlı`}
          accent="violet"
        />
      </div>

      <Card className="overflow-hidden border-violet-200/60 dark:border-violet-500/35 bg-gradient-to-br from-violet-50/40 via-card to-blue-50/30 dark:from-violet-950/20 dark:via-card dark:to-blue-950/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-700 dark:text-violet-300" />
            Aylık izlenme trendi
          </CardTitle>
          <CardDescription>
            Başlangıçtan {monthLabelTr(monthYm)} ayına kadar — link snapshot + yayıncı kayıtları
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 bg-card/90 shadow-sm overflow-hidden">
            <ModernSmoothLineChart
              labels={chartLabels}
              series={smoothSeries}
              formatValue={fmtViews}
              highlightLabelIndex={highlightIndex >= 0 ? highlightIndex : undefined}
              height={340}
              periods={[
                { key: "24", label: "1 yıl", takeLast: 24 },
                { key: "12", label: "12 ay", takeLast: 12 },
                { key: "6", label: "6 ay", takeLast: 6 },
                { key: "3", label: "3 ay", takeLast: 3 },
                { key: "1", label: "1 ay", takeLast: 1 },
              ]}
              defaultPeriodKey="1"
            />
          </div>
        </CardContent>
      </Card>

      {platformSlices.length > 0 && (
        <Card className="border-violet-200/40 dark:border-violet-500/25">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{monthLabelTr(monthYm)} · Platform izlenme haritası</CardTitle>
            <CardDescription>Seçili ayda link bazlı Views</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {platformSlices.map((p, i) => (
                <ViewDotCard
                  key={p.platform}
                  target={p.views}
                  metricCaption="Views"
                  label={p.platform}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                  size="sm"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
