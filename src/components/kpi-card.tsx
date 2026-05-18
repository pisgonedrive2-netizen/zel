type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneColors: Record<Tone, { val: string; dot: string; bg: string; border: string }> = {
  default: { val: "#fafafa",  dot: "#6366f1", bg: "rgba(99,102,241,0.04)",  border: "rgba(99,102,241,0.1)" },
  success: { val: "#4ade80",  dot: "#22c55e", bg: "rgba(34,197,94,0.04)",   border: "rgba(34,197,94,0.1)" },
  warning: { val: "#fbbf24",  dot: "#f59e0b", bg: "rgba(245,158,11,0.04)",  border: "rgba(245,158,11,0.1)" },
  danger:  { val: "#f87171",  dot: "#ef4444", bg: "rgba(239,68,68,0.04)",   border: "rgba(239,68,68,0.1)" },
  info:    { val: "#60a5fa",  dot: "#3b82f6", bg: "rgba(59,130,246,0.04)",  border: "rgba(59,130,246,0.1)" },
};

export default function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  trend?: { delta: string; positive: boolean };
}) {
  const c = toneColors[tone];
  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col gap-3"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: "#52525b" }}>
          {label}
        </p>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      </div>

      <p
        className="text-[28px] font-bold tabular-nums leading-none"
        style={{ color: c.val, letterSpacing: "-0.03em" }}
      >
        {value}
      </p>

      <div className="flex items-center justify-between">
        {sub && (
          <p className="text-[11px]" style={{ color: "#52525b" }}>{sub}</p>
        )}
        {trend && (
          <span
            className="text-[11px] font-medium"
            style={{ color: trend.positive ? "#4ade80" : "#f87171" }}
          >
            {trend.positive ? "↑" : "↓"} {trend.delta}
          </span>
        )}
      </div>
    </div>
  );
}
