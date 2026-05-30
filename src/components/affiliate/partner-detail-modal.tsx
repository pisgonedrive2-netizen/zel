"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PlusCircle, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import type { AffiliateDailyStat, AffiliatePartner } from "@/store/store";
import {
  commissionLabel,
  partnerStatusBadgeClass,
  partnerStatusLabel,
  partnerTypeLabel,
} from "./labels";

export function PartnerDetailModal({
  open,
  onClose,
  partner,
  stats,
  monthTitle,
  readOnly,
  onAddPayout,
  onAddStat,
}: {
  open: boolean;
  onClose: () => void;
  partner: AffiliatePartner | null;
  stats: AffiliateDailyStat[];
  monthTitle: string;
  readOnly: boolean;
  onAddPayout: () => void;
  onAddStat: () => void;
}) {
  const currency = partner?.currency ?? "USD";

  const daily = useMemo(() => {
    return [...stats]
      .sort((a, b) => a.statDate.localeCompare(b.statDate))
      .map((s) => ({
        day: s.statDate.slice(8, 10),
        clicks: s.clicks ?? 0,
        registrations: s.registrations ?? 0,
        ftd: s.ftdCount ?? 0,
        deposit: s.depositAmount ?? 0,
        withdrawal: s.withdrawalAmount ?? 0,
      }));
  }, [stats]);

  const totals = useMemo(
    () =>
      stats.reduce(
        (acc, s) => ({
          clicks: acc.clicks + (s.clicks ?? 0),
          registrations: acc.registrations + (s.registrations ?? 0),
          ftd: acc.ftd + (s.ftdCount ?? 0),
          ftdAmount: acc.ftdAmount + (s.ftdAmount ?? 0),
          deposit: acc.deposit + (s.depositAmount ?? 0),
          withdrawal: acc.withdrawal + (s.withdrawalAmount ?? 0),
          commission: acc.commission + (s.commissionDue ?? 0),
        }),
        {
          clicks: 0,
          registrations: 0,
          ftd: 0,
          ftdAmount: 0,
          deposit: 0,
          withdrawal: 0,
          commission: 0,
        }
      ),
    [stats]
  );

  const hasData = daily.length > 0;

  return (
    <Modal open={open} onClose={onClose} title={partner?.name ?? "Partner"} size="xl">
      {partner && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge
              variant="secondary"
              className={partnerStatusBadgeClass(partner.status)}
            >
              {partnerStatusLabel(partner.status)}
            </Badge>
            <Badge variant="outline" className="font-normal">
              {partnerTypeLabel(partner.partnerType)}
            </Badge>
            <span className="text-muted-foreground">
              {commissionLabel(partner.commissionModel)}
              {partner.commissionModel === "cpa" && partner.cpaAmount > 0
                ? ` · ${fmtBrandMoney(partner.cpaAmount, partner.currency)}`
                : ""}
              {partner.commissionModel === "revshare" && partner.revsharePct > 0
                ? ` · %${partner.revsharePct}`
                : ""}
            </span>
            {partner.externalRef && (
              <span className="text-xs text-muted-foreground">
                Ref: {partner.externalRef}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Tıklama" value={fmtCompactViews(totals.clicks)} />
            <Tile label="Kayıt" value={fmtBrandCount(totals.registrations)} />
            <Tile
              label="FTD"
              value={fmtBrandCount(totals.ftd)}
              sub={totals.ftdAmount > 0 ? fmtBrandMoney(totals.ftdAmount, currency) : undefined}
            />
            <Tile label="Komisyon" value={fmtBrandMoney(totals.commission, currency)} />
          </div>

          <p className="text-xs text-muted-foreground">{monthTitle} · günlük dağılım</p>

          {hasData ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card px-2 py-2">
                <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground">
                  Tıklama · Kayıt · FTD
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={daily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aff-clicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="aff-reg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="aff-ftd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                    <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 10 }} />
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
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      name="Tıklama"
                      stroke="#ec4899"
                      strokeWidth={2}
                      fill="url(#aff-clicks)"
                    />
                    <Area
                      type="monotone"
                      dataKey="registrations"
                      name="Kayıt"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#aff-reg)"
                    />
                    <Area
                      type="monotone"
                      dataKey="ftd"
                      name="FTD"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#aff-ftd)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border border-border bg-card px-2 py-2">
                <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground">
                  Yatırım · Çekim ({currency})
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={daily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                    <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 10 }} />
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
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="deposit" name="Yatırım" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="withdrawal" name="Çekim" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
              <TrendingUp size={26} className="text-muted-foreground" />
              <div className="text-sm font-medium">Bu ay için veri yok</div>
              <div className="max-w-sm text-xs text-muted-foreground">
                Günlük istatistik ekleyerek ya da CSV içe aktararak bu partnerin
                performansını takip edebilirsiniz.
              </div>
            </div>
          )}

          {partner.notes && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[13px] text-muted-foreground">
              {partner.notes}
            </div>
          )}

          {!readOnly && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddStat}>
                <PlusCircle size={14} /> Günlük istatistik ekle
              </Button>
              <Button size="sm" className="gap-1.5" onClick={onAddPayout}>
                <Wallet size={14} /> Bu partnere ödeme ekle
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
