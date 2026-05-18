"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BarSeries {
  key: string;
  label: string;
  color: string;
  stackId?: string;
}

interface BreakdownBarProps {
  data: Record<string, string | number>[];
  series: BarSeries[];
  categoryKey?: string;
  height?: number;
  horizontal?: boolean;
  yTickFormatter?: (v: number) => string;
}

const defaultFmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

export default function BreakdownBar({
  data,
  series,
  categoryKey = "ay",
  height = 260,
  horizontal = false,
  yTickFormatter = defaultFmt,
}: BreakdownBarProps) {
  const layout = horizontal ? "vertical" : "horizontal";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        barSize={horizontal ? 14 : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              tickFormatter={yTickFormatter}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey={categoryKey}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={categoryKey}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#1e293b" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={yTickFormatter}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
          </>
        )}
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
          labelStyle={{ color: "#94a3b8", fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
          formatter={(v: number) => [`$${v.toLocaleString("en-US")}`, ""]}
        />
        {series.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>}
          />
        )}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={s.stackId}
            radius={s.stackId ? undefined : [3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
