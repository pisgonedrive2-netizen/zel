"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  BarChart3,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowDownUp,
  Users,
  UserPlus,
  Coins,
  Target,
  Megaphone,
  Gauge,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useStore } from "@/store/store";
import { sumBrandContentExpensesForMonth } from "@/lib/brand-month-metrics";
import { BrandLogo } from "@/components/brand-logo";
import { BrandMonthlyStatsPanel } from "@/components/brand-monthly-stats-panel";
import { BrandMonthlyTrend } from "@/components/brand-monthly-trend";
import { MarkaMonthNav } from "@/components/marka-month-nav";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { markaHref } from "@/lib/use-marka-view-month";
import {
  findBrandMonthlyStats,
  brandStatsExportRows,
  deriveBrandMonthlyStats,
  deriveLiveDemoUsage,
  hasBrandMonthlyStatsData,
  fmtBrandMoney,
  fmtBrandCount,
} from "@/lib/brand-monthly-stats";
import {
  deriveIgamingMetrics,
  generateOperationInsights,
  previousMonthYm,
  computeDelta,
  fmtPct,
  fmtMultiplier,
  IGAMING_LABELS,
  IGAMING_HINTS,
  type MetricDelta,
  type InsightTone,
} from "@/lib/brand-igaming-metrics";
import {
  downloadBrandOperationPdf,
  downloadBrandOperationCsv,
  type BrandOperationPdfInput,
} from "@/lib/marka-izlenme-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkaContentOverviewCard } from "@/components/marka/marka-content-overview-card";
import { MarkaAchievementPanel } from "@/components/marka/marka-achievement-panel";
import { BrandRiskSummary } from "@/components/marka-igaming/brand-risk-summary";
import { useBrandIgaming } from "@/hooks/use-brand-igaming";

