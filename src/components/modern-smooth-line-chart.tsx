"use client";

import { useEffect, useMemo, useState } from "react";

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
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

function generateSmoothPath(
  values: number[],
  maxValue: number,
  width: number,
  height: number,
  padding: number,
  isArea: boolean
): string {
  if (values.length < 2 || maxValue <= 0) return "";

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = values.map((value, index) => ({
    x: padding + (index / (values.length - 1)) * chartWidth,
    y: padding + (1 - value / maxValue) * chartHeight,
  }));

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const cp1x = prev.x + (curr.x - prev.x) * 0.5;
    const cp1y = prev.y;
    const cp2x = curr.x - (next ? (next.x - curr.x) * 0.3 : 0);
    const cp2y = curr.y;
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
  }

  if (isArea) {
    path += ` L ${points[points.length - 1].x},${height - padding} L ${padding},${height - padding} Z`;
  }

  return path;
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
}) {
  const [periodKey, setPeriodKey] = useState(
    defaultPeriodKey ?? periods?.[0]?.key ?? "all"
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  const period = periods?.find((p) => p.key === periodKey);
  const sliceCount = period?.takeLast ?? labels.length;

  const slicedLabels = useMemo(
    () => labels.slice(-sliceCount),
    [labels, sliceCount]
  );

  const slicedSeries = useMemo(
    () =>
      series.map((s) => ({
        ...s,
        values: s.values.slice(-sliceCount),
      })),
    [series, sliceCount]
  );

  const maxValue = useMemo(() => {
    const all = slicedSeries.flatMap((s) => s.values);
    const m = Math.max(...all, 1);
    return m * 1.12;
  }, [slicedSeries]);

  const primary = slicedSeries[0];
  const primaryValues = primary?.values ?? [];

  const metrics = useMemo(() => {
    if (!primaryValues.length) {
      return { peak: 0, average: 0, growth: null as string | null };
    }
    const peak = Math.max(...primaryValues);
    const average = Math.round(
      primaryValues.reduce((a, b) => a + b, 0) / primaryValues.length
    );
    const first = primaryValues[0] ?? 0;
    const last = primaryValues[primaryValues.length - 1] ?? 0;
    const growth =
      first > 0 ? `${last >= first ? "+" : ""}${(((last - first) / first) * 100).toFixed(0)}%` : null;
    return { peak, average, growth };
  }, [primaryValues]);

  const svgW = 800;
  const svgH = height;
  const padding = 56;
  const chartH = svgH - padding - 28;

  const highlightIdx =
    highlightLabelIndex != null && highlightLabelIndex >= labels.length - sliceCount
      ? highlightLabelIndex - (labels.length - sliceCount)
      : highlightLabelIndex != null && labels.length === sliceCount
        ? highlightLabelIndex
        : null;

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [periodKey, sliceCount]);

  if (!slicedLabels.length || !slicedSeries.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">Grafik için yeterli veri yok.</p>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-4">
        {slicedSeries.map((s) => {
          const last = s.values[s.values.length - 1] ?? 0;
          return (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full border-2 shrink-0"
                style={{ borderColor: s.color, backgroundColor: `${s.color}22` }}
              />
              <span className="text-muted-foreground font-medium">{s.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{formatValue(last)}</span>
            </div>
          );
        })}
      </div>

      {periods && periods.length > 1 && (
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodKey(p.key)}
              className={`text-left rounded-lg px-3 py-2 min-w-[120px] text-xs transition-all shadow-sm border ${
                periodKey === p.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-accent/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="pt-14 pb-4 px-2">
        <svg
          className="w-full"
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ height }}
          role="img"
          aria-label="İzlenme trend grafiği"
        >
          <defs>
            <pattern id="smooth-grid" width="40" height="30" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 30"
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.06}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={svgW} height={svgH} fill="url(#smooth-grid)" className="text-foreground" />

          {[0.25, 0.5, 0.75].map((pct) => (
            <line
              key={pct}
              x1={padding}
              x2={svgW - padding}
              y1={padding + chartH * pct}
              y2={padding + chartH * pct}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
          ))}

          {slicedSeries
            .slice()
            .reverse()
            .map((s) => (
              <path
                key={`area-${s.key}`}
                d={generateSmoothPath(s.values, maxValue, svgW, chartH + padding, padding, true)}
                fill={s.color}
                fillOpacity={s.fillOpacity ?? 0.1}
                className={`transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
              />
            ))}

          {slicedSeries.map((s, si) => (
            <path
              key={`line-${s.key}`}
              d={generateSmoothPath(s.values, maxValue, svgW, chartH + padding, padding, false)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              className={`transition-all duration-1000 ${visible ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDelay: `${200 + si * 150}ms` }}
            />
          ))}

          {slicedLabels.map((label, index) => {
            const chartWidth = svgW - padding * 2;
            const x = padding + (index / (slicedLabels.length - 1)) * chartWidth;
            const isHighlight = highlightIdx === index;
            const isHover = hoveredIndex === index;

            return (
              <g key={`pt-${label}-${index}`}>
                {(isHighlight || isHover) && (
                  <line
                    x1={x}
                    x2={x}
                    y1={padding}
                    y2={padding + chartH}
                    stroke="#8b5cf6"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                )}
                {slicedSeries.map((s) => {
                  const y =
                    padding +
                    (1 - (s.values[index] ?? 0) / maxValue) * chartH;
                  return (
                    <circle
                      key={`${s.key}-${index}`}
                      cx={x}
                      cy={y}
                      r={isHover || isHighlight ? 5 : 3}
                      fill={s.color}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  );
                })}
                <text
                  x={x}
                  y={svgH - 10}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.45}
                  fontSize="11"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {hoveredIndex !== null && (
            <g>
              <rect
                x={
                  padding +
                  (hoveredIndex / (slicedLabels.length - 1)) * (svgW - padding * 2) -
                  58
                }
                y={12}
                width={116}
                height={24 + slicedSeries.length * 16}
                rx={6}
                className="fill-popover stroke-border"
                strokeWidth={1}
              />
              <text
                x={
                  padding +
                  (hoveredIndex / (slicedLabels.length - 1)) * (svgW - padding * 2)
                }
                y={28}
                textAnchor="middle"
                className="fill-foreground"
                fontSize="11"
                fontWeight={600}
              >
                {slicedLabels[hoveredIndex]}
              </text>
              {slicedSeries.map((s, i) => (
                <text
                  key={s.key}
                  x={
                    padding +
                    (hoveredIndex / (slicedLabels.length - 1)) * (svgW - padding * 2)
                  }
                  y={44 + i * 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill={s.color}
                >
                  {s.label}: {formatValue(s.values[hoveredIndex] ?? 0)}
                </text>
              ))}
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3 px-2 pb-1">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Zirve", value: formatValue(metrics.peak), border: "border-blue-500" },
            { label: "Ortalama", value: formatValue(metrics.average), border: "border-orange-500" },
            ...(metrics.growth
              ? [{ label: "Değişim", value: metrics.growth, border: "border-emerald-500" }]
              : []),
          ].map((m) => (
            <div
              key={m.label}
              className={`rounded-lg border-2 ${m.border} bg-card px-3 py-2 min-w-[100px] shadow-sm`}
            >
              <p className="text-lg font-bold tabular-nums text-foreground">{m.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
