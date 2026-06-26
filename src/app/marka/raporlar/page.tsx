"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaUnifiedExportCard } from "@/components/marka/marka-unified-export-card";
import { BrandKpiTargetsBar } from "@/components/marka-igaming/brand-kpi-targets-bar";
import { PlayerEventsBreakdown } from "@/components/marka/player-events-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  downloadReport,
  fetchIgamingDashboardSummary,
  fetchPlayerEvents,
} from "@/lib/brand-igaming-api";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { previousMonthYm, computeDelta } from "@/lib/brand-igaming-metrics";
import { markaHref } from "@/lib/use-marka-view-month";
import { toYearMonthLocal } from "@/lib/data";
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
  { type: "content" as const, title: "İçerik & izlenme", desc: "Seçili ay link bazlı izlenme export" },
  { type: "deals" as const, title: "CRM & kampanyalar", desc: "Pipeline fırsatları ve aktif kampanyalar" },
  { type: "compliance" as const, title: "Uyumluluk", desc: "Tüm compliance kontrol kayıtları" },
];

const SCHEDULE_KEY = "marka-report-schedule";

function downloadDashboardPdfTemplate(brandName: string, month: string, summary: IgamingDashboardSummary | null) {
  const m = summary?.monthly;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${brandName} — ${month}</title>
<style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head>
<body><h1>${brandName} — Aylık operasyon özeti</h1><p>Dönem: ${month}</p>
<table><tr><th>Metrik</th><th>Değer</th></tr>
<tr><td>Kayıt</td><td>${m?.newRegistrations ?? "—"}</td></tr>
<tr><td>FTD</td><td>${m?.ftd ?? "—"}</td></tr>
<tr><td>Yatırım</td><td>$${m?.depositAmount ?? "—"}</td></tr>
<tr><td>GGR</td><td>$${m?.ggr ?? "—"}</td></tr>
<tr><td>NGR</td><td>$${m?.ngr ?? "—"}</td></tr>
<tr><td>Komisyon</td><td>$${m?.commissionTotal ?? "—"}</td></tr>
</table><p style="margin-top:24px;font-size:12px;color:#666">Foxstream marka paneli — yazdır → PDF olarak kaydet</p></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

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
  const [prevSummary, setPrevSummary] = useState<IgamingDashboardSummary | null>(null);
  const [events, setEvents] = useState<BrandPlayerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleDay, setScheduleDay] = useState("1");
  const [scheduleTypes, setScheduleTypes] = useState<string[]>(["stats", "affiliate"]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { day?: string; types?: string[] };
      if (parsed.day) setScheduleDay(parsed.day);
      if (parsed.types?.length) setScheduleTypes(parsed.types);
    } catch {
      /* ignore */
    }
  }, []);

  const saveSchedule = () => {
    localStorage.setItem(
      SCHEDULE_KEY,
      JSON.stringify({ day: scheduleDay, types: scheduleTypes, brandId })
    );
  };

  useEffect(() => {
    if (!brandId) return;
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { day?: string; types?: string[]; brandId?: string; lastRun?: string };
      if (parsed.brandId && parsed.brandId !== brandId) return;
      const today = new Date();
      const dom = String(today.getDate());
      const ym = today.toISOString().slice(0, 7);
      const lastRun = parsed.lastRun ?? "";
      if (parsed.day === dom && lastRun !== ym && parsed.types?.length) {
        for (const t of parsed.types) {
          downloadReport(brandId, t, t === "deals" || t === "compliance" ? undefined : month);
        }
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ ...parsed, brandId, lastRun: ym }));
      }
    } catch {
      /* ignore */
    }
  }, [brandId, month]);

  const range = useMemo(() => monthRange(month), [month]);
  const prevMonth = useMemo(() => previousMonthYm(month), [month]);
  const todayYm = toYearMonthLocal(new Date());

  const load = useCallback(async () => {
    if (!brandId) {
      setSummary(null);
      setPrevSummary(null);
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dash, prevDash, ev] = await Promise.all([
        fetchIgamingDashboardSummary(brandId, month),
        fetchIgamingDashboardSummary(brandId, prevMonth).catch(() => null),
        fetchPlayerEvents(brandId, range.from, range.to),
      ]);
      setSummary(dash);
      setPrevSummary(prevDash);
      setEvents(ev);
    } catch (e) {
      setSummary(null);
      setPrevSummary(null);
      setEvents([]);
      setError(e instanceof Error ? e.message : "Rapor verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId, month, prevMonth, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthly = summary?.monthly;
  const prevMonthly = prevSummary?.monthly;
  const affiliate = summary?.affiliate;

  const kpiActual = monthly
    ? {
        ftd: monthly.ftd,
        ngr: monthly.ngr,
        depositAmount: monthly.depositAmount,
        registrations: monthly.newRegistrations,
      }
    : { ftd: 0, ngr: 0, depositAmount: 0, registrations: 0 };

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
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Yeni kayıt", current: monthly.newRegistrations, prev: prevMonthly?.newRegistrations, format: fmtBrandCount },
                    { label: "FTD", current: monthly.ftd, prev: prevMonthly?.ftd, format: fmtBrandCount },
                    { label: "Yatırım", current: monthly.depositAmount, prev: prevMonthly?.depositAmount, format: (n: number) => fmtBrandMoney(n, "USD") },
                    { label: "NGR", current: monthly.ngr, prev: prevMonthly?.ngr, format: (n: number) => fmtBrandMoney(n, "USD") },
                    { label: "GGR", current: monthly.ggr, prev: prevMonthly?.ggr, format: (n: number) => fmtBrandMoney(n, "USD") },
                    { label: "Komisyon", current: monthly.commissionTotal, prev: prevMonthly?.commissionTotal, format: (n: number) => fmtBrandMoney(n, "USD") },
                    { label: "Aktif oyuncu", current: monthly.activePlayers, prev: prevMonthly?.activePlayers, format: fmtBrandCount },
                    {
                      label: "Affiliate FTD",
                      current: affiliate?.ftdCount ?? 0,
                      prev: prevSummary?.affiliate?.ftdCount,
                      format: fmtBrandCount,
                    },
                  ].map((k) => (
                    <MetricTile key={k.label} label={k.label} current={k.current} prev={k.prev} format={k.format} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link href={markaHref("/marka/operasyon", month)} className="text-primary hover:underline">
                    Operasyon detayı →
                  </Link>
                  <Link href={markaHref("/marka/izlenmeler", month)} className="text-primary hover:underline">
                    İzlenme detayı →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Bu ay için dashboard özeti bulunamadı.</p>
            )}
          </CardContent>
        </Card>

        {summary && (
          <BrandKpiTargetsBar
            monthTitle={monthTitle}
            targets={summary.targets}
            actual={kpiActual}
          />
        )}

        {loading && events.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Oyuncu olayları yükleniyor…
            </CardContent>
          </Card>
        ) : events.length > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!brand}
                onClick={() => brand && downloadPlayerEventsCsv(brand.name, month, events)}
              >
                <Download size={14} /> Olay CSV
              </Button>
            </div>
            <PlayerEventsBreakdown events={events} mode="daily" monthTitle={monthTitle} />
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-6 text-sm text-muted-foreground text-center">
              Bu ay için oyuncu olayı kaydı yok.
            </CardContent>
          </Card>
        )}

        {brand && brandId && (
          <MarkaUnifiedExportCard
            brand={brand}
            brandId={brandId}
            month={month}
            monthTitle={monthTitle}
            todayYm={todayYm}
          />
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold">Modül CSV exportları</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {SERVER_REPORTS.map((r) => (
              <Card key={r.type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{r.title}</CardTitle>
                  <CardDescription>{r.desc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
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
                  {r.type === "stats" && brand && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      onClick={() => downloadDashboardPdfTemplate(brand.name, month, summary)}
                    >
                      <FileSpreadsheet size={14} /> PDF şablonu (yazdır)
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Zamanlanmış rapor</CardTitle>
            <CardDescription>
              Her ay belirtilen günde otomatik CSV indirme (tarayıcı açıkken)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Ayın günü</label>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={scheduleDay}
                onChange={(e) => setScheduleDay(e.target.value)}
              >
                {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                  <option key={d} value={d}>
                    {d}.
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVER_REPORTS.map((r) => (
                <label key={r.type} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={scheduleTypes.includes(r.type)}
                    onChange={(e) => {
                      setScheduleTypes((prev) =>
                        e.target.checked
                          ? [...prev, r.type]
                          : prev.filter((t) => t !== r.type)
                      );
                    }}
                  />
                  {r.title}
                </label>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={saveSchedule}>
              Zamanlamayı kaydet
            </Button>
          </CardContent>
        </Card>
      </div>
    </MarkaPageGuard>
  );
}

function MetricTile({
  label,
  current,
  prev,
  format,
}: {
  label: string;
  current: number;
  prev?: number;
  format: (n: number) => string;
}) {
  const delta = prev != null ? computeDelta(current, prev) : null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold tabular-nums">{format(current)}</p>
        {delta && delta.direction !== "flat" && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums ${
              delta.direction === "up"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            {delta.direction === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {delta.pct != null ? `${delta.pct >= 0 ? "+" : ""}${delta.pct.toFixed(0)}%` : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
