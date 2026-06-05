"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  PlusCircle,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { useStore } from "@/store/store";
import type {
  AffiliateDailyStat,
  AffiliatePartner,
  AffiliatePayout,
} from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { fmtDateOnly } from "@/lib/fmt-date";
import { ApiError, isPoolNotReadyError } from "@/lib/streamer-pool-api";
import {
  fetchAffiliatePartners,
  fetchAffiliatePayouts,
  fetchAffiliateStats,
  updateAffiliatePayout,
} from "@/lib/affiliate-api";
import { PartnerFormModal } from "@/components/affiliate/partner-form-modal";
import { CsvImportModal } from "@/components/affiliate/csv-import-modal";
import { DailyStatModal } from "@/components/affiliate/daily-stat-modal";
import { PayoutModal } from "@/components/affiliate/payout-modal";
import { PartnerDetailModal } from "@/components/affiliate/partner-detail-modal";
import { AffiliateDailyTrend } from "@/components/marka/affiliate-daily-trend";
import { computeAffiliateMonthInsights } from "@/lib/marka-brand-insights";
import {
  computePartnerQualityScore,
  fetchAffiliateTiers,
  fetchBrandCampaigns,
} from "@/lib/marka-igaming-api";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  DEFAULT_AFFILIATE_TIERS,
  type AffiliateTier,
  type BrandCampaign,
} from "@/types/brand-igaming";
import {
  commissionLabel,
  payoutStatusBadgeClass,
  payoutStatusLabel,
  partnerStatusBadgeClass,
  partnerStatusLabel,
  partnerTypeLabel,
  PARTNER_TYPE_OPTIONS,
} from "@/components/affiliate/labels";

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((x) => [x.id, x]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MarkaAffiliatePage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle } = portal;
  const readOnly = useIsReadOnly();
  const { affiliatePartners, affiliateDailyStats, affiliatePayouts } = useStore();

  const [showAll, setShowAll] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [partnerModal, setPartnerModal] = useState<{
    open: boolean;
    partner: AffiliatePartner | null;
  }>({ open: false, partner: null });
  const [csvOpen, setCsvOpen] = useState(false);
  const [statModal, setStatModal] = useState<{ open: boolean; partnerId?: string }>({
    open: false,
  });
  const [payoutModal, setPayoutModal] = useState<{
    open: boolean;
    partnerId?: string;
    payout: AffiliatePayout | null;
  }>({ open: false, payout: null });
  const [detailPartnerId, setDetailPartnerId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<AffiliateTier[]>([]);
  const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);

  const partners = useMemo(
    () => (brandId ? affiliatePartners.filter((p) => p.brandId === brandId) : []),
    [affiliatePartners, brandId]
  );

  const statsForMonth = useMemo(() => {
    if (!brandId) return [];
    const prefix = `${month}-`;
    return affiliateDailyStats.filter(
      (s) => s.brandId === brandId && s.statDate.startsWith(prefix)
    );
  }, [affiliateDailyStats, brandId, month]);

  const payouts = useMemo(
    () => (brandId ? affiliatePayouts.filter((p) => p.brandId === brandId) : []),
    [affiliatePayouts, brandId]
  );

  const refreshStats = useCallback(async () => {
    if (!brandId) return;
    const { from, to } = monthRange(month);
    const stats = await fetchAffiliateStats({ brandId, from, to });
    useStore.setState((s) => ({
      affiliateDailyStats: mergeById(s.affiliateDailyStats, stats),
    }));
  }, [brandId, month]);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    const { from, to } = monthRange(month);
    (async () => {
      setNotReady(false);
      setLoadError(null);
      try {
        const [partnersRes, statsRes, payoutsRes] = await Promise.all([
          fetchAffiliatePartners(brandId),
          fetchAffiliateStats({ brandId, from, to }),
          fetchAffiliatePayouts(brandId),
        ]);
        if (cancelled) return;
        useStore.setState((s) => ({
          affiliatePartners: [
            ...s.affiliatePartners.filter((p) => p.brandId !== brandId),
            ...partnersRes,
          ],
          affiliateDailyStats: mergeById(s.affiliateDailyStats, statsRes),
          affiliatePayouts: [
            ...s.affiliatePayouts.filter((p) => p.brandId !== brandId),
            ...payoutsRes,
          ],
        }));
      } catch (err) {
        if (cancelled) return;
        if (isPoolNotReadyError(err)) {
          setNotReady(true);
        } else {
          setLoadError(err instanceof ApiError ? err.message : "Veriler yüklenemedi.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, month]);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    (async () => {
      try {
        const [tiersRes, campaignsRes] = await Promise.all([
          fetchAffiliateTiers(brandId).catch(() =>
            DEFAULT_AFFILIATE_TIERS.map((t, i) => ({
              id: `tier-${brandId}-${i}`,
              brandId,
              ...t,
            }))
          ),
          fetchBrandCampaigns(brandId).catch(() => []),
        ]);
        if (cancelled) return;
        setTiers(tiersRes);
        setCampaigns(campaignsRes);
      } catch {
        if (!cancelled) {
          setTiers(
            DEFAULT_AFFILIATE_TIERS.map((t, i) => ({
              id: `tier-${brandId}-${i}`,
              brandId,
              ...t,
            }))
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const affiliateInsights = useMemo(
    () =>
      brandId
        ? computeAffiliateMonthInsights(partners, statsForMonth, payouts, brandId, month)
        : null,
    [partners, statsForMonth, payouts, brandId, month]
  );

  const totals = useMemo(() => {
    return statsForMonth.reduce(
      (acc, s) => {
        acc.clicks += s.clicks ?? 0;
        acc.registrations += s.registrations ?? 0;
        acc.ftd += s.ftdCount ?? 0;
        acc.ftdAmount += s.ftdAmount ?? 0;
        acc.deposit += s.depositAmount ?? 0;
        acc.withdrawal += s.withdrawalAmount ?? 0;
        acc.commission += s.commissionDue ?? 0;
        return acc;
      },
      {
        clicks: 0,
        registrations: 0,
        ftd: 0,
        ftdAmount: 0,
        deposit: 0,
        withdrawal: 0,
        commission: 0,
      }
    );
  }, [statsForMonth]);

  const partnerRows = useMemo(() => {
    return partners
      .map((p) => {
        const ps = statsForMonth.filter((s) => s.partnerId === p.id);
        const sum = ps.reduce(
          (a, s) => ({
            clicks: a.clicks + (s.clicks ?? 0),
            registrations: a.registrations + (s.registrations ?? 0),
            ftd: a.ftd + (s.ftdCount ?? 0),
            commission: a.commission + (s.commissionDue ?? 0),
          }),
          { clicks: 0, registrations: 0, ftd: 0, commission: 0 }
        );
        return { partner: p, ...sum, qualityScore: computePartnerQualityScore(sum.clicks, sum.registrations, sum.ftd) };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [partners, statsForMonth]);

  const displayedRows = showAll ? partnerRows : partnerRows.slice(0, 10);

  const typeSummary = useMemo(() => {
    return PARTNER_TYPE_OPTIONS.map((opt) => ({
      type: opt.value,
      label: opt.label,
      count: partners.filter((p) => p.partnerType === opt.value).length,
    })).filter((t) => t.count > 0);
  }, [partners]);

  const partnerNameById = useCallback(
    (id: string) => partners.find((p) => p.id === id)?.name ?? id,
    [partners]
  );

  const handlePartnerSaved = (saved: AffiliatePartner) => {
    useStore.setState((s) => ({
      affiliatePartners: mergeById(s.affiliatePartners, [saved]),
    }));
  };

  const handlePartnerDeleted = (id: string) => {
    useStore.setState((s) => ({
      affiliatePartners: s.affiliatePartners.filter((p) => p.id !== id),
    }));
    if (detailPartnerId === id) setDetailPartnerId(null);
  };

  const handlePayoutSaved = (saved: AffiliatePayout) => {
    useStore.setState((s) => ({
      affiliatePayouts: mergeById(s.affiliatePayouts, [saved]),
    }));
  };

  const patchPayout = async (
    payout: AffiliatePayout,
    body: Partial<AffiliatePayout>
  ) => {
    try {
      const saved = await updateAffiliatePayout(payout.id, body);
      handlePayoutSaved(saved);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Ödeme güncellenemedi.");
    }
  };

  const handlePayoutDeleted = (id: string) => {
    useStore.setState((s) => ({
      affiliatePayouts: s.affiliatePayouts.filter((p) => p.id !== id),
    }));
  };

  const handleReport = () => {
    const header = [
      "partner",
      "tip",
      "komisyon_modeli",
      "durum",
      "tiklama",
      "kayit",
      "ftd",
      "komisyon",
    ].join(",");
    const lines = partnerRows.map((r) =>
      [
        `"${r.partner.name.replace(/"/g, '""')}"`,
        partnerTypeLabel(r.partner.partnerType),
        commissionLabel(r.partner.commissionModel),
        partnerStatusLabel(r.partner.status),
        r.clicks,
        r.registrations,
        r.ftd,
        r.commission,
      ].join(",")
    );
    const totalsLine = [
      '"TOPLAM"',
      "",
      "",
      "",
      totals.clicks,
      totals.registrations,
      totals.ftd,
      totals.commission,
    ].join(",");
    const csv = [header, ...lines, totalsLine].join("\n");
    downloadCsv(`affiliate-rapor-${month}.csv`, csv);
  };

  const detailPartner = useMemo(
    () => partners.find((p) => p.id === detailPartnerId) ?? null,
    [partners, detailPartnerId]
  );
  const detailStats = useMemo(
    () => (detailPartnerId ? statsForMonth.filter((s) => s.partnerId === detailPartnerId) : []),
    [statsForMonth, detailPartnerId]
  );

  const canWrite = !readOnly;

  return (
    <MarkaPageGuard
      user={user}
      canViewBrand={canViewBrand}
      brandId={brandId}
      brand={brand}
    >
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
          {notReady && (
            <PoolServerBanner message="Affiliate API'si henüz yayında değil. Yönetici migrasyonu uyguladıktan sonra partner ve performans verileri burada görünecek." />
          )}
          {loadError && !notReady && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          {/* Hero */}
          <Card className="relative overflow-hidden border-pink-200/60 dark:border-pink-500/30">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-pink-500/15 via-fuchsia-500/10 to-orange-500/15 dark:from-pink-500/25 dark:via-fuchsia-500/15 dark:to-orange-500/20"
            />
            <CardHeader className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <span>{brand.name}</span>
                    <Badge variant="secondary" className="bg-pink-100 text-pink-900 dark:bg-pink-500/15 dark:text-pink-200">
                      Affiliate
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {monthTitle} · partner performans özeti
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />
                {canWrite && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCsvOpen(true)}
                  >
                    <Upload size={14} /> CSV içe aktar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleReport}
                  disabled={partnerRows.length === 0}
                >
                  <Download size={14} /> Rapor
                </Button>
              </div>
            </CardHeader>
            <CardContent className="relative pt-0">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Tıklama" value={fmtCompactViews(totals.clicks)} />
                <Kpi label="Kayıt" value={fmtBrandCount(totals.registrations)} />
                <Kpi
                  label="FTD"
                  value={fmtBrandCount(totals.ftd)}
                  sub={totals.ftdAmount > 0 ? fmtBrandMoney(totals.ftdAmount, "USD") : undefined}
                />
                <Kpi label="Komisyon" value={fmtBrandMoney(totals.commission, "USD")} />
              </div>
            </CardContent>
          </Card>

          {affiliateInsights && affiliateInsights.dailyFtd.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-600" />
                  Günlük FTD trendi
                </CardTitle>
                <CardDescription>
                  {monthTitle} — partner günlük istatistiklerinden
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AffiliateDailyTrend dailyFtd={affiliateInsights.dailyFtd} />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {affiliateInsights.activePartners} aktif partner ·{" "}
                  {affiliateInsights.pendingPayouts} bekleyen ödeme
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Komisyon kademeleri</CardTitle>
                <CardDescription>affiliate_tiers — FTD eşiğine göre komisyon</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tiers.map((tier) => (
                    <div
                      key={tier.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{tier.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Min. {fmtBrandCount(tier.minFtd)} FTD
                          {tier.carryover ? " · devreden" : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        %{tier.commissionPct}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Kampanyalar</CardTitle>
                <CardDescription>
                  {campaigns.length === 0
                    ? "Henüz kampanya kaydı yok"
                    : `${campaigns.length} kampanya`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Promo kod ve landing varyantları burada listelenecek.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {campaigns.slice(0, 5).map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {CAMPAIGN_TYPE_LABELS[c.campaignType]}
                            {c.promoCode ? ` · ${c.promoCode}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Partner listesi */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users size={16} className="text-pink-600 dark:text-pink-400" />
                  Partner listesi
                </CardTitle>
                <CardDescription>
                  {partners.length === 0
                    ? "Henüz partner eklenmemiş."
                    : `${partners.length} partner · ${partners.filter((p) => p.status === "active").length} aktif`}
                </CardDescription>
              </div>
              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setStatModal({ open: true })}
                    disabled={partners.length === 0}
                  >
                    <Activity size={14} /> Günlük istatistik
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setPartnerModal({ open: true, partner: null })}
                  >
                    <PlusCircle size={14} /> Yeni partner
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {partners.length === 0 ? (
                <EmptyState
                  canWrite={canWrite}
                  onAdd={() => setPartnerModal({ open: true, partner: null })}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 font-medium">Partner</th>
                        <th className="py-2 pr-3 font-medium">Tip</th>
                        <th className="py-2 pr-3 font-medium">Komisyon</th>
                        <th className="py-2 pr-3 text-right font-medium">Tıklama</th>
                        <th className="py-2 pr-3 text-right font-medium">Kayıt</th>
                        <th className="py-2 pr-3 text-right font-medium">FTD</th>
                        <th className="py-2 pr-3 text-right font-medium">Kalite</th>
                        <th className="py-2 pr-3 text-right font-medium">Komisyon</th>
                        {canWrite && <th className="py-2 pr-1 text-right font-medium">İşlem</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.map((row) => (
                        <tr
                          key={row.partner.id}
                          className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                          onClick={() => setDetailPartnerId(row.partner.id)}
                        >
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
                                <Activity size={14} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 font-medium">
                                  {row.partner.name}
                                  {row.partner.status !== "active" && (
                                    <Badge
                                      variant="secondary"
                                      className={`text-[10px] ${partnerStatusBadgeClass(row.partner.status)}`}
                                    >
                                      {partnerStatusLabel(row.partner.status)}
                                    </Badge>
                                  )}
                                </div>
                                {row.partner.externalRef && (
                                  <div className="text-xs text-muted-foreground">
                                    Ref: {row.partner.externalRef}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant="outline" className="text-xs font-normal">
                              {partnerTypeLabel(row.partner.partnerType)}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {commissionLabel(row.partner.commissionModel)}
                            {row.partner.commissionModel === "cpa" && row.partner.cpaAmount > 0
                              ? ` · ${fmtBrandMoney(row.partner.cpaAmount, row.partner.currency)}`
                              : ""}
                            {row.partner.commissionModel === "revshare" && row.partner.revsharePct > 0
                              ? ` · %${row.partner.revsharePct}`
                              : ""}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {fmtCompactViews(row.clicks)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {fmtBrandCount(row.registrations)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {fmtBrandCount(row.ftd)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <QualityScoreBadge score={row.qualityScore} />
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-medium">
                            {fmtBrandMoney(row.commission, row.partner.currency)}
                          </td>
                          {canWrite && (
                            <td className="py-2 pr-1 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPartnerModal({ open: true, partner: row.partner });
                                }}
                                className="rounded-md px-2 py-1 text-xs text-pink-700 hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-500/10"
                              >
                                Düzenle
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {partnerRows.length > 10 && (
                    <div className="mt-3 flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAll((v) => !v)}
                      >
                        {showAll ? "Daha az göster" : `Tümünü göster (${partnerRows.length})`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ödemeler */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet size={16} className="text-pink-600 dark:text-pink-400" />
                  Ödemeler
                </CardTitle>
                <CardDescription>
                  {payouts.length === 0
                    ? "Henüz ödeme kaydı yok."
                    : `${payouts.length} ödeme · ${payouts.filter((p) => p.status === "paid").length} ödendi`}
                </CardDescription>
              </div>
              {canWrite && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPayoutModal({ open: true, payout: null })}
                  disabled={partners.length === 0}
                >
                  <PlusCircle size={14} /> Ödeme ekle
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  Partner komisyon ödemelerini buradan takip edin. İlk ödemeyi eklemek
                  için “Ödeme ekle”ye dokunun.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 font-medium">Partner</th>
                        <th className="py-2 pr-3 font-medium">Dönem</th>
                        <th className="py-2 pr-3 text-right font-medium">Tutar</th>
                        <th className="py-2 pr-3 font-medium">Durum</th>
                        <th className="py-2 pr-3 font-medium">Ödeme tarihi</th>
                        {canWrite && <th className="py-2 pr-1 text-right font-medium">İşlem</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 pr-3 font-medium">{partnerNameById(p.partnerId)}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {fmtDateOnly(p.periodStart)} – {fmtDateOnly(p.periodEnd)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-medium">
                            {fmtBrandMoney(p.amount, p.currency)}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge
                              variant="secondary"
                              className={payoutStatusBadgeClass(p.status)}
                            >
                              {payoutStatusLabel(p.status)}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {p.paidDate ? fmtDateOnly(p.paidDate) : "—"}
                          </td>
                          {canWrite && (
                            <td className="py-2 pr-1">
                              <div className="flex items-center justify-end gap-1">
                                {p.status !== "paid" && p.status !== "cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchPayout(p, {
                                        status: "paid",
                                        paidDate: new Date().toISOString().slice(0, 10),
                                      })
                                    }
                                    className="rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                                  >
                                    Ödendi
                                  </button>
                                )}
                                {p.status !== "cancelled" && p.status !== "paid" && (
                                  <button
                                    type="button"
                                    onClick={() => patchPayout(p, { status: "cancelled" })}
                                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                                  >
                                    İptal
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPayoutModal({ open: true, payout: p })
                                  }
                                  className="rounded-md px-2 py-1 text-xs text-pink-700 hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-500/10"
                                >
                                  Düzenle
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Özet */}
          {partners.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp size={16} className="text-pink-600 dark:text-pink-400" />
                  Partner tipi dağılımı
                </CardTitle>
                <CardDescription>
                  Net (yatırım − çekim): {fmtBrandMoney(totals.deposit - totals.withdrawal, "USD")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {typeSummary.map((t) => (
                    <div
                      key={t.type}
                      className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2"
                    >
                      <div className="text-[11px] text-muted-foreground">{t.label}</div>
                      <div className="mt-0.5 text-lg font-semibold tabular-nums">
                        {fmtBrandCount(t.count)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {brandId && (
        <>
          <PartnerFormModal
            open={partnerModal.open}
            onClose={() => setPartnerModal({ open: false, partner: null })}
            brandId={brandId}
            partner={partnerModal.partner}
            onSaved={handlePartnerSaved}
            onDeleted={handlePartnerDeleted}
          />
          <CsvImportModal
            open={csvOpen}
            onClose={() => setCsvOpen(false)}
            brandId={brandId}
            onImported={refreshStats}
          />
          <DailyStatModal
            open={statModal.open}
            onClose={() => setStatModal({ open: false })}
            partners={partners}
            presetPartnerId={statModal.partnerId}
            onSaved={refreshStats}
          />
          <PayoutModal
            open={payoutModal.open}
            onClose={() => setPayoutModal({ open: false, payout: null })}
            partners={partners}
            presetPartnerId={payoutModal.partnerId}
            payout={payoutModal.payout}
            onSaved={handlePayoutSaved}
            onDeleted={handlePayoutDeleted}
          />
          <PartnerDetailModal
            open={!!detailPartnerId}
            onClose={() => setDetailPartnerId(null)}
            partner={detailPartner}
            stats={detailStats}
            monthTitle={monthTitle}
            readOnly={readOnly}
            onAddStat={() => {
              if (!detailPartner) return;
              const id = detailPartner.id;
              setDetailPartnerId(null);
              setStatModal({ open: true, partnerId: id });
            }}
            onAddPayout={() => {
              if (!detailPartner) return;
              const id = detailPartner.id;
              setDetailPartnerId(null);
              setPayoutModal({ open: true, partnerId: id, payout: null });
            }}
          />
        </>
      )}
    </MarkaPageGuard>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card/80 px-3 py-2 backdrop-blur">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function QualityScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
      : score >= 50
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
        : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200";
  return (
    <span
      className={`inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`}
      title="Kalite skoru (operatör/computed)"
    >
      {score}
    </span>
  );
}

function EmptyState({ canWrite, onAdd }: { canWrite: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
      <TrendingUp size={28} className="text-muted-foreground" />
      <div className="text-sm font-medium">Henüz affiliate partner yok</div>
      <div className="max-w-sm text-xs text-muted-foreground">
        İlk partneri ekleyerek tıklama, kayıt ve komisyon performansını takip etmeye
        başlayın. Verileri CSV ile toplu da içe aktarabilirsiniz.
      </div>
      {canWrite && (
        <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={onAdd}>
          <PlusCircle size={14} /> Yeni partner
        </Button>
      )}
    </div>
  );
}
