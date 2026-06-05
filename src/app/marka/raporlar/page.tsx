"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Users,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  downloadReport,
  fetchIgamingDashboardSummary,
  fetchPlayerEvents,
} from "@/lib/brand-igaming-api";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import {
  downloadProfessionalCsv,
  numberedDetailSection,
  summarySection,
} from "@/lib/professional-csv";
import type {
  BrandPlayerEvent,
  IgamingDashboardSummary,
  PlayerEventChannel,
  PlayerEventSource,
  PlayerEventType,
} from "@/types/brand-igaming";

const SERVER_REPORTS = [
  { type: "stats" as const, title: "Operasyon istatistikleri", desc: "Tüm aylar — kayıt, FTD, GGR, NGR, komisyon" },
  { type: "affiliate" as const, title: "Affiliate performans", desc: "Seçili ay günlük tıklama, kayıt, FTD, komisyon" },
  { type: "deals" as const, title: "CRM & kampanyalar", desc: "Pipeline fırsatları ve aktif kampanyalar" },
  { type: "compliance" as const, title: "Uyumluluk", desc: "Tüm compliance kontrol kayıtları" },
];

const EVENT_TYPE_LABELS: Record<PlayerEventType, string> = {
  registration: "Kayıt",
  ftd: "FTD",
  deposit: "Yatırım",
  withdrawal: "Çekim",
  chargeback: "Chargeback",
  active_player: "Aktif oyuncu",
};

const CHANNEL_LABELS: Record<PlayerEventChannel, string> = {
  all: "Tümü",
  affiliate: "Affiliate",
  organic: "Organik",
  influencer: "Influencer",
};

const SOURCE_LABELS: Record<PlayerEventSource, string> = {
  manual: "Manuel",
  csv: "CSV",
  api: "API",
  webhook: "Webhook",
};

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function downloadDashboardCsv(
  brandName: string,
  summary: IgamingDashboardSummary,
) {
  const { month, monthly, targets, affiliate } = summary;
  downloadProfessionalCsv({
    filename: `marka-dashboard-${summary.brandId}-${month}.csv`,
    metadata: {
      Marka: brandName,
      Ay: month,
      "Rapor tipi": "Aylık operasyon özeti",
    },
    sections: [
      summarySection("Operasyon metrikleri", [
        { metric: "Yeni kayıt", value: monthly.newRegistrations, unit: "adet" },
        { metric: "FTD", value: monthly.ftd, unit: "adet" },
        { metric: "Yatırım", value: monthly.depositAmount, unit: "USD" },
        { metric: "Çekim", value: monthly.withdrawalAmount, unit: "USD" },
        { metric: "GGR", value: monthly.ggr, unit: "USD" },
        { metric: "NGR", value: monthly.ngr, unit: "USD" },
        { metric: "Komisyon", value: monthly.commissionTotal, unit: "USD" },
        { metric: "Aktif oyuncu", value: monthly.activePlayers, unit: "adet" },
      ]),
      summarySection("KPI hedefleri", [
        { metric: "Hedef FTD", value: targets.targetFtd, unit: "adet" },
        { metric: "Hedef NGR", value: targets.targetNgr, unit: "USD" },
        { metric: "Hedef kayıt", value: targets.targetRegistrations, unit: "adet" },
        { metric: "Hedef yatırım", value: targets.targetDepositAmount, unit: "USD" },
      ]),
      summarySection("Affiliate özeti", [
        { metric: "Tıklama", value: affiliate.clicks, unit: "adet" },
        { metric: "Kayıt", value: affiliate.registrations, unit: "adet" },
        { metric: "FTD", value: affiliate.ftdCount, unit: "adet" },
        { metric: "Yatırım", value: affiliate.depositAmount, unit: "USD" },
        { metric: "Komisyon", value: affiliate.commissionDue, unit: "USD" },
      ]),
    ],
  });
}

function downloadPlayerEventsCsv(
  brandName: string,
  month: string,
  events: BrandPlayerEvent[],
) {
  downloadProfessionalCsv({
    filename: `marka-oyuncu-olaylari-${events[0]?.brandId ?? "marka"}-${month}.csv`,
    metadata: {
      Marka: brandName,
      Ay: month,
      "Satir sayisi": String(events.length),
      "Rapor tipi": "Oyuncu olayları",
    },
    sections: [
      numberedDetailSection(
        "Oyuncu olaylari",
        ["Tarih", "Tip", "Kanal", "Ulke", "Adet", "Tutar", "PB", "Kaynak"],
        events.map((e) => [
          e.eventDate,
          EVENT_TYPE_LABELS[e.eventType],
          CHANNEL_LABELS[e.channel],
          e.countryCode ?? "",
          e.eventCount,
          e.amount,
          e.currency,
          SOURCE_LABELS[e.source],
        ]),
        `${month} ayina ait ${events.length} satir`,
      ),
    ],
  });
}