export default function MarkaOperasyonPage() {
  const {
    brandMonthlyStats,
    brands,
    contentExpenses,
    weekBrandReels,
    brandPosts,
    brandLinks,
    brandDeals,
  } = useStore();
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, navMonth, canViewBrand, monthTitle, isAdminView } = portal;
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const izlenmeHref = markaHref("/marka/izlenmeler", month);
  const [granularity, setGranularity] = useState<"monthly" | "weekly" | "daily">("monthly");
  const { compliance } = useBrandIgaming(brandId, month);

  const statsRow = brandId
    ? findBrandMonthlyStats(brandMonthlyStats, brandId, month)
    : undefined;
  const hasStats = statsRow ? hasBrandMonthlyStatsData(statsRow) : false;

  const monthExpense = brand
    ? sumBrandContentExpensesForMonth(contentExpenses, brand, month, brands)
    : 0;

  // Önceki ay verisi (MoM karşılaştırma için).
  const prevMonth = previousMonthYm(month);
  const prevStatsRow = brandId
    ? findBrandMonthlyStats(brandMonthlyStats, brandId, prevMonth)
    : undefined;
  const prevHasStats = prevStatsRow ? hasBrandMonthlyStatsData(prevStatsRow) : false;
  const prevMonthExpense = useMemo(
    () =>
      brand ? sumBrandContentExpensesForMonth(contentExpenses, brand, prevMonth, brands) : 0,
    [brand, contentExpenses, prevMonth, brands]
  );

  const metrics = useMemo(
    () => (statsRow ? deriveIgamingMetrics(statsRow, monthExpense) : null),
    [statsRow, monthExpense]
  );
  const prevMetrics = useMemo(
    () => (prevStatsRow && prevHasStats ? deriveIgamingMetrics(prevStatsRow, prevMonthExpense) : null),
    [prevStatsRow, prevHasStats, prevMonthExpense]
  );
  const liveDemo = statsRow ? deriveLiveDemoUsage(statsRow) : null;

  const riskSignals = useMemo(() => {
    if (!metrics || !prevMetrics) return { depositSpike: false, withdrawalSpike: false };
    const depDelta = computeDelta(metrics.totalDeposit, prevMetrics.totalDeposit);
    const wdrDelta = computeDelta(metrics.totalWithdrawal, prevMetrics.totalWithdrawal);
    return {
      depositSpike: depDelta?.pct != null && depDelta.pct >= 40,
      withdrawalSpike: wdrDelta?.pct != null && wdrDelta.pct >= 40,
    };
  }, [metrics, prevMetrics]);

  const insights = useMemo(
    () => (metrics && liveDemo ? generateOperationInsights(metrics, prevMetrics, liveDemo) : []),
    [metrics, prevMetrics, liveDemo]
  );

  const storeSlice = useMemo(
    () => ({ weekBrandReels, brandPosts, brandLinks, brandDeals }),
    [weekBrandReels, brandPosts, brandLinks, brandDeals]
  );

  const buildOperationExport = (): BrandOperationPdfInput | null => {
    if (!brand || !brandId) return null;
    const row = findBrandMonthlyStats(brandMonthlyStats, brandId, month);
    const operationStats = row
      ? brandStatsExportRows(row, deriveBrandMonthlyStats(row))
      : [];
    if (monthExpense > 0) {
      operationStats.push({
        label: "İçerik harcaması (pay)",
        value: `$${monthExpense.toLocaleString("tr-TR")}`,
      });
    }
    return {
      brandFullName: brand.name,
      monthYm: month,
      monthTitle,
      operationStats,
    };
  };

  const doExport = (kind: "pdf" | "csv") => {
    const p = buildOperationExport();
    if (!p) return;
    if (kind === "pdf") downloadBrandOperationPdf(p, brand?.shortName);
    else downloadBrandOperationCsv(p, brand?.shortName);
  };

  const cur = metrics?.currency ?? "USD";

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
        <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
                <h1 className="text-xl font-semibold text-foreground">{brand.name} · Operasyon özeti</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                iGaming operasyon panosu — kayıt, FTD, yatırım/çekim, dönüşüm ve canlı demo bütçesi, ay bazında.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                İzlenme ve link verileri için{" "}
                <Link href={izlenmeHref} className="text-primary underline">
                  İzlenmeler
                </Link>{" "}
                sayfasına gidin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => doExport("pdf")}
                disabled={!hasStats && monthExpense <= 0}
                title={hasStats || monthExpense > 0 ? undefined : "Önce bu ay için veri kaydedin"}
              >
                <Download size={14} /> PDF indir
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => doExport("csv")}
                disabled={!hasStats && monthExpense <= 0}
              >
                <FileSpreadsheet size={14} /> CSV
              </Button>
            </div>
          </div>

          <MarkaMonthNav month={month} onPrev={() => navMonth(-1)} onNext={() => navMonth(1)} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Granülarite:{" "}
              <span className="font-medium text-foreground">
                {granularity === "monthly" ? "Aylık" : granularity === "weekly" ? "Haftalık" : "Günlük"}
              </span>
              {granularity !== "monthly" && (
                <span className="ml-1 text-muted-foreground/80">
                  (brand_player_events API hazır olunca aktif)
                </span>
              )}
            </p>
            <div className="flex rounded-lg border border-border p-0.5">
              {(
                [
                  ["monthly", "Aylık"],
                  ["weekly", "Haftalık"],
                  ["daily", "Günlük"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={granularity === value ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setGranularity(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BrandRiskSummary
              complianceChecks={compliance}
              depositSpike={riskSignals.depositSpike}
              withdrawalSpike={riskSignals.withdrawalSpike}
            />
            {statsRow && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">iGaming derinlik</CardTitle>
                  <CardDescription>
                    GGR, NGR, aktif oyuncu ve bonus maliyeti — {monthTitle}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <DepthStat
                      label="GGR"
                      value={fmtBrandMoney(statsRow.ggr ?? 0, cur)}
                      delta={computeDelta(statsRow.ggr ?? 0, prevStatsRow?.ggr)}
                    />
                    <DepthStat
                      label="NGR"
                      value={fmtBrandMoney(statsRow.ngr ?? 0, cur)}
                      delta={computeDelta(statsRow.ngr ?? 0, prevStatsRow?.ngr)}
                    />
                    <DepthStat
                      label="Aktif oyuncu"
                      value={fmtBrandCount(statsRow.activePlayers ?? 0)}
                      delta={computeDelta(statsRow.activePlayers ?? 0, prevStatsRow?.activePlayers)}
                    />
                    <DepthStat
                      label="Bonus maliyeti"
                      value={fmtBrandMoney(statsRow.bonusCost ?? 0, cur)}
                      delta={computeDelta(statsRow.bonusCost ?? 0, prevStatsRow?.bonusCost)}
                      invertDelta
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <MarkaContentOverviewCard
            brandId={brandId}
            brandName={brand.name}
            monthYm={month}
            monthTitle={monthTitle}
            storeSlice={storeSlice}
          />

          <MarkaAchievementPanel
            brandId={brandId}
            brandName={brand.name}
            monthYm={month}
            defaultOpen={false}
            title="Paylaşım takvimi (detay)"
          />

          {hasStats && metrics ? (
            <>
              <KpiGrid
                metrics={metrics}
                prevMetrics={prevMetrics}
                monthTitle={monthTitle}
                prevAvailable={prevHasStats}
              />

              {liveDemo && (statsRow!.liveDemoAllocated > 0 || statsRow!.liveDemoRemaining > 0) && (
                <LiveDemoCard
                  allocated={statsRow!.liveDemoAllocated}
                  remaining={statsRow!.liveDemoRemaining}
                  usage={liveDemo}
                  currency={cur}
                  notes={statsRow!.liveDemoNotes}
                />
              )}

              <InsightsCard insights={insights} />
            </>
          ) : (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={16} className="text-violet-700 dark:text-violet-300" />
                  {monthTitle} için operasyon verisi yok
                </CardTitle>
                <CardDescription>
                  {readOnly
                    ? "Bu ay için henüz veri girilmemiş. Veriler yönetici tarafından girildikten sonra KPI'lar ve içgörüler burada görünecek."
                    : "Aşağıdaki formu doldurup kaydedin; KPI grid'i, aylık karşılaştırma ve otomatik içgörüler otomatik oluşturulur. Ardından PDF/CSV ile paylaşabilirsiniz."}
                </CardDescription>
              </CardHeader>
              {monthExpense > 0 && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Bu ay markaya yazılan içerik/pazarlama harcaması:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      ${monthExpense.toLocaleString("tr-TR")}
                    </span>
                  </p>
                </CardContent>
              )}
            </Card>
          )}

          <BrandMonthlyStatsPanel brandId={brandId} monthYm={month} readOnly={readOnly} />

          <BrandMonthlyTrend brandId={brandId} monthYm={month} months={6} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rapor içeriği</CardTitle>
              <CardDescription>PDF ve CSV dosyalarında yer alan metrikler</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Kayıt olan üye sayısı ve yeni kayıt → yatırım dönüşümü</li>
                <li>Yatırım yapan üye, ilk yatırım (FTD) ve FTD dönüşümü</li>
                <li>Toplam yatırım, çekim, net yatırım (GGR göstergesi) ve çekim oranı</li>
                <li>ARPU, üye başı yatırım adedi ve pazarlama verimliliği</li>
                <li>Canlı demo tahsis, kalan ve kullanım</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </MarkaPageGuard>
  );
}

/* ---------- KPI grid ---------- */

function KpiGrid({
  metrics: m,
  prevMetrics: prev,
  monthTitle,
  prevAvailable,
}: {
  metrics: ReturnType<typeof deriveIgamingMetrics>;
  prevMetrics: ReturnType<typeof deriveIgamingMetrics> | null;
  monthTitle: string;
  prevAvailable: boolean;
}) {
  const cur = m.currency;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge size={16} className="text-violet-700 dark:text-violet-300" />
              Operasyon KPI'ları · {monthTitle}
            </CardTitle>
            <CardDescription>
              {prevAvailable
                ? "Ok işaretleri bir önceki aya göre değişimi gösterir."
                : "Bir önceki ay verisi bulunmadığı için karşılaştırma gösterilemiyor (—)."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiTile
            icon={Coins}
            accent="emerald"
            label={IGAMING_LABELS.netDeposit}
            hint={IGAMING_HINTS.netDeposit}
            value={fmtBrandMoney(m.netDeposit, cur)}
            negative={m.netDeposit < 0}
            delta={computeDelta(m.netDeposit, prev?.netDeposit)}
          />
          <KpiTile
            icon={TrendingUp}
            accent="blue"
            label={IGAMING_LABELS.totalDeposit}
            value={fmtBrandMoney(m.totalDeposit, cur)}
            delta={computeDelta(m.totalDeposit, prev?.totalDeposit)}
          />
          <KpiTile
            icon={TrendingDown}
            accent="amber"
            label={IGAMING_LABELS.totalWithdrawal}
            value={fmtBrandMoney(m.totalWithdrawal, cur)}
            delta={computeDelta(m.totalWithdrawal, prev?.totalWithdrawal)}
            invertDelta
          />
          <KpiTile
            icon={ArrowDownUp}
            accent="slate"
            label={IGAMING_LABELS.withdrawalRatio}
            hint={IGAMING_HINTS.withdrawalRatio}
            value={fmtPct(m.withdrawalRatioPct, 0)}
            delta={computeDelta(m.withdrawalRatioPct, prev?.withdrawalRatioPct)}
            invertDelta
            deltaUnit="pp"
          />
          <KpiTile
            icon={Target}
            accent="violet"
            label={IGAMING_LABELS.ftd}
            value={fmtBrandCount(m.ftd)}
            delta={computeDelta(m.ftd, prev?.ftd)}
          />
          <KpiTile
            icon={Target}
            accent="violet"
            label={IGAMING_LABELS.ftdConversion}
            hint={IGAMING_HINTS.ftdConversion}
            value={fmtPct(m.ftdConversionPct)}
            delta={computeDelta(m.ftdConversionPct, prev?.ftdConversionPct)}
            deltaUnit="pp"
          />
          <KpiTile
            icon={Users}
            accent="blue"
            label={IGAMING_LABELS.depositingMembers}
            value={fmtBrandCount(m.depositingMembers)}
            delta={computeDelta(m.depositingMembers, prev?.depositingMembers)}
          />
          <KpiTile
            icon={UserPlus}
            accent="blue"
            label={IGAMING_LABELS.newRegistrations}
            value={fmtBrandCount(m.newRegistrations)}
            delta={computeDelta(m.newRegistrations, prev?.newRegistrations)}
          />
          <KpiTile
            icon={Target}
            accent="emerald"
            label={IGAMING_LABELS.registrationToDeposit}
            hint={IGAMING_HINTS.registrationToDeposit}
            value={fmtPct(m.registrationToDepositPct)}
            delta={computeDelta(m.registrationToDepositPct, prev?.registrationToDepositPct)}
            deltaUnit="pp"
          />
          <KpiTile
            icon={Coins}
            accent="emerald"
            label={IGAMING_LABELS.arpu}
            hint={IGAMING_HINTS.arpu}
            value={m.arpu != null ? fmtBrandMoney(m.arpu, cur) : "—"}
            delta={computeDelta(m.arpu, prev?.arpu)}
          />
          <KpiTile
            icon={ArrowDownUp}
            accent="slate"
            label={IGAMING_LABELS.depositsPerMember}
            hint={IGAMING_HINTS.depositsPerMember}
            value={m.depositsPerMember != null ? m.depositsPerMember.toFixed(1) : "—"}
            delta={computeDelta(m.depositsPerMember, prev?.depositsPerMember)}
          />
          <KpiTile
            icon={Megaphone}
            accent="amber"
            label={IGAMING_LABELS.monthExpense}
            value={m.monthExpense > 0 ? `$${m.monthExpense.toLocaleString("tr-TR")}` : "—"}
            delta={computeDelta(m.monthExpense, prev?.monthExpense)}
            invertDelta
          />
        </div>

        {m.marketingEfficiency != null && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Megaphone size={15} className="text-amber-700 dark:text-amber-300" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {IGAMING_LABELS.marketingEfficiency}
                </p>
                <p className="text-xs text-muted-foreground">{IGAMING_HINTS.marketingEfficiency}</p>
              </div>
            </div>
            <p
              className={`text-xl font-bold tabular-nums ${
                m.marketingEfficiency >= 1
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {fmtMultiplier(m.marketingEfficiency)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ACCENTS: Record<string, string> = {
  emerald: "text-emerald-700 dark:text-emerald-300",
  blue: "text-blue-700 dark:text-blue-300",
  amber: "text-amber-700 dark:text-amber-300",
  violet: "text-violet-700 dark:text-violet-300",
  slate: "text-slate-700 dark:text-slate-300",
};

function KpiTile({
  icon: Icon,
  accent,
  label,
  hint,
  value,
  delta,
  negative,
  invertDelta,
  deltaUnit,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent: keyof typeof ACCENTS | string;
  label: string;
  hint?: string;
  value: string;
  delta?: MetricDelta | null;
  /** Değerin kendisi olumsuz mu (kırmızı). */
  negative?: boolean;
  /** Artışın olumsuz sayıldığı metrikler (çekim, harcama, çekim oranı). */
  invertDelta?: boolean;
  /** "pp" → yüzde puan farkı; aksi halde yüzde değişim. */
  deltaUnit?: "pp" | "pct";
}) {
  const accentClass = ACCENTS[accent] ?? ACCENTS.slate;
  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Icon size={11} className={accentClass} />
        <span className="truncate" title={hint ?? label}>
          {label}
        </span>
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p
          className={`text-lg font-bold tabular-nums ${
            negative ? "text-red-700 dark:text-red-300" : "text-foreground"
          }`}
        >
          {value}
        </p>
        <DeltaBadge delta={delta} invert={invertDelta} unit={deltaUnit} />
      </div>
    </div>
  );
}

function DeltaBadge({
  delta,
  invert,
  unit = "pct",
}: {
  delta?: MetricDelta | null;
  invert?: boolean;
  unit?: "pp" | "pct";
}) {
  if (!delta) {
    return <span className="text-[11px] text-muted-foreground tabular-nums">—</span>;
  }
  if (delta.direction === "flat") {
    return (
      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
        <Minus size={11} /> 0
      </span>
    );
  }
  // İyi yön: normalde artış iyi; invert ise azalış iyi.
  const isGood = invert ? delta.direction === "down" : delta.direction === "up";
  const Icon = delta.direction === "up" ? TrendingUp : TrendingDown;
  const color = isGood
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-red-700 dark:text-red-300";
  const label =
    unit === "pp"
      ? delta.pct != null
        ? `${delta.diff >= 0 ? "+" : ""}${delta.diff.toFixed(1)}pp`
        : "—"
      : delta.pct != null
        ? `${delta.pct >= 0 ? "+" : ""}${delta.pct.toFixed(0)}%`
        : "—";
  return (
    <span className={`text-[11px] font-medium inline-flex items-center gap-0.5 tabular-nums ${color}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function DepthStat({
  label,
  value,
  delta,
  invertDelta,
}: {
  label: string;
  value: string;
  delta?: MetricDelta | null;
  invertDelta?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="text-lg font-bold tabular-nums">{value}</p>
        <DeltaBadge delta={delta} invert={invertDelta} />
      </div>
    </div>
  );
}

/* ---------- Live demo budget ---------- */

function LiveDemoCard({
  allocated,
  remaining,
  usage,
  currency,
  notes,
}: {
  allocated: number;
  remaining: number;
  usage: ReturnType<typeof deriveLiveDemoUsage>;
  currency: "TRY" | "USD" | "EUR";
  notes: string;
}) {
  const pct = usage.usedPct ?? 0;
  const remainingPct = allocated > 0 ? Math.max(0, Math.min(100, (remaining / allocated) * 100)) : 0;
  return (
    <Card
      className={
        usage.low
          ? "border-red-200/70 bg-red-50/30 dark:border-red-500/40 dark:bg-red-950/20"
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet size={16} className="text-violet-700 dark:text-violet-300" />
          Canlı / demo bütçe kullanımı
        </CardTitle>
        <CardDescription>Canlı yayın demo oyun bakiyesinin aylık kullanımı</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <BudgetStat label="Tahsis" value={fmtBrandMoney(allocated, currency)} accent="text-foreground" />
          <BudgetStat
            label="Kullanılan"
            value={fmtBrandMoney(usage.used, currency)}
            accent="text-amber-700 dark:text-amber-300"
          />
          <BudgetStat
            label="Kalan"
            value={fmtBrandMoney(remaining, currency)}
            accent={
              usage.low
                ? "text-red-700 dark:text-red-300"
                : "text-emerald-700 dark:text-emerald-300"
            }
          />
        </div>

        <div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                usage.low ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>Kullanım: {usage.usedPct != null ? `%${usage.usedPct.toFixed(0)}` : "—"}</span>
            <span>Kalan: %{remainingPct.toFixed(0)}</span>
          </div>
        </div>

        {usage.low && (
          <div className="flex items-start gap-2 rounded-md border border-red-200/70 bg-red-50/50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>Demo bakiyesi %20'nin altında — yeni tahsis planlanması önerilir.</span>
          </div>
        )}

        {notes.trim() && (
          <p className="text-xs text-muted-foreground border-t border-border/60 pt-2">
            <span className="font-medium text-foreground">Not: </span>
            {notes.trim()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md border border-border/80 bg-muted/25 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}

/* ---------- Insights ---------- */

const TONE_STYLES: Record<InsightTone, { icon: React.ComponentType<{ className?: string; size?: number }>; badge: string; badgeText: string }> = {
  positive: {
    icon: CheckCircle2,
    badge: "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200",
    badgeText: "Olumlu",
  },
  warning: {
    icon: AlertTriangle,
    badge: "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200",
    badgeText: "Dikkat",
  },
  neutral: {
    icon: Info,
    badge: "border-border bg-muted text-muted-foreground",
    badgeText: "Bilgi",
  },
};

function InsightsCard({ insights }: { insights: { tone: InsightTone; text: string }[] }) {
  if (insights.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-600 dark:text-amber-300" />
          Operasyon içgörüleri / uyarılar
        </CardTitle>
        <CardDescription>Bu ayın metriklerinden otomatik üretilen değerlendirmeler</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {insights.map((ins, i) => {
            const style = TONE_STYLES[ins.tone];
            const Icon = style.icon;
            return (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-md border border-border/60 bg-card px-3 py-2"
              >
                <Icon
                  size={15}
                  className={`mt-0.5 shrink-0 ${
                    ins.tone === "positive"
                      ? "text-emerald-600 dark:text-emerald-300"
                      : ins.tone === "warning"
                        ? "text-amber-600 dark:text-amber-300"
                        : "text-muted-foreground"
                  }`}
                />
                <span className="text-sm text-foreground flex-1">{ins.text}</span>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${style.badge}`}>
                  {style.badgeText}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
