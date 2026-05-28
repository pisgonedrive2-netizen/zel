"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Download,
  ExternalLink,
  PlusCircle,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { useStore } from "@/store/store";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";

function partnerTypeLabel(t: string): string {
  switch (t) {
    case "streamer":
      return "Yayıncı";
    case "external":
      return "Dış partner";
    case "agency":
      return "Ajans";
    case "social":
      return "Sosyal";
    default:
      return t;
  }
}

function commissionLabel(model: string): string {
  switch (model) {
    case "cpa":
      return "CPA";
    case "revshare":
      return "RevShare";
    case "hybrid":
      return "Hybrid";
    case "flat":
      return "Sabit";
    default:
      return model;
  }
}

export default function MarkaAffiliatePage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle } = portal;
  const { affiliatePartners, affiliateDailyStats } = useStore();
  const [showAll, setShowAll] = useState(false);

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
        return { partner: p, ...sum };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [partners, statsForMonth]);

  const displayedRows = showAll ? partnerRows : partnerRows.slice(0, 10);

  return (
    <MarkaPageGuard
      user={user}
      canViewBrand={canViewBrand}
      brandId={brandId}
      brand={brand}
    >
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
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
                      Affiliate MVP
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {monthTitle} · partner performans özeti
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />
                <Button variant="outline" size="sm" className="gap-1.5" disabled title="Yakında">
                  <Upload size={14} /> CSV içe aktar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" disabled title="Yakında">
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
              <Button size="sm" className="gap-1.5" disabled title="Yakında">
                <PlusCircle size={14} /> Yeni partner
              </Button>
            </CardHeader>
            <CardContent>
              {partners.length === 0 ? (
                <EmptyState />
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
                        <th className="py-2 pr-1 text-right font-medium">Komisyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.map((row) => (
                        <tr
                          key={row.partner.id}
                          className="border-b last:border-0 hover:bg-muted/40"
                        >
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
                                <Activity size={14} />
                              </div>
                              <div>
                                <div className="font-medium">{row.partner.name}</div>
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
                          <td className="py-2 pr-1 text-right tabular-nums font-medium">
                            {fmtBrandMoney(row.commission, "USD")}
                          </td>
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

          {/* Sonraki adımlar */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles size={16} className="text-pink-600 dark:text-pink-400" />
                Sonraki adımlar (yol haritası)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Bu MVP sayfası partner listesi ve aylık özet gösterir. Veri girişi şu an
                yöneticide; B2B fazlarına göre yakında:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Yeni partner ekleme + CSV içe aktar (Faz C.3)</li>
                <li>Partner detay sayfası ve günlük grafik (Faz C.4)</li>
                <li>Operatör webhook entegrasyonu (Faz F)</li>
              </ul>
              <p>
                <Link
                  href={markaHref("/marka/anasayfa", month)}
                  className="inline-flex items-center gap-1 text-pink-700 hover:underline dark:text-pink-300"
                >
                  Anasayfaya dön <ArrowUpRight size={12} />
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
      <TrendingUp size={28} className="text-muted-foreground" />
      <div className="text-sm font-medium">Henüz affiliate partner yok</div>
      <div className="max-w-sm text-xs text-muted-foreground">
        Yönetici tarafından ilk partner eklendiğinde performans tablosu burada
        görünecek. CSV içe aktarımı yakında aktif olacak.
      </div>
      <Button variant="outline" size="sm" className="mt-2 gap-1.5" disabled>
        <ExternalLink size={14} /> Yönetici ile iletişim
      </Button>
    </div>
  );
}
