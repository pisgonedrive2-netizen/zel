"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type SmoothChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Area fill under line (0–1) */
  fillOpacity?: number;
};

export type SmoothChartPeriod = {
  key: string;
  label: string;
  /** Son N nokta (tam seri için undefined) */
  takeLast?: number;
};

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString("tr-TR");
}

export function ModernSmoothLineChart({
  labels,
  series,
  periods,
  defaultPeriodKey,
  height = 360,
  formatValue = fmtCompact,
  highlightLabelIndex,
  className = "",
  /** Çizgi altına alan dolgusu (gradient) — varsayılan true */
  showArea = true,
}: {
  labels: string[];
  series: SmoothChartSeries[];
  periods?: SmoothChartPeriod[];
  defaultPeriodKey?: string;
  height?: number;
  formatValue?: (n: number) => string;
  /** Seçili ay / vurgu için x ekseni indeksi */
  highlightLabelIndex?: number;
  className?: string;
  showArea?: boolean;
}) {
  const [periodKey, setPeriodKey] = useState(
    defaultPeriodKey ?? periods?.[0]?.key ?? "all"
  );

  const period = periods?.find((p) => p.key === periodKey);
  const sliceCount = period?.takeLast ?? labels.length;

  const slicedLabels = useMemo(() => labels.slice(-sliceCount), [labels, sliceCount]);

  const slicedSeries = useMemo(
    () => series.map((s) => ({ ...s, values: s.values.slice(-sliceCount) })),
    [series, sliceCount]
  );

  // Recharts data format: [{ label: "Oca", brand1: 100, brand2: 200 }, ...]
  const chartData = useMemo(() => {
    return slicedLabels.map((label, i) => {
      const row: Record<string, string | number> = { label };
      for (const s of slicedSeries) {
        row[s.key] = s.values[i] ?? 0;
      }
      return row;
    });
  }, [slicedLabels, slicedSeries]);

  // shadcn ChartConfig — maps series keys → labels + colors
  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    for (const s of slicedSeries) {
      cfg[s.key] = { label: s.label, color: s.color };
    }
    return cfg;
  }, [slicedSeries]);

  // Tüm seri değerlerinden agrege metrikler
  const primaryValues = slicedSeries[0]?.values ?? [];

  const metrics = useMemo(() => {
    // Tüm serilerin toplamından genel zirve / ortalama hesapla
    const allVals: number[] = [];
    for (const s of slicedSeries) {
      for (const v of s.values) allVals.push(v);
    }
    const peak = allVals.length > 0 ? Math.max(...allVals) : 0;
    const average =
      allVals.length > 0
        ? Math.round(allVals.reduce((a, b) => a + b, 0) / allVals.length)
        : 0;
    const first = primaryValues[0] ?? 0;
    const last = primaryValues[primaryValues.length - 1] ?? 0;
    const growth =
      first > 0
        ? `${last >= first ? "+" : ""}${(((last - first) / first) * 100).toFixed(0)}%`
        : null;
    return { peak, average, growth };
  }, [primaryValues, slicedSeries]);

  const hasAnyData = slicedSeries.some((s) => s.values.some((v) => v > 0));

  // Y ekseni için akıllı domain — minimum başlangıç 0, üst sınır biraz yastıklı
  const yDomain = useMemo<[number, number]>(() => {
    let max = 0;
    for (const s of slicedSeries) {
      for (const v of s.values) if (v > max) max = v;
    }
    if (max === 0) return [0, 10];
    // En yakın "güzel" sayıya yuvarla (1.1× ölçek + 10/100/1k vs)
    const padded = max * 1.15;
    const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
    const niceMax = Math.ceil(padded / magnitude) * magnitude;
    return [0, niceMax];
  }, [slicedSeries]);

  // X ekseni tick interval — çok nokta varsa atla
  const xTickInterval = useMemo(() => {
    const n = slicedLabels.length;
    if (n <= 10) return 0;
    if (n <= 20) return 1;
    if (n <= 40) return Math.ceil(n / 10);
    return Math.ceil(n / 12);
  }, [slicedLabels.length]);

  // Y ekseni tick formatı için gerekli genişlik (en uzun tick string'ine göre)
  const yAxisWidth = useMemo(() => {
    const sample = formatValue(yDomain[1]);
    return Math.max(48, sample.length * 8 + 12);
  }, [yDomain, formatValue]);

  const highlightLabel =
    highlightLabelIndex != null
      ? slicedLabels[highlightLabelIndex - (labels.length - sliceCount)]
      : undefined;

  if (!slicedLabels.length || !slicedSeries.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Grafik için yeterli veri yok.
      </p>
    );
  }

  return (
    <div className={`relative flex flex-col gap-3 ${className}`}>
      {/* Legend + period selector header */}
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        {/* Series legend */}
        <div className="flex flex-wrap gap-3.5">
          {slicedSeries.map((s) => {
            const last = s.values[s.values.length - 1] ?? 0;
            return (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                  style={{ backgroundColor: s.color, boxShadow: `0 0 0 1px ${s.color}33` }}
                />
                <span className="text-muted-foreground font-medium">{s.label}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatValue(last)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Period buttons */}
        {periods && periods.length > 1 && (
          <div className="flex gap-1">
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
                  periodKey === p.key
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* No-data overlay */}
      {!hasAnyData && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none mt-8">
          <p className="text-xs text-muted-foreground bg-card/85 backdrop-blur rounded-lg px-3 py-1.5 border border-border/50">
            Henüz izlenme verisi yok — snapshot ekleyince veya “Tüm linkleri kontrol et” çalıştırınca grafik dolar
          </p>
        </div>
      )}

      {/* Chart */}
      <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
        <ComposedChart data={chartData} margin={{ top: 12, right: 20, bottom: 6, left: 0 }}>
          <defs>
            {slicedSeries.map((s) => (
              <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                <stop offset="60%" stopColor={s.color} stopOpacity={0.08} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 4"
            stroke="hsl(var(--border))"
            strokeOpacity={0.55}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            interval={xTickInterval}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            minTickGap={6}
          />
          <YAxis
            domain={yDomain}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={formatValue}
            width={yAxisWidth}
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3", strokeOpacity: 0.5 }}
            content={
              <ChartTooltipContent
                labelKey="label"
                indicator="line"
                labelFormatter={(v) => String(v)}
                formatter={(value, name, item, index) => {
                  const s = slicedSeries.find((x) => x.key === name);
                  return [
                    <span key={`tip-val-${index}`} className="font-mono font-semibold tabular-nums">
                      {formatValue(Number(value))}
                    </span>,
                    s?.label ?? String(name),
                  ];
                }}
              />
            }
          />
          {highlightLabel && (
            <ReferenceLine
              x={highlightLabel}
              stroke="hsl(var(--primary))"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
            />
          )}
          {/* Önce alan dolguları (gradient), sonra çizgiler — çizgiler üstte kalsın */}
          {showArea &&
            slicedSeries.map((s) => (
              <Area
                key={`area-${s.key}`}
                type="monotone"
                dataKey={s.key}
                stroke="none"
                fill={`url(#grad-${s.key})`}
                fillOpacity={1}
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
              />
            ))}
          {slicedSeries.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={s.color}
              strokeWidth={2.25}
              dot={slicedLabels.length <= 12 ? { r: 3, strokeWidth: 0, fill: s.color } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))", fill: s.color }}
              isAnimationActive={true}
              animationDuration={500}
            />
          ))}
        </ComposedChart>
      </ChartContainer>

      {/* Metrics footer */}
      <div className="flex flex-wrap gap-2 px-1 pb-1">
        {[
          { label: "Zirve", value: formatValue(metrics.peak), color: "border-blue-500/60" },
          { label: "Ortalama", value: formatValue(metrics.average), color: "border-orange-500/60" },
          ...(metrics.growth
            ? [{ label: "Değişim (ilk seri)", value: metrics.growth, color: "border-emerald-500/60" }]
            : []),
        ].map((m) => (
          <div
            key={m.label}
            className={`rounded-lg border-2 ${m.color} bg-card/50 px-3 py-2 min-w-[96px] shadow-sm`}
          >
            <p className="text-base font-bold tabular-nums text-foreground">{m.value}</p>
            <p className="text-[11px] text-muted-foreground font-medium">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
