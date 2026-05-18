"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PIE_COLORS } from "@/lib/data";

interface DonutPieProps {
  data: { name: string; value: number }[];
  height?: number;
  donut?: boolean;
  colors?: string[];
}

export default function DonutPie({
  data,
  height = 280,
  donut = true,
  colors = PIE_COLORS,
}: DonutPieProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={donut ? "55%" : 0}
          outerRadius="75%"
          paddingAngle={donut ? 3 : 0}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
          itemStyle={{ fontSize: 12 }}
          formatter={(v: number) => [`$${v.toLocaleString("en-US")}`, ""]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
