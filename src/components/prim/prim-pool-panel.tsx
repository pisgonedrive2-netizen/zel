"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy, TrendingUp, Wallet, Users, Eye, ShieldCheck, Zap,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, RotateCcw,
  LineChart as LineChartIcon, SlidersHorizontal, Layers, Gauge, Target,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useStore } from "@/store/store";
import { shiftCalendarMonthYm, toYearMonthLocal } from "@/lib/data";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { shortMonthLabel } from "@/lib/calendar-months";
import {
  buildPrimBaseInputs,
  computePrimPool,
  computeWithScenario,
  computeAllScenarios,
  viewershipHistory,
  monthProgress,
  DEFAULT_BRAND_FEE_USD,
  DEFAULT_GUARANTEED_VIEWS,
  FAIR_PRIM_CONFIG,
  DEFAULT_SCENARIOS,
  PRIM_MODEL_LABELS,
  PRIM_BASE_MODE_LABELS,
  PRIM_VIEW_BONUS_LABELS,
  PRIM_DISTRIBUTION_LABELS,
  fmtPrimUsd,
  type PrimPoolConfig,
  type PrimModel,
  type PrimBaseMode,
  type PrimViewBonusMode,
  type PrimDistributionMode,
  type PrimScenario,
  type PrimPoolResult,
} from "@/lib/prim-pool";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput, Select } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
}

const BRAND_COLORS = ["#F59E0B", "#3B82F6", "#8B5CF6", "#22C55E", "#EF4444", "#EC4899", "#06B6D4"];

/**
 * Prim ayarları yalnızca ana yöneticinin tarayıcısında saklanır (localStorage).
 * Sunucuya / Supabase'e yazılmaz; marka panellerini hiçbir şekilde etkilemez.
 */
const PRIM_STORAGE_KEY = "prim-pool-settings-v1";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

/** Çarpanı hem yüzde hem sayı (×) olarak göster: 0.18 → "+%18 · 1.18×" */
function multLabel(mult: number) {
  return `+%${Math.round(mult * 100)} · ${(1 + mult).toFixed(2)}×`;
}