export default function MarkaRaporlarPage() {
  const { user, brandId, brand, month, navMonth, monthTitle, canViewBrand } = useMarkaPortal();

  const [summary, setSummary] = useState<IgamingDashboardSummary | null>(null);
  const [events, setEvents] = useState<BrandPlayerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => monthRange(month), [month]);

  const load = useCallback(async () => {
    if (!brandId) {
      setSummary(null);
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dash, ev] = await Promise.all([
        fetchIgamingDashboardSummary(brandId, month),
        fetchPlayerEvents(brandId, range.from, range.to),
      ]);
      setSummary(dash);
      setEvents(ev);
    } catch (e) {
      setSummary(null);
      setEvents([]);
      setError(e instanceof Error ? e.message : "Rapor verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId, month, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthly = summary?.monthly;
  const affiliate = summary?.affiliate;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[960px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FileSpreadsheet size={22} /> Raporlar & export
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Aylık operasyon özeti, oyuncu olayları ve modül CSV indirmeleri — {brand?.name}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void load()}
            disabled={!brandId || loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Yenile
          </Button>
        </div>

        <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />
        <p className="text-xs text-muted-foreground">
          Seçili ay: <strong className="capitalize">{monthTitle}</strong>
        </p>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity size={16} /> Aylık operasyon özeti
                </CardTitle>
                <CardDescription>Dashboard API — {monthTitle}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!summary || !brand}
                onClick={() => summary && brand && downloadDashboardCsv(brand.name, summary)}
              >
                <Download size={14} /> Özet CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !summary ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Yükleniyor…
              </div>
            ) : monthly ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Yeni kayıt", value: fmtBrandCount(monthly.newRegistrations) },
                  { label: "FTD", value: fmtBrandCount(monthly.ftd) },
                  { label: "Yatırım", value: fmtBrandMoney(monthly.depositAmount, "USD") },
                  { label: "NGR", value: fmtBrandMoney(monthly.ngr, "USD") },
                  { label: "GGR", value: fmtBrandMoney(monthly.ggr, "USD") },
                  { label: "Komisyon", value: fmtBrandMoney(monthly.commissionTotal, "USD") },
                  { label: "Aktif oyuncu", value: fmtBrandCount(monthly.activePlayers) },
                  {
                    label: "Affiliate FTD",
                    value: affiliate ? fmtBrandCount(affiliate.ftdCount) : "—",
                  },
                ].map((k) => (
                  <div key={k.label} className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{k.label}</p>
                    <p className="text-sm font-semibold tabular-nums">{k.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Bu ay için dashboard özeti bulunamadı.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users size={16} /> Oyuncu olayları
                </CardTitle>
                <CardDescription>
                  Player-events API — {range.from} → {range.to}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{events.length} satır</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!brand || events.length === 0}
                  onClick={() => brand && downloadPlayerEventsCsv(brand.name, month, events)}
                >
                  <Download size={14} /> Olay CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && events.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Yükleniyor…
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu ay için oyuncu olayı kaydı yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Tarih</th>
                      <th className="px-3 py-2 font-medium">Tip</th>
                      <th className="px-3 py-2 font-medium">Kanal</th>
                      <th className="px-3 py-2 font-medium text-right">Adet</th>
                      <th className="px-3 py-2 font-medium text-right">Tutar</th>
                      <th className="px-3 py-2 font-medium">Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.slice(0, 8).map((e) => (
                      <tr key={e.id} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 tabular-nums">{e.eventDate}</td>
                        <td className="px-3 py-2">{EVENT_TYPE_LABELS[e.eventType]}</td>
                        <td className="px-3 py-2">{CHANNEL_LABELS[e.channel]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{e.eventCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {e.amount > 0 ? fmtBrandMoney(e.amount, e.currency) : "—"}
                        </td>
                        <td className="px-3 py-2">{SOURCE_LABELS[e.source]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {events.length > 8 && (
                  <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                    İlk 8 satır gösteriliyor — tam liste için CSV indirin.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold">Modül CSV exportları</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {SERVER_REPORTS.map((r) => (
              <Card key={r.type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{r.title}</CardTitle>
                  <CardDescription>{r.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() =>
                      brandId &&
                      downloadReport(
                        brandId,
                        r.type,
                        r.type !== "deals" && r.type !== "compliance" ? month : undefined,
                      )
                    }
                    disabled={!brandId}
                  >
                    <Download size={14} /> CSV indir
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </MarkaPageGuard>
  );
}
