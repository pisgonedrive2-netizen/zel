"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { TrendingUp, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore, type BrandMonthlyStats } from "@/store/store";
import { fmtBrandMoney, fmtBrandCount } from "@/lib/brand-monthly-stats";
import { shiftCalendarMonthYm } from "@/lib/data";

function monthLabelShort(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return d.toLocaleDateString("tr-TR", { month: "short" });
}

interface TrendRow {
  month: string;
  monthLabel: string;
  kayit: number;
  yatirimYapan: number;
  ftd: number;
  toplamYatirim: number;
  toplamCekim: number;
  netYatirim: number;
}

export function BrandMonthlyTrend({
  brandId,
  monthYm,
  months = 6,
}: {
  brandId: string;
  monthYm: string;
  months?: number;
}) {
  const { brandMonthlyStats } = useStore();

  const data: TrendRow[] = useMemo(() => {
    const out: TrendRow[] = [];
    const cursor = monthYm;
    // Sondan başa: son ay seçili olan, geriye doğru `months-1` ay
    for (let i = months - 1; i >= 0; i--) {
      const m = shiftCalendarMonthYm(cursor, -i);
      const row = brandMonthlyStats.find((s) => s.brandId === brandId && s.month === m);
      out.push({
        month: m,
        monthLabel: monthLabelShort(m),
        kayit: row?.newRegistrations ?? 0,
        yatirimYapan: row?.depositingMembers ?? 0,
        ftd: row?.firstTimeDepositors ?? 0,
        toplamYatirim: row ? Number(row.depositAmount) : 0,
        toplamCekim: row ? Number(row.withdrawalAmount) : 0,
        netYatirim: row ? Number(row.depositAmount) - Number(row.withdrawalAmount) : 0,
      });
    }
    return out;
  }, [brandMonthlyStats, brandId, monthYm, months]);

  const currency: BrandMonthlyStats["currency"] = useMemo(() => {
    const row = brandMonthlyStats.find(
      (s) => s.brandId === brandId && s.month === monthYm
    );
    return row?.currency ?? "TRY";
  }, [brandMonthlyStats, brandId, monthYm]);

  const hasAny = data.some(
    (d) => d.kayit > 0 || d.yatirimYapan > 0 || d.toplamYatirim > 0
  );

  if (!hasAny) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp size={16} className="text-violet-700 dark:text-violet-300" />
            Trend (son {months} ay)
          </CardTitle>
          <CardDescription>
            Henüz yeterli ay bazlı veri yok. Birkaç ay daha veri girildikçe grafikler dolacak.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currencySym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₺";

  const totals = data.reduce(
    (acc, row) => ({
      kayit: acc.kayit + row.kayit,
      yatirimYapan: acc.yatirimYapan + row.yatirimYapan,
      ftd: acc.ftd + row.ftd,
      netYatirim: acc.netYatirim + row.netYatirim,
    }),
    { kayit: 0, yatirimYapan: 0, ftd: 0, netYatirim: 0 }
  );

  return (
    <Card className="border-violet-200/50 dark:border-violet-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp size={16} className="text-violet-700 dark:text-violet-300" />
          Trend (son {months} ay)
        </CardTitle>
        <CardDescription>
          Kayıt, yatırım yapan üye ve net yatırım — son {months} aylık değişim
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <TrendTile
            label="Toplam kayıt"
            value={fmtBrandCount(totals.kayit)}
            icon={Users}
            accent="text-blue-700 dark:text-blue-300"
          />
          <TrendTile
            label="Yatırım yapan"
            value={fmtBrandCount(totals.yatirimYapan)}
            icon={Users}
            accent="text-violet-700 dark:text-violet-300"
          />
          <TrendTile
            label="Toplam FTD"
            value={fmtBrandCount(totals.ftd)}
            icon={TrendingUp}
            accent="text-emerald-700 dark:text-emerald-300"
          />
          <TrendTile
            label="Net yatırım"
            value={fmtBrandMoney(totals.netYatirim, currency)}
            icon={Wallet}
            accent={
              totals.netYatirim >= 0
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card px-2 py-2">
            <p className="text-[11px] font-medium text-muted-foreground mb-1 px-2">
              Kayıt vs Yatırım yapan üye
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="brand-kayit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="brand-yatirim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                <XAxis dataKey="monthLabel" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                <RTooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    fmtBrandCount(value),
                    name === "kayit" ? "Kayıt" : name === "yatirimYapan" ? "Yatırım yapan" : name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="kayit"
                  name="Kayıt"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#brand-kayit)"
                />
                <Area
                  type="monotone"
                  dataKey="yatirimYapan"
                  name="Yatırım yapan"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#brand-yatirim)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border bg-card px-2 py-2">
            <p className="text-[11px] font-medium text-muted-foreground mb-1 px-2">
              Yatırım vs Çekim ({currencySym})
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                <XAxis dataKey="monthLabel" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                        ? `${(v / 1_000).toFixed(0)}k`
                        : String(v)
                  }
                />
                <RTooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    fmtBrandMoney(value, currency),
                    name === "toplamYatirim"
                      ? "Yatırım"
                      : name === "toplamCekim"
                        ? "Çekim"
                        : name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="toplamYatirim" name="Yatırım" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="toplamCekim" name="Çekim" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-border/80 bg-muted/25 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Icon size={10} className={accent} />
        {label}
      </p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}
