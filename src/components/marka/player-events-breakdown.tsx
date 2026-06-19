"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import {
  aggregatePlayerEvents,
  sumPlayerEventBuckets,
  type PlayerEventBucket,
} from "@/lib/player-events-aggregate";
import type { BrandPlayerEvent } from "@/types/brand-igaming";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarRange } from "lucide-react";

type Props = {
  events: BrandPlayerEvent[];
  mode: "daily" | "weekly";
  monthTitle: string;
  loading?: boolean;
};

export function PlayerEventsBreakdown({ events, mode, monthTitle, loading }: Props) {
  const buckets = useMemo(
    () => aggregatePlayerEvents(events, mode),
    [events, mode]
  );
  const totals = useMemo(() => sumPlayerEventBuckets(buckets), [buckets]);

  const chartData = buckets.map((b) => ({
    label: b.label,
    Kayıt: b.registrations,
    FTD: b.ftd,
  }));

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground text-center">
          Oyuncu olayları yükleniyor…
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange size={16} />
            {mode === "daily" ? "Günlük" : "Haftalık"} olay özeti
          </CardTitle>
          <CardDescription>{monthTitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bu ay için oyuncu olayı kaydı yok. Veri girildiğinde günlük/haftalık kırılım burada görünür.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange size={16} />
              {mode === "daily" ? "Günlük" : "Haftalık"} olay özeti
            </CardTitle>
            <CardDescription>
              Player-events API — {monthTitle} · {events.length} ham satır
            </CardDescription>
          </div>
          <Badge variant="secondary">{buckets.length} dönem</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Kayıt" value={fmtBrandCount(totals.registrations)} />
          <MiniStat label="FTD" value={fmtBrandCount(totals.ftd)} />
          <MiniStat label="Yatırım" value={fmtBrandMoney(totals.depositAmount, "USD")} />
          <MiniStat label="Çekim" value={fmtBrandMoney(totals.withdrawalAmount, "USD")} />
        </div>

        {chartData.length > 0 && (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(v: number, name: string) => [fmtBrandCount(v), name]}
                />
                <Bar dataKey="Kayıt" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="FTD" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <BucketTable buckets={buckets} />
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/25 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BucketTable({ buckets }: { buckets: PlayerEventBucket[] }) {
  const shown = buckets.length > 14 ? buckets.slice(-14) : buckets;
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Dönem</th>
            <th className="px-3 py-2 font-medium text-right">Kayıt</th>
            <th className="px-3 py-2 font-medium text-right">FTD</th>
            <th className="px-3 py-2 font-medium text-right">Yatırım</th>
            <th className="px-3 py-2 font-medium text-right">Çekim</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((b) => (
            <tr key={b.key} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2">{b.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{b.registrations || "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{b.ftd || "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {b.depositAmount > 0 ? fmtBrandMoney(b.depositAmount, "USD") : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {b.withdrawalAmount > 0 ? fmtBrandMoney(b.withdrawalAmount, "USD") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {buckets.length > 14 && (
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          Son 14 dönem gösteriliyor — tam liste için Raporlar sayfasından CSV indirin.
        </p>
      )}
    </div>
  );
}