// ── Küçük stat kartı ─────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, tone = "default", icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "green" | "amber" | "rose" | "blue";
  icon: React.ComponentType<{ className?: string; size?: number }>;
}) {
  const tones = {
    default: "border-border",
    green: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
  };
  return (
    <Card className={cn("py-3", tones[tone])}>
      <CardContent className="px-4 py-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon size={18} className="shrink-0 text-muted-foreground/60 mt-0.5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Slider satırı ─────────────────────────────────────────────────────────────
function SliderRow({
  label, value, min, max, step = 1, suffix = "", accent = "amber", asMultiplier = false, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  accent?: "amber" | "emerald" | "blue" | "rose";
  /** value bir yüzde çarpanıysa, yanında x sayısını da göster (120% · 1.20×). */
  asMultiplier?: boolean;
  onChange: (v: number) => void;
}) {
  const accents = {
    amber: "accent-amber-500",
    emerald: "accent-emerald-500",
    blue: "accent-blue-500",
    rose: "accent-rose-500",
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-foreground/80">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {value}{suffix}
          {asMultiplier && <span className="ml-1 text-muted-foreground font-normal">· {(value / 100).toFixed(2)}×</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("w-full", accents[accent])}
      />
    </div>
  );
}

export function PrimPoolPanel() {
  const {
    brands, brandLinks, linkSnapshots, employees,
    advances, salaryExtras, paymentStatuses,
    contentExpenses, expenses,
  } = useStore();

  const [month, setMonth] = useState(() => toYearMonthLocal(new Date()));
  const [tab, setTab] = useState("ozet");
  const [brandFees, setBrandFees] = useState<Record<string, number>>({});
  const [brandGuarantees, setBrandGuarantees] = useState<Record<string, number>>({});
  const [recipientWeights, setRecipientWeights] = useState<Record<string, number>>({});
  const [config, setConfig] = useState<PrimPoolConfig>(FAIR_PRIM_CONFIG);

  // Özel senaryo çarpanları
  const [customScn, setCustomScn] = useState({ revenue: 100, expense: 100, views: 100 });

  // Ayarları yalnızca bu tarayıcıya kalıcı yaz (özel & marka panellerinden bağımsız).
  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(PRIM_STORAGE_KEY) : null;
      if (raw) {
        const s = JSON.parse(raw) as Partial<{
          brandFees: Record<string, number>;
          brandGuarantees: Record<string, number>;
          recipientWeights: Record<string, number>;
          config: PrimPoolConfig;
        }>;
        if (s.brandFees) setBrandFees(s.brandFees);
        if (s.brandGuarantees) setBrandGuarantees(s.brandGuarantees);
        if (s.recipientWeights) setRecipientWeights(s.recipientWeights);
        if (s.config) setConfig({ ...FAIR_PRIM_CONFIG, ...s.config });
      }
    } catch {
      // bozuk kayıt — yok say
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PRIM_STORAGE_KEY,
        JSON.stringify({ brandFees, brandGuarantees, recipientWeights, config })
      );
    } catch {
      // kota dolu vb. — yok say
    }
  }, [brandFees, brandGuarantees, recipientWeights, config]);

  const storeArgs = {
    monthYm: month,
    brands, brandLinks, linkSnapshots, employees,
    advances, salaryExtras, paymentStatuses, contentExpenses, expenses,
    brandFees, brandGuarantees, recipientWeights, config,
  };

  const base = useMemo(() => buildPrimBaseInputs(storeArgs), [
    month, brands, brandLinks, linkSnapshots, employees, advances, salaryExtras,
    paymentStatuses, contentExpenses, expenses, brandFees, brandGuarantees, recipientWeights, config,
  ]);

  const result = useMemo(() => computePrimPool({
    monthYm: base.monthYm,
    brands: base.brands,
    brandFees: base.brandFees,
    brandGuarantees: base.brandGuarantees,
    brandViews: base.brandViews,
    payrollUsd: base.payrollUsd,
    contentExpenseUsd: base.contentExpenseUsd,
    generalExpenseUsd: base.generalExpenseUsd,
    recipients: base.recipients,
    config,
  }), [base, config]);

  const progress = useMemo(() => monthProgress(month), [month]);
  const projected = useMemo(() => {
    if (progress >= 1 || progress <= 0) return null;
    const scn: PrimScenario = {
      key: "proj", label: "Projeksiyon", description: "",
      revenueMultiplier: 1, expenseMultiplier: 1, viewsMultiplier: 1 / progress,
    };
    return computeWithScenario(base, scn);
  }, [base, progress]);

  const scenarios = useMemo(() => computeAllScenarios(base), [base]);
  const customResult = useMemo(() => computeWithScenario(base, {
    key: "custom", label: "Özel", description: "",
    revenueMultiplier: customScn.revenue / 100,
    expenseMultiplier: customScn.expense / 100,
    viewsMultiplier: customScn.views / 100,
  }), [base, customScn]);

  const history = useMemo(
    () => viewershipHistory(month, brands, brandLinks, linkSnapshots).map((h) => ({ ...h, label: shortMonthLabel(h.ym) })),
    [month, brands, brandLinks, linkSnapshots]
  );
  const activeBrands = useMemo(() => brands.filter((b) => b.status === "active"), [brands]);

  const setBrandFee = (id: string, v: number) => setBrandFees((p) => ({ ...p, [id]: v }));
  const setBrandGuarantee = (id: string, v: number) => setBrandGuarantees((p) => ({ ...p, [id]: v }));
  const setWeight = (id: string, v: number) => setRecipientWeights((p) => ({ ...p, [id]: v }));
  const resetAll = () => {
    setBrandFees({});
    setBrandGuarantees({});
    setRecipientWeights({});
    setConfig(FAIR_PRIM_CONFIG);
    setCustomScn({ revenue: 100, expense: 100, views: 100 });
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(PRIM_STORAGE_KEY);
    } catch {
      // yok say
    }
  };

  return (
    <div className="space-y-4">
      {/* Başlık + ay */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Trophy size={22} className="text-amber-500" />
            Prim Havuzu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Marka tahsilatı − operasyon gideri = net havuz · model, izlenme tetikleyici ve senaryolarla özelleştirilebilir prim
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={resetAll}>
            <RotateCcw size={13} /> Sıfırla
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(shiftCalendarMonthYm(month, -1))}>
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-semibold tabular-nums">{monthLabel(month)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(shiftCalendarMonthYm(month, 1))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Üst özet kartlar — her sekmede görünür */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Marka geliri" value={fmtPrimUsd(result.totalRevenueUsd)} sub={`${result.brandRows.length} marka`} icon={Wallet} tone="green" />
        <StatCard label="Operasyon gideri" value={fmtPrimUsd(result.totalOpsUsd)} sub="Bordro+içerik+genel" icon={TrendingUp} tone="rose" />
        <StatCard label="Net havuz" value={fmtPrimUsd(result.netPoolUsd)} sub={`− Rezerv ${fmtPrimUsd(result.reserveUsd)}`} icon={ShieldCheck} tone={result.netPoolUsd >= 0 ? "default" : "rose"} />
        <StatCard label="Dağıtılabilir" value={fmtPrimUsd(result.distributablePoolUsd)} sub="Rezerv sonrası" icon={Layers} tone="default" />
        <StatCard label="Toplam prim" value={fmtPrimUsd(result.totalPrimUsd)} sub={`Yük ${pct(result.primLoadPct)} · ${result.config.basePrimMode === "fixed" ? "sabit" : PRIM_MODEL_LABELS[result.config.model]}`} icon={Trophy} tone="amber" />
        <StatCard label="Prim sonrası net" value={fmtPrimUsd(result.netAfterPrimUsd)} sub="Ajansta kalan" icon={Gauge} tone="blue" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ozet" className="gap-1.5"><Layers size={14} /> Özet</TabsTrigger>
          <TabsTrigger value="izlenme" className="gap-1.5"><Eye size={14} /> İzlenmeler</TabsTrigger>
          <TabsTrigger value="senaryo" className="gap-1.5"><Target size={14} /> Senaryolar</TabsTrigger>
          <TabsTrigger value="kurallar" className="gap-1.5"><SlidersHorizontal size={14} /> Kurallar & Dağıtım</TabsTrigger>
        </TabsList>

        {/* ── ÖZET ───────────────────────────────────────────────────────── */}
        <TabsContent value="ozet" className="mt-4 space-y-4">
          <ViewTriggerBanner result={result} />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Wallet size={16} /> Gelir & gider akışı</CardTitle>
                <CardDescription>Net havuz = marka geliri − operasyon gideri</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.brandRows.map((row) => (
                  <div key={row.brandId} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <BrandLogo brandId={row.brandId} title={row.brandName} className="h-6 w-6 shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{row.shortName}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{fmtCompactViews(row.actualViews)} izl.</span>
                    <span className="text-sm font-semibold tabular-nums w-20 text-right">{fmtPrimUsd(row.monthlyFeeUsd)}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5 text-xs">
                  <Row label="Marka geliri (brüt)" value={fmtPrimUsd(result.totalRevenueUsd)} strong />
                  <Row label="− Bordro (net)" value={fmtPrimUsd(result.payrollUsd)} negative />
                  <Row label="− İçerik harcamaları" value={fmtPrimUsd(result.contentExpenseUsd)} negative />
                  <Row label="− Genel giderler" value={fmtPrimUsd(result.generalExpenseUsd)} negative />
                  <Row label="= Net havuz" value={fmtPrimUsd(result.netPoolUsd)} strong tone={result.netPoolUsd < 0 ? "rose" : undefined} />
                  <Row label="− Rezerv (gelecek ay & sürpriz gider)" value={fmtPrimUsd(result.reserveUsd)} negative />
                  <Row label="= Dağıtılabilir havuz" value={fmtPrimUsd(result.distributablePoolUsd)} strong />
                  <Row
                    label={`− Prim (${result.config.basePrimMode === "fixed" ? "sabit tutar" : PRIM_MODEL_LABELS[result.config.model]})`}
                    value={fmtPrimUsd(result.totalPrimUsd)}
                    negative
                  />
                  {result.cappedAmountUsd > 1 && (
                    <Row label="  ↳ tavanla kırpılan" value={`− ${fmtPrimUsd(result.cappedAmountUsd)}`} />
                  )}
                  <Row label="= Prim sonrası net" value={fmtPrimUsd(result.netAfterPrimUsd)} strong tone={result.netAfterPrimUsd < 0 ? "rose" : "green"} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Users size={16} /> Dağıtım ({result.recipients.length})</CardTitle>
                <CardDescription>{PRIM_DISTRIBUTION_LABELS[result.config.distributionMode]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                {result.recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Bu ay bordrolu yayıncı/moderatör yok.</p>
                ) : (
                  result.recipients.map((r) => (
                    <div key={r.employeeId} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{r.kind} · pay {pct(r.sharePct)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums">{fmtPrimUsd(r.totalUsd)}</p>
                        {r.viewBonusUsd > 0 && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">+{fmtPrimUsd(r.viewBonusUsd)} izlenme</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── İZLENMELER ─────────────────────────────────────────────────── */}
        <TabsContent value="izlenme" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Toplam izlenme" value={fmtCompactViews(result.totalActualViews)} sub={`Garanti ${fmtCompactViews(result.totalGuaranteedViews)}`} icon={Eye} tone="blue" />
            <StatCard label="Garanti aşımı" value={pct(result.totalOverPct)} sub={result.viewTriggered ? "Hedef aşıldı" : "Hedef altı"} icon={Target} tone={result.viewTriggered ? "green" : "amber"} />
            <StatCard label="Ortalama CPM" value={`$${result.blendedCpmUsd.toFixed(2)}`} sub="1000 izlenme / gelir" icon={Gauge} />
            <StatCard label="İzlenme primi" value={fmtPrimUsd(result.viewBonusUsd)} sub={result.viewBonusMultiplier > 0 ? multLabel(result.viewBonusMultiplier) : PRIM_VIEW_BONUS_LABELS[result.config.viewBonusMode]} icon={Zap} tone="amber" />
          </div>

          {/* Projeksiyon */}
          {projected && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <LineChartIcon size={20} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Ay sonu projeksiyonu · {pct(progress)} tamamlandı</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mevcut hız korunursa ay sonu ≈ {fmtCompactViews(projected.totalActualViews)} izlenme · tahmini prim {fmtPrimUsd(projected.totalPrimUsd)}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Trophy size={12} /> {fmtPrimUsd(projected.totalPrimUsd)}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* 12 ay trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><LineChartIcon size={16} /> Son 12 ay izlenme trendi</CardTitle>
              <CardDescription>Aktif markaların toplam aylık izlenmesi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="primViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => fmtCompactViews(Number(v))} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
                    <RTooltip
                      formatter={(v) => [fmtCompactViews(Number(v)), "İzlenme"]}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="views" stroke="#F59E0B" strokeWidth={2} fill="url(#primViews)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Marka bazlı bu ay + CPM tablosu */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Marka bazlı izlenme ({monthLabel(month)})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.brandRows.map((r) => ({ name: r.shortName, views: r.actualViews, guarantee: r.guaranteedViews }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => fmtCompactViews(Number(v))} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
                      <RTooltip
                        formatter={(v, n) => [fmtCompactViews(Number(v)), n === "views" ? "İzlenme" : "Garanti"]}
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                        {result.brandRows.map((r, i) => (
                          <Cell key={r.brandId} fill={r.triggered ? "#22C55E" : BRAND_COLORS[i % BRAND_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Marka CPM & hedef durumu</CardTitle>
                <CardDescription>Düşük CPM = daha verimli izlenme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.brandRows.map((r) => (
                  <div key={r.brandId} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                    <BrandLogo brandId={r.brandId} title={r.brandName} className="h-6 w-6 shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{r.shortName}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-24 text-right">
                      {fmtCompactViews(r.actualViews)} / {fmtCompactViews(r.guaranteedViews)}
                    </span>
                    <Badge variant={r.triggered ? "default" : "outline"} className="shrink-0 text-[10px] tabular-nums">
                      ${r.cpmUsd.toFixed(2)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── SENARYOLAR ─────────────────────────────────────────────────── */}
        <TabsContent value="senaryo" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Target size={16} /> Hazır senaryolar</CardTitle>
              <CardDescription>Gelir / gider / izlenme çarpanlarıyla öngörülen prim</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {scenarios.map(({ scenario, result: r }) => {
                  const isBase = scenario.key === "base";
                  return (
                    <div key={scenario.key} className={cn(
                      "rounded-xl border p-3 flex flex-col gap-2",
                      isBase ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{scenario.label}</span>
                        {isBase && <Badge variant="outline" className="text-[9px]">Gerçek</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug min-h-[28px]">{scenario.description}</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">Gelir {scenario.revenueMultiplier.toFixed(2)}× · %{Math.round(scenario.revenueMultiplier * 100)}</span>
                        <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-medium text-rose-600 dark:text-rose-400 tabular-nums">Gider {scenario.expenseMultiplier.toFixed(2)}×</span>
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400 tabular-nums">İzl {scenario.viewsMultiplier.toFixed(2)}×</span>
                      </div>
                      <div className="mt-1 space-y-1 text-[11px]">
                        <div className="flex justify-between"><span className="text-muted-foreground">Gelir</span><span className="tabular-nums">{fmtPrimUsd(r.totalRevenueUsd)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Net havuz</span><span className={cn("tabular-nums", r.netPoolUsd < 0 && "text-rose-500")}>{fmtPrimUsd(r.netPoolUsd)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">İzlenme</span><span className="tabular-nums">{fmtCompactViews(r.totalActualViews)}</span></div>
                      </div>
                      <div className="mt-1 pt-2 border-t border-border/60">
                        <p className="text-[10px] text-muted-foreground">Toplam prim</p>
                        <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtPrimUsd(r.totalPrimUsd)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Özel senaryo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><SlidersHorizontal size={16} /> Özel senaryo (ne olursa?)</CardTitle>
              <CardDescription>Çarpanları kaydır, öngörülen prim anında güncellensin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
                <div className="space-y-4">
                  <SliderRow label="Gelir çarpanı" value={customScn.revenue} min={50} max={200} suffix="%" accent="emerald" asMultiplier onChange={(v) => setCustomScn((s) => ({ ...s, revenue: v }))} />
                  <SliderRow label="Gider çarpanı" value={customScn.expense} min={50} max={200} suffix="%" accent="rose" asMultiplier onChange={(v) => setCustomScn((s) => ({ ...s, expense: v }))} />
                  <SliderRow label="İzlenme çarpanı" value={customScn.views} min={30} max={300} suffix="%" accent="blue" asMultiplier onChange={(v) => setCustomScn((s) => ({ ...s, views: v }))} />
                  <div className="flex gap-2 flex-wrap pt-1">
                    {DEFAULT_SCENARIOS.map((s) => (
                      <Button key={s.key} variant="outline" size="sm" className="h-7 text-[11px]"
                        onClick={() => setCustomScn({ revenue: Math.round(s.revenueMultiplier * 100), expense: Math.round(s.expenseMultiplier * 100), views: Math.round(s.viewsMultiplier * 100) })}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex flex-col justify-center gap-2">
                  <Row label="Gelir" value={fmtPrimUsd(customResult.totalRevenueUsd)} />
                  <Row label="Operasyon" value={fmtPrimUsd(customResult.totalOpsUsd)} negative />
                  <Row label="Net havuz" value={fmtPrimUsd(customResult.netPoolUsd)} tone={customResult.netPoolUsd < 0 ? "rose" : undefined} />
                  <Row label="İzlenme" value={fmtCompactViews(customResult.totalActualViews)} />
                  <div className="mt-1 pt-2 border-t border-amber-500/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Öngörülen toplam prim</p>
                    <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtPrimUsd(customResult.totalPrimUsd)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Prim sonrası net {fmtPrimUsd(customResult.netAfterPrimUsd)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── KURALLAR & DAĞITIM ─────────────────────────────────────────── */}
        <TabsContent value="kurallar" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Model & oranlar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Zap size={16} /> Prim modeli & oranlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <LabeledSelect label="Temel prim belirleme" value={config.basePrimMode ?? "fixed"}
                    options={Object.entries(PRIM_BASE_MODE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    onChange={(v) => setConfig((c) => ({ ...c, basePrimMode: v as PrimBaseMode }))} />
                  <LabeledSelect label="Havuz modeli (oran modu)" value={config.model ?? "net_share"}
                    options={Object.entries(PRIM_MODEL_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    onChange={(v) => setConfig((c) => ({ ...c, model: v as PrimModel }))} />
                  <LabeledSelect label="İzlenme primi" value={config.viewBonusMode ?? "multiplier"}
                    options={Object.entries(PRIM_VIEW_BONUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    onChange={(v) => setConfig((c) => ({ ...c, viewBonusMode: v as PrimViewBonusMode }))} />
                  <LabeledSelect label="Dağıtım" value={config.distributionMode ?? "weighted"}
                    options={Object.entries(PRIM_DISTRIBUTION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    onChange={(v) => setConfig((c) => ({ ...c, distributionMode: v as PrimDistributionMode }))} />
                </div>

                {/* Sabit tutar modu — önce belirlenen prim havuzu */}
                {config.basePrimMode === "fixed" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-medium text-foreground/90">Sabit prim havuzu (bu ay dağıtılacak)</label>
                      <span className="text-[10px] text-muted-foreground">dağıtılabilir ≤ {fmtPrimUsd(result.distributablePoolUsd)}</span>
                    </div>
                    <NumberInput value={config.fixedPrimUsd ?? 0} onChange={(v) => setConfig((c) => ({ ...c, fixedPrimUsd: v }))} min={0} step={500} className="h-9" />
                    {(config.fixedPrimUsd ?? 0) > result.distributablePoolUsd && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Belirlenen tutar dağıtılabilir havuzu aşıyor; otomatik {fmtPrimUsd(result.distributablePoolUsd)} ile sınırlandı.
                      </p>
                    )}
                  </div>
                )}

                {/* Oran modu — modele göre yüzdeler */}
                {config.basePrimMode === "rate" && (config.model === "net_share" || config.model === "hybrid") && (
                  <SliderRow label="Net havuz payı oranı" value={Math.round((config.basePrimRate) * 100)} min={5} max={50} suffix="%" accent="amber"
                    onChange={(v) => setConfig((c) => ({ ...c, basePrimRate: v / 100 }))} />
                )}
                {config.basePrimMode === "rate" && (config.model === "revenue_share" || config.model === "hybrid") && (
                  <SliderRow label="Brüt gelir payı oranı" value={Math.round((config.revenueShareRate ?? 0.05) * 100)} min={1} max={25} suffix="%" accent="emerald"
                    onChange={(v) => setConfig((c) => ({ ...c, revenueShareRate: v / 100 }))} />
                )}

                {config.viewBonusMode === "multiplier" && (
                  <>
                    <SliderRow label="İzlenme tetik adımı (/%10 aşım)" value={Math.round((config.viewTriggerStepRate) * 100)} min={0} max={25} suffix="%" accent="blue"
                      onChange={(v) => setConfig((c) => ({ ...c, viewTriggerStepRate: v / 100 }))} />
                    <SliderRow label="Tetik tavanı (max ek)" value={Math.round((config.viewTriggerCap) * 100)} min={0} max={100} suffix="%" accent="blue"
                      onChange={(v) => setConfig((c) => ({ ...c, viewTriggerCap: v / 100 }))} />
                  </>
                )}
                {config.viewBonusMode === "cpm" && (
                  <SliderRow label="Garanti üstü CPM bonusu ($/1000 izlenme)" value={config.viewCpmBonusUsd ?? 2} min={0} max={20} suffix=" $" accent="blue"
                    onChange={(v) => setConfig((c) => ({ ...c, viewCpmBonusUsd: v }))} />
                )}

                <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
                  <strong>Sabit tutar:</strong> ay için önce bir prim havuzu belirlersin, o dağıtılır (dağıtılabilir havuzu aşamaz — ajans güvenli).
                  <strong> Oran modu:</strong> net havuz/gelirin yüzdesi otomatik hesaplanır. İzlenme primi çarpan (×) ya da CPM ($/1000) olarak eklenir.
                </p>
              </CardContent>
            </Card>

            {/* Marka ücret & garanti */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Wallet size={16} /> Marka ücret & garanti</CardTitle>
                <CardDescription>Markaların ödediği tutarı buradan güncelle · özel & markaya yansımaz · ref. $10.000 · 1M izlenme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-1">
                  <span className="flex-1">Marka</span>
                  <span className="w-24 text-center">Ücret $</span>
                  <span className="w-24 text-center">Garanti izl.</span>
                </div>
                {activeBrands.map((b) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <BrandLogo brandId={b.id} title={b.name} className="h-6 w-6 shrink-0" />
                      <span className="text-sm font-medium truncate">{b.shortName}</span>
                    </div>
                    <div className="w-24">
                      <NumberInput value={brandFees[b.id] ?? DEFAULT_BRAND_FEE_USD} onChange={(v) => setBrandFee(b.id, v)} min={0} step={500} className="h-8 text-xs" />
                    </div>
                    <div className="w-24">
                      <NumberInput value={brandGuarantees[b.id] ?? DEFAULT_GUARANTEED_VIEWS} onChange={(v) => setBrandGuarantee(b.id, v)} min={0} step={100000} className="h-8 text-xs" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Rezerv & adalet tavanları */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={16} /> Rezerv & adalet tavanları</CardTitle>
              <CardDescription>Her ay gelir olmayabilir / sürpriz giderler çıkabilir — önce ayır, sonra dağıt. Tavanlar aşırı yüksek primi engeller.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
              <SliderRow label="Rezerv oranı (net havuzdan ayrılır)" value={Math.round((config.reserveRate ?? 0) * 100)} min={0} max={60} suffix="%" accent="rose"
                onChange={(v) => setConfig((c) => ({ ...c, reserveRate: v / 100 }))} />
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-foreground/80">Sabit aylık rezerv (sürpriz gider tamponu) $</label>
                <NumberInput value={config.monthlyReserveUsd ?? 0} onChange={(v) => setConfig((c) => ({ ...c, monthlyReserveUsd: v }))} min={0} step={1000} className="h-9" />
              </div>
              <SliderRow label="Net havuz tabanı (altında prim yok)" value={Math.round((config.minNetFloorUsd ?? 0) / 1000)} min={0} max={50} suffix="K $" accent="rose"
                onChange={(v) => setConfig((c) => ({ ...c, minNetFloorUsd: v * 1000 }))} />
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-foreground/80">Kişi başı azami prim (0 = sınırsız) $</label>
                <NumberInput value={config.maxPrimPerPersonUsd ?? 0} onChange={(v) => setConfig((c) => ({ ...c, maxPrimPerPersonUsd: v }))} min={0} step={500} className="h-9" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-foreground/80">Toplam prim tavanı (0 = sınırsız) $</label>
                <NumberInput value={config.maxTotalPrimUsd ?? 0} onChange={(v) => setConfig((c) => ({ ...c, maxTotalPrimUsd: v }))} min={0} step={1000} className="h-9" />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] space-y-1 self-end">
                <div className="flex justify-between"><span className="text-muted-foreground">Net havuz</span><span className="tabular-nums font-medium">{fmtPrimUsd(result.netPoolUsd)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">− Rezerv</span><span className="tabular-nums text-rose-500">{fmtPrimUsd(result.reserveUsd)}</span></div>
                <div className="flex justify-between border-t border-border/60 pt-1"><span className="text-muted-foreground">= Dağıtılabilir</span><span className="tabular-nums font-semibold">{fmtPrimUsd(result.distributablePoolUsd)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Kişi ağırlıkları */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users size={16} /> Kişi ağırlıkları & dağıtım</CardTitle>
              <CardDescription>Ağırlığı değiştirerek dağılımı özelleştir · {PRIM_DISTRIBUTION_LABELS[result.config.distributionMode]}</CardDescription>
            </CardHeader>
            <CardContent>
              {base.recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Bu ay bordrolu yayıncı/moderatör yok.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.recipients.map((r) => (
                    <div key={r.employeeId} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{r.kind} · pay {pct(r.sharePct)} · {fmtPrimUsd(r.totalUsd)}</p>
                      </div>
                      <div className="w-20 shrink-0">
                        <NumberInput value={Number(r.weight.toFixed(2))} onChange={(v) => setWeight(r.employeeId, v)} min={0} step={0.05} className="h-8 text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-center">
        Yalnızca ana yönetici (Orkun) tarafından görülebilir. Marka ücretleri, garantiler ve tüm prim ayarları
        <strong> yalnızca bu tarayıcıya</strong> kaydedilir — sunucuya yazılmaz ve marka panellerine yansımaz.
      </p>
    </div>
  );
}

// ── Yardımcı satır ─────────────────────────────────────────────────────────
function Row({
  label, value, strong, negative, tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  tone?: "green" | "rose";
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={cn("text-muted-foreground", strong && "font-semibold text-foreground")}>{label}</span>
      <span className={cn(
        "tabular-nums font-medium",
        strong ? "text-foreground font-bold" : "text-foreground",
        negative && "text-rose-500/90",
        tone === "green" && "text-emerald-600 dark:text-emerald-400",
        tone === "rose" && "text-rose-500",
      )}>{value}</span>
    </div>
  );
}

function LabeledSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <Select options={options} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
    </div>
  );
}

// ── İzlenme tetik banner ─────────────────────────────────────────────────────
function ViewTriggerBanner({ result }: { result: PrimPoolResult }) {
  return (
    <Card className={cn(result.viewTriggered ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
      <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        {result.viewTriggered ? (
          <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
        ) : (
          <AlertTriangle size={20} className="text-amber-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {result.viewTriggered ? "İzlenme hedefi aşıldı — performans primi aktif" : "İzlenme hedefi henüz aşılmadı"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Toplam {fmtCompactViews(result.totalActualViews)} / {fmtCompactViews(result.totalGuaranteedViews)} garanti
            {result.viewTriggered && ` · +%${Math.round(result.totalOverPct * 100)} aşım`}
            {result.viewBonusMultiplier > 0 && ` · prim çarpanı ${multLabel(result.viewBonusMultiplier)}`}
          </p>
        </div>
        <Badge variant={result.viewTriggered ? "default" : "outline"} className="shrink-0">
          <Eye size={12} className="mr-1" />
          {result.viewTriggered ? `+${fmtPrimUsd(result.viewBonusUsd)} bonus` : "Tetiklenmedi"}
        </Badge>
      </CardContent>
    </Card>
  );
}
