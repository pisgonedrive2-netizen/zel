"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy, TrendingUp, Wallet, Users, Eye, ShieldCheck, Zap,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, RotateCcw,
  LineChart as LineChartIcon, SlidersHorizontal, Layers, Gauge, Target,
  Plus, Trash2, Copy, EyeOff, Eye as EyeIcon, Repeat,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useStore } from "@/store/store";
import { sumKasaDisplayBalances } from "@/lib/kasa-tron-metrics";
import { useUiPrefs } from "@/store/ui-prefs";
import { isPayrollActive, isPrimEligible } from "@/lib/payroll-utils";
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
  describePrimBaseSource,
  buildPrimRules,
  buildPrimScenarioGuide,
  describePrimFormula,
  describeViewPoolBonusRules,
  DEFAULT_BRAND_FEE_USD,
  DEFAULT_GUARANTEED_VIEWS,
  FAIR_PRIM_CONFIG,
  DEFAULT_SCENARIOS,
  PRIM_MODEL_LABELS,
  PRIM_BASE_MODE_LABELS,
  PRIM_VIEW_BONUS_LABELS,
  PRIM_DISTRIBUTION_LABELS,
  PRIM_QUALITY_PRESETS,
  PRIM_SYSTEM_PRESETS,
  PRIM_BASE_NET_BASIS_LABELS,
  fmtPrimUsd,
  type PrimSystemPreset,
  type PrimPoolConfig,
  type PrimModel,
  type PrimBaseMode,
  type PrimViewBonusMode,
  type PrimDistributionMode,
  type PrimScenario,
  type PrimPoolResult,
  type PrimRecipientMeta,
  type PrimCustomRecipient,
  type PrimManualExpense,
  type PrimRuleLine,
  type PrimScenarioRow,
} from "@/lib/prim-pool";
import {
  defaultPrimStoredSettings,
  loadPrimStoredSettings,
  patchMonthSlice,
  resolveMonthSlice,
  savePrimStoredSettings,
  type PrimBrandMeta,
  type PrimCustomBrand,
  type PrimStoredSettings,
} from "@/lib/prim-settings-storage";
import { PrimDistributionPanel } from "@/components/prim/prim-distribution-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput, Select, Input, Textarea } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
}

const BRAND_COLORS = ["#F59E0B", "#3B82F6", "#8B5CF6", "#22C55E", "#EF4444", "#EC4899", "#06B6D4"];

function defaultBrandMeta(): PrimBrandMeta {
  return { autoRepeatFee: true, autoRepeatGuarantee: true };
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function multLabel(mult: number) {
  return `+%${Math.round(mult * 100)} · ${(1 + mult).toFixed(2)}×`;
}

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
    contentExpenses, expenses, kasas, kasaTransactions,
  } = useStore();

  const [month, setMonth] = useState(() => toYearMonthLocal(new Date()));
  const [tab, setTab] = useState("ozet");
  const simpleView = useUiPrefs((s) => s.primSimpleView);
  const togglePrimSimpleView = useUiPrefs((s) => s.togglePrimSimpleView);
  // Basit görünümde gelişmiş sekmeler gizli; açık sekme onlardan biriyse Özet'e dön.
  useEffect(() => {
    if (simpleView && (tab === "senaryo" || tab === "kurallar" || tab === "dagitim")) setTab("ozet");
  }, [simpleView, tab]);
  const storedRef = useRef<PrimStoredSettings>(defaultPrimStoredSettings());
  const [brandFees, setBrandFees] = useState<Record<string, number>>({});
  const [brandGuarantees, setBrandGuarantees] = useState<Record<string, number>>({});
  const [recipientWeights, setRecipientWeights] = useState<Record<string, number>>({});
  const [recipientPoints, setRecipientPoints] = useState<Record<string, number>>({});
  const [recipientQuality, setRecipientQuality] = useState<Record<string, number>>({});
  const [config, setConfig] = useState<PrimPoolConfig>(FAIR_PRIM_CONFIG);
  const [brandMeta, setBrandMeta] = useState<Record<string, PrimBrandMeta>>({});
  const [customBrands, setCustomBrands] = useState<PrimCustomBrand[]>([]);
  const [recipientMeta, setRecipientMeta] = useState<Record<string, PrimRecipientMeta>>({});
  const [customRecipients, setCustomRecipients] = useState<PrimCustomRecipient[]>([]);
  const [autoRepeatToNextMonth, setAutoRepeatToNextMonth] = useState(true);
  const [newCustomName, setNewCustomName] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonNick, setNewPersonNick] = useState("");
  const [newPersonKind, setNewPersonKind] = useState("streamer");
  const [newPersonPoints, setNewPersonPoints] = useState(1);
  const [newExpenseLabel, setNewExpenseLabel] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState(0);

  const [customScn, setCustomScn] = useState({ revenue: 100, expense: 100, views: 100 });

  const hydrated = useRef(false);

  const applyMonthSlice = (settings: PrimStoredSettings, ym: string) => {
    const slice = resolveMonthSlice(settings, ym);
    setBrandFees(slice.brandFees);
    setBrandGuarantees(slice.brandGuarantees);
    setRecipientWeights(slice.recipientWeights);
    setRecipientPoints(slice.recipientPoints);
    setRecipientQuality(slice.recipientQuality);
    setConfig(slice.config);
    setBrandMeta(settings.brandMeta);
    setCustomBrands(settings.customBrands);
    setRecipientMeta(settings.recipientMeta);
    setCustomRecipients(settings.customRecipients);
    setAutoRepeatToNextMonth(settings.autoRepeatToNextMonth);
  };

  const commitSettings = (patch: {
    brandFees?: Record<string, number>;
    brandGuarantees?: Record<string, number>;
    recipientWeights?: Record<string, number>;
    recipientPoints?: Record<string, number>;
    recipientQuality?: Record<string, number>;
    config?: PrimPoolConfig;
    brandMeta?: Record<string, PrimBrandMeta>;
    customBrands?: PrimCustomBrand[];
    recipientMeta?: Record<string, PrimRecipientMeta>;
    customRecipients?: PrimCustomRecipient[];
    autoRepeatToNextMonth?: boolean;
  }) => {
    const nextFees = patch.brandFees ?? brandFees;
    const nextGuarantees = patch.brandGuarantees ?? brandGuarantees;
    const nextWeights = patch.recipientWeights ?? recipientWeights;
    const nextPoints = patch.recipientPoints ?? recipientPoints;
    const nextQuality = patch.recipientQuality ?? recipientQuality;
    const nextConfig = patch.config ?? config;
    const nextMeta = patch.brandMeta ?? brandMeta;
    const nextCustom = patch.customBrands ?? customBrands;
    const nextRecMeta = patch.recipientMeta ?? recipientMeta;
    const nextCustomRec = patch.customRecipients ?? customRecipients;
    const nextAuto = patch.autoRepeatToNextMonth ?? autoRepeatToNextMonth;

    if (patch.brandFees) setBrandFees(patch.brandFees);
    if (patch.brandGuarantees) setBrandGuarantees(patch.brandGuarantees);
    if (patch.recipientWeights) setRecipientWeights(patch.recipientWeights);
    if (patch.recipientPoints) setRecipientPoints(patch.recipientPoints);
    if (patch.recipientQuality) setRecipientQuality(patch.recipientQuality);
    if (patch.config) setConfig(patch.config);
    if (patch.brandMeta) setBrandMeta(patch.brandMeta);
    if (patch.customBrands) setCustomBrands(patch.customBrands);
    if (patch.recipientMeta) setRecipientMeta(patch.recipientMeta);
    if (patch.customRecipients) setCustomRecipients(patch.customRecipients);
    if (patch.autoRepeatToNextMonth !== undefined) setAutoRepeatToNextMonth(patch.autoRepeatToNextMonth);

    if (!hydrated.current) return;

    let nextStored = patchMonthSlice(storedRef.current, month, {
      brandFees: nextFees,
      brandGuarantees: nextGuarantees,
      recipientWeights: nextWeights,
      recipientPoints: nextPoints,
      recipientQuality: nextQuality,
      config: nextConfig,
    });
    nextStored = {
      ...nextStored,
      brandMeta: nextMeta,
      customBrands: nextCustom,
      recipientMeta: nextRecMeta,
      customRecipients: nextCustomRec,
      autoRepeatToNextMonth: nextAuto,
    };
    storedRef.current = nextStored;
    savePrimStoredSettings(nextStored);
  };

  useEffect(() => {
    const loaded = loadPrimStoredSettings();
    storedRef.current = loaded;
    applyMonthSlice(loaded, month);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    applyMonthSlice(storedRef.current, month);
  }, [month]);

  const activeBrands = useMemo(() => brands.filter((b) => b.status === "active"), [brands]);
  const primBrands = useMemo(() => {
    type Row = { id: string; name: string; shortName: string; isCustom: boolean };
    const rows: Row[] = activeBrands
      .filter((b) => !brandMeta[b.id]?.excluded)
      .map((b) => ({ id: b.id, name: b.name, shortName: b.shortName, isCustom: false }));
    for (const c of customBrands) {
      if (!brandMeta[c.id]?.excluded) {
        rows.push({ id: c.id, name: c.name, shortName: c.shortName, isCustom: true });
      }
    }
    return rows;
  }, [activeBrands, customBrands, brandMeta]);

  const brandsForCalc = useMemo(() => {
    const real = activeBrands.filter((b) => !brandMeta[b.id]?.excluded);
    const customAsBrand = customBrands
      .filter((c) => !brandMeta[c.id]?.excluded)
      .map((c) => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        category: "Planlama",
        status: "active" as const,
        notes: "Prim paneli özel marka",
      }));
    return [...real, ...customAsBrand];
  }, [activeBrands, customBrands, brandMeta]);

  // Ham ledger toplamı yerine TRON düzeltmeli gerçek kasa bakiyesi. Genel Kasa'daki
  // TRON ile finanse edilen giderler tek başına -24k gibi yanıltıcı bir negatif
  // gösterir; bu da senaryolarda "prim yok" izlenimi yaratıyordu.
  const kasaBalanceUsd = useMemo(
    () => sumKasaDisplayBalances(kasas, kasaTransactions),
    [kasas, kasaTransactions],
  );

  const storeArgs = useMemo(() => ({
    monthYm: month,
    brands: brandsForCalc,
    brandLinks,
    linkSnapshots,
    employees,
    advances,
    salaryExtras,
    paymentStatuses,
    contentExpenses,
    expenses,
    brandFees,
    brandGuarantees,
    recipientWeights,
    recipientPoints,
    recipientQuality,
    recipientMeta,
    customRecipients,
    kasaBalanceUsd,
    config,
  }), [
    month, brandsForCalc, brandLinks, linkSnapshots, employees, advances, salaryExtras,
    paymentStatuses, contentExpenses, expenses, brandFees, brandGuarantees, recipientWeights,
    recipientPoints, recipientQuality, recipientMeta, customRecipients, kasaBalanceUsd, config,
  ]);

  const base = useMemo(() => buildPrimBaseInputs(storeArgs), [storeArgs]);

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
    kasaBalanceUsd: base.kasaBalanceUsd,
    config,
  }), [base, config]);

  const primRules = useMemo(() => buildPrimRules(result), [result]);
  const primScenarios = useMemo(() => buildPrimScenarioGuide(result), [result]);
  const primFormula = useMemo(() => describePrimFormula(result), [result]);

  const primBaseLabel = useMemo(
    () => describePrimBaseSource(result, kasaBalanceUsd),
    [result, kasaBalanceUsd],
  );

  const payrollCandidates = useMemo(() => {
    const rows: { id: string; name: string; nickname?: string; kind: string; isCustom: boolean }[] = [];
    for (const e of employees) {
      if (e.kind === "coordinator" || !isPrimEligible(e, month)) continue;
      if (!recipientMeta[e.id]?.excluded) continue;
      rows.push({
        id: e.id,
        name: recipientMeta[e.id]?.name?.trim() || e.name,
        nickname: recipientMeta[e.id]?.nickname,
        kind: e.kind,
        isCustom: false,
      });
    }
    return rows;
  }, [employees, recipientMeta, month]);

  const excludedRecipients = useMemo(() => {
    const rows: { id: string; name: string; nickname?: string; kind: string; isCustom: boolean }[] = [];
    for (const e of employees) {
      if (e.kind === "coordinator" || !isPrimEligible(e, month)) continue;
      if (recipientMeta[e.id]?.excluded) {
        rows.push({
          id: e.id,
          name: recipientMeta[e.id]?.name?.trim() || e.name,
          nickname: recipientMeta[e.id]?.nickname,
          kind: e.kind,
          isCustom: false,
        });
      }
    }
    for (const c of customRecipients) {
      if (recipientMeta[c.id]?.excluded) {
        rows.push({
          id: c.id,
          name: recipientMeta[c.id]?.name?.trim() || c.name,
          nickname: recipientMeta[c.id]?.nickname ?? c.nickname,
          kind: c.kind,
          isCustom: true,
        });
      }
    }
    return rows;
  }, [employees, customRecipients, recipientMeta, month]);

  const progress = useMemo(() => monthProgress(month), [month]);
  const projected = useMemo(() => {
    if (progress >= 1 || progress <= 0) return null;
    const scn: PrimScenario = {
      key: "proj", label: "Projeksiyon", description: "Ay sonu run-rate",
      detail: "Mevcut izlenme hızı ay sonuna taşınır.",
      revenueMultiplier: 1, expenseMultiplier: 1, viewsMultiplier: 1 / progress,
    };
    return computeWithScenario(base, scn);
  }, [base, progress]);

  const scenarios = useMemo(() => computeAllScenarios(base), [base]);
  const customResult = useMemo(() => computeWithScenario(base, {
    key: "custom", label: "Özel", description: "Kaydırıcılarla özelleştirilmiş",
    detail: "Gelir, gider ve izlenme çarpanları elle ayarlanır.",
    revenueMultiplier: customScn.revenue / 100,
    expenseMultiplier: customScn.expense / 100,
    viewsMultiplier: customScn.views / 100,
  }), [base, customScn]);

  const history = useMemo(
    () => viewershipHistory(month, brandsForCalc, brandLinks, linkSnapshots).map((h) => ({ ...h, label: shortMonthLabel(h.ym) })),
    [month, brandsForCalc, brandLinks, linkSnapshots]
  );

  const setBrandFee = (id: string, v: number) =>
    commitSettings({ brandFees: { ...brandFees, [id]: v } });
  const setBrandGuarantee = (id: string, v: number) =>
    commitSettings({ brandGuarantees: { ...brandGuarantees, [id]: v } });
  const setWeight = (id: string, v: number) =>
    commitSettings({ recipientWeights: { ...recipientWeights, [id]: v } });
  const setPoints = (id: string, v: number) =>
    commitSettings({ recipientPoints: { ...recipientPoints, [id]: Math.max(0, Math.round(v * 100) / 100) } });
  const setQuality = (id: string, v: number) =>
    commitSettings({ recipientQuality: { ...recipientQuality, [id]: v } });
  const setRecipientField = (id: string, field: "name" | "nickname", value: string) => {
    const meta = recipientMeta[id] ?? {};
    commitSettings({ recipientMeta: { ...recipientMeta, [id]: { ...meta, [field]: value } } });
  };
  const includePayrollRecipient = (id: string) => {
    const meta = recipientMeta[id] ?? {};
    commitSettings({
      recipientMeta: { ...recipientMeta, [id]: { ...meta, excluded: false } },
      recipientPoints: { ...recipientPoints, [id]: recipientPoints[id] ?? 1 },
    });
  };
  const addCustomRecipient = () => {
    const name = newPersonName.trim();
    if (!name) return;
    const id = `prim-person-${crypto.randomUUID().slice(0, 8)}`;
    commitSettings({
      customRecipients: [...customRecipients, {
        id, name, nickname: newPersonNick.trim() || undefined, kind: newPersonKind,
      }],
      recipientPoints: { ...recipientPoints, [id]: Math.max(1, newPersonPoints) },
      recipientQuality: { ...recipientQuality, [id]: 1 },
    });
    setNewPersonName("");
    setNewPersonNick("");
    setNewPersonKind("streamer");
    setNewPersonPoints(1);
  };
  const applySystemPreset = (preset: PrimSystemPreset) => {
    commitSettings({ config: { ...FAIR_PRIM_CONFIG, ...preset.config } });
  };
  const removeCustomRecipient = (id: string) => {
    const nextPoints = { ...recipientPoints };
    const nextQuality = { ...recipientQuality };
    const nextMeta = { ...recipientMeta };
    delete nextPoints[id];
    delete nextQuality[id];
    delete nextMeta[id];
    commitSettings({
      customRecipients: customRecipients.filter((c) => c.id !== id),
      recipientPoints: nextPoints,
      recipientQuality: nextQuality,
      recipientMeta: nextMeta,
    });
  };
  const toggleRecipientExcluded = (id: string) => {
    const meta = recipientMeta[id] ?? {};
    commitSettings({ recipientMeta: { ...recipientMeta, [id]: { ...meta, excluded: !meta.excluded } } });
  };
  const manualExpenses = config.manualExpenses ?? [];
  const addManualExpense = () => {
    const label = newExpenseLabel.trim();
    if (!label || newExpenseAmount <= 0) return;
    const entry: PrimManualExpense = { id: `exp-${crypto.randomUUID().slice(0, 8)}`, label, amountUsd: newExpenseAmount };
    setConfigField({ manualExpenses: [...manualExpenses, entry] });
    setNewExpenseLabel("");
    setNewExpenseAmount(0);
  };
  const updateManualExpense = (id: string, patch: Partial<PrimManualExpense>) =>
    setConfigField({ manualExpenses: manualExpenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const removeManualExpense = (id: string) =>
    setConfigField({ manualExpenses: manualExpenses.filter((e) => e.id !== id) });
  const setConfigField = (patch: Partial<PrimPoolConfig>) =>
    commitSettings({ config: { ...config, ...patch } });
  const toggleBrandExcluded = (id: string) => {
    const meta = brandMeta[id] ?? defaultBrandMeta();
    commitSettings({ brandMeta: { ...brandMeta, [id]: { ...meta, excluded: !meta.excluded } } });
  };
  const copyPrevMonthFees = () => {
    const prev = resolveMonthSlice(storedRef.current, shiftCalendarMonthYm(month, -1));
    commitSettings({ brandFees: prev.brandFees, brandGuarantees: prev.brandGuarantees });
  };
  const addCustomBrand = () => {
    const name = newCustomName.trim();
    if (!name) return;
    const id = `prim-custom-${crypto.randomUUID().slice(0, 8)}`;
    const shortName = name.length > 12 ? `${name.slice(0, 10)}…` : name;
    commitSettings({
      customBrands: [...customBrands, { id, name, shortName }],
      brandFees: { ...brandFees, [id]: DEFAULT_BRAND_FEE_USD },
      brandGuarantees: { ...brandGuarantees, [id]: DEFAULT_GUARANTEED_VIEWS },
      brandMeta: { ...brandMeta, [id]: defaultBrandMeta() },
    });
    setNewCustomName("");
  };
  const removeCustomBrand = (id: string) => {
    const nextFees = { ...brandFees };
    const nextGuar = { ...brandGuarantees };
    const nextMeta = { ...brandMeta };
    delete nextFees[id];
    delete nextGuar[id];
    delete nextMeta[id];
    commitSettings({
      customBrands: customBrands.filter((c) => c.id !== id),
      brandFees: nextFees,
      brandGuarantees: nextGuar,
      brandMeta: nextMeta,
    });
  };
  const resetAll = () => {
    const fresh = defaultPrimStoredSettings();
    storedRef.current = fresh;
    applyMonthSlice(fresh, month);
    setCustomScn({ revenue: 100, expense: 100, views: 100 });
    savePrimStoredSettings(fresh);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("prim-pool-settings-v1");
      }
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
            Gelir − maaş − içerik kalanının %10&apos;u + link izlenmeleri → kişilere dağıtım
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={simpleView ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={togglePrimSimpleView}
            title={simpleView ? "Gelişmiş ayarları göster" : "Sadece özet & izlenmeleri göster"}
          >
            <SlidersHorizontal size={13} /> {simpleView ? "Basit görünüm" : "Detaylı görünüm"}
          </Button>
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
        <StatCard label="Giderler" value={fmtPrimUsd(result.totalOpsUsd)} sub={result.manualExpenseUsd > 0 ? "Bordro+içerik+genel+reklam" : "Bordro+içerik+genel"} icon={TrendingUp} tone="rose" />
        <StatCard label="Net kâr" value={fmtPrimUsd(result.netPoolUsd)} sub={`Sonraki aya ${fmtPrimUsd(result.reserveUsd)} ayrıldı`} icon={ShieldCheck} tone={result.netPoolUsd >= 0 ? "default" : "rose"} />
        <StatCard label="İzlenme" value={fmtCompactViews(result.totalActualViews)} sub={`Hedef ${fmtCompactViews(result.totalGuaranteedViews)}`} icon={Eye} tone={result.viewTriggered ? "green" : "amber"} />
        <StatCard
          label="Bu ay prim"
          value={fmtPrimUsd(result.totalPrimUsd)}
          sub={primFormula}
          icon={Trophy}
          tone="amber"
        />
        <StatCard label="Prim sonrası kâr" value={fmtPrimUsd(result.netAfterPrimUsd)} sub={`1 efektif puan = ${fmtPrimUsd(result.perPointUsd)}`} icon={Gauge} tone="blue" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ozet" className="gap-1.5"><Layers size={14} /> Özet</TabsTrigger>
          <TabsTrigger value="izlenme" className="gap-1.5"><Eye size={14} /> İzlenmeler</TabsTrigger>
          {!simpleView && <TabsTrigger value="senaryo" className="gap-1.5"><Target size={14} /> Senaryolar</TabsTrigger>}
          {!simpleView && <TabsTrigger value="kurallar" className="gap-1.5"><SlidersHorizontal size={14} /> Kurallar</TabsTrigger>}
          <TabsTrigger value="dagitim" className="gap-1.5"><Users size={14} /> Dağıtım</TabsTrigger>
        </TabsList>

        {/* ── ÖZET ───────────────────────────────────────────────────────── */}
        <TabsContent value="ozet" className="mt-4 space-y-4">
          <PrimRulesCard rules={primRules} formula={primFormula} />
          <PrimScenarioGuideCard scenarios={primScenarios} />
          <ViewTriggerBanner result={result} />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Wallet size={16} /> Gelir & gider akışı</CardTitle>
                <CardDescription>Marka geliri − maaş − içerik = kalan → %10 taban prim + izlenme</CardDescription>
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
                  <Row label="− Bordro (maaş)" value={fmtPrimUsd(result.payrollUsd)} negative />
                  <Row label="− İçerik ödemeleri" value={fmtPrimUsd(result.contentExpenseUsd)} negative />
                  <Row label="= Kalan (taban prim bazı)" value={fmtPrimUsd(result.payrollContentNetUsd)} strong />
                  <Row label="− Genel giderler" value={fmtPrimUsd(result.generalExpenseUsd)} negative />
                  {result.manualExpenseUsd > 0 && (
                    <Row label="− Reklam & elle eklenen giderler" value={fmtPrimUsd(result.manualExpenseUsd)} negative />
                  )}
                  <Row label="= Net kâr" value={fmtPrimUsd(result.netPoolUsd)} strong tone={result.netPoolUsd < 0 ? "rose" : undefined} />
                  <Row label="− Sonraki aya ayrılan" value={fmtPrimUsd(result.reserveUsd)} negative />
                  {result.viewPoolBonusUsd > 0 && (
                    <Row label="+ İzlenme havuz bonusu (her 1M = $100)" value={fmtPrimUsd(result.poolBonusUsd)} tone="green" />
                  )}
                  <Row label="= Dağıtılabilir kâr" value={fmtPrimUsd(result.distributablePoolUsd)} strong />
                  <Row label={`Taban prim (%${Math.round((config.basePrimRate ?? 0.1) * 100)} kalan)`} value={fmtPrimUsd(result.basePrimUsd)} />
                  {result.poolBonusUsd > 0 && (
                    <Row label="Havuz payı (izlenme)" value={fmtPrimUsd(result.poolBonusUsd)} tone="green" />
                  )}
                  {result.viewBonusUsd > 0 && (
                    <Row label="İzlenme bonusu" value={fmtPrimUsd(result.viewBonusUsd)} tone="green" />
                  )}
                  <Row label="= Bu ay toplam prim" value={fmtPrimUsd(result.totalPrimUsd)} strong />
                  {result.cappedAmountUsd > 1 && (
                    <Row label="  ↳ tavanla kırpılan" value={`− ${fmtPrimUsd(result.cappedAmountUsd)}`} />
                  )}
                  <Row label="= Prim sonrası kâr" value={fmtPrimUsd(result.netAfterPrimUsd)} strong tone={result.netAfterPrimUsd < 0 ? "rose" : "green"} />
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
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {r.kind}
                          {r.points !== Math.round(r.points) && <> · {r.points} puan (çıkış ayı oransal)</>}
                          {r.points === Math.round(r.points) && <> · {r.points} puan</>}
                          {r.qualityMultiplier !== 1 && <> × {r.qualityMultiplier} kalite</>}
                          {" "}· {r.effectivePoints} efektif · pay {pct(r.sharePct)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums">{fmtPrimUsd(r.totalUsd)}</p>
                        {r.poolShareUsd > 0 || r.viewBonusUsd > 0 ? (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            taban {fmtPrimUsd(r.baseShareUsd)}
                            {r.poolShareUsd > 0 && <> + havuz {fmtPrimUsd(r.poolShareUsd)}</>}
                            {r.viewBonusUsd > 0 && <> + izlenme {fmtPrimUsd(r.viewBonusUsd)}</>}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">taban prim</p>
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
              <CardDescription>
                Her senaryoda gelir, gider ve izlenme çarpanları uygulanır; prim{" "}
                <strong className="text-foreground">
                  {config.basePrimMode === "kasa_share"
                    ? `kasa bakiyesinin %${Math.round((config.basePrimRate ?? 0.12) * 100)}'i`
                    : config.basePrimMode === "fixed"
                      ? "dağıtılabilir havuz oranıyla (sabit tutar modunda önizleme)"
                      : `dağıtılabilir havuzun %${Math.round((config.basePrimRate ?? 0.15) * 100)}'i`}
                </strong>
                {" "}üzerinden hesaplanır — bu yüzden tutarlar senaryoya göre değişir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">Güncel kasa bakiyesi:</strong>{" "}
                  <span className="tabular-nums font-semibold text-foreground">{fmtPrimUsd(kasaBalanceUsd)}</span>
                  {" · "}
                  <strong className="text-foreground">Baz dağıtılabilir havuz:</strong>{" "}
                  <span className="tabular-nums">{fmtPrimUsd(result.distributablePoolUsd)}</span>
                </p>
                <p className="mt-1">
                  Baz ay prim formülü: <span className="text-foreground">{primBaseLabel}</span>
                  {result.viewTriggered && result.viewBonusUsd > 0 && (
                    <> + izlenme bonusu {fmtPrimUsd(result.viewBonusUsd)}</>
                  )}
                </p>
                <p className="mt-1.5 text-[11px]">
                  Senaryodaki tutar <strong className="text-foreground">o ay dağıtılacak toplam primdir</strong> (herkesin toplamı).
                  Her kişi bu toplamdan <strong className="text-foreground">puanı oranında</strong> pay alır — yani aynı tutar herkese
                  ayrı ayrı verilmez, puanlara bölünür. (Puanları &quot;Kurallar &amp; Dağıtım&quot; sekmesinden ayarla.)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {scenarios.map(({ scenario, result: r }) => {
                  const isBase = scenario.key === "base";
                  const primDelta = r.totalPrimUsd - result.totalPrimUsd;
                  const noPrim = r.totalPrimUsd <= 0 && r.netPoolUsd < (config.minNetFloorUsd ?? 0);
                  return (
                    <div
                      key={scenario.key}
                      className={cn(
                        "rounded-xl border p-3 flex flex-col gap-2.5",
                        isBase ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20" : "border-border bg-card",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold">{scenario.label}</span>
                          {isBase && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] align-middle">Gerçek veri</Badge>
                          )}
                        </div>
                        {!isBase && Math.abs(primDelta) >= 1 && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] tabular-nums shrink-0",
                              primDelta > 0 ? "text-emerald-600 border-emerald-500/30" : "text-rose-600 border-rose-500/30",
                            )}
                          >
                            {primDelta > 0 ? "+" : ""}{fmtPrimUsd(primDelta)}
                          </Badge>
                        )}
                      </div>

                      <p className="text-[11px] font-medium text-foreground/90 leading-snug">{scenario.description}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{scenario.detail}</p>

                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div className="rounded-md bg-emerald-500/10 px-1 py-1">
                          <p className="text-[8px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Gelir</p>
                          <p className="text-[10px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{scenario.revenueMultiplier.toFixed(2)}×</p>
                        </div>
                        <div className="rounded-md bg-rose-500/10 px-1 py-1">
                          <p className="text-[8px] uppercase tracking-wide text-rose-700 dark:text-rose-400">Gider</p>
                          <p className="text-[10px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">{scenario.expenseMultiplier.toFixed(2)}×</p>
                        </div>
                        <div className="rounded-md bg-blue-500/10 px-1 py-1">
                          <p className="text-[8px] uppercase tracking-wide text-blue-700 dark:text-blue-400">İzlenme</p>
                          <p className="text-[10px] font-semibold tabular-nums text-blue-700 dark:text-blue-300">{scenario.viewsMultiplier.toFixed(2)}×</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] border-t border-border/50 pt-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tahsilat</span>
                          <span className="tabular-nums font-medium">{fmtPrimUsd(r.totalRevenueUsd)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Operasyon</span>
                          <span className="tabular-nums text-rose-600 dark:text-rose-400">−{fmtPrimUsd(r.totalOpsUsd)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dağıtılabilir</span>
                          <span className={cn("tabular-nums font-medium", r.distributablePoolUsd <= 0 && "text-rose-500")}>
                            {fmtPrimUsd(r.distributablePoolUsd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">İzlenme</span>
                          <span className="tabular-nums">{fmtCompactViews(r.totalActualViews)}</span>
                        </div>
                      </div>

                      <div className="mt-auto pt-2 border-t border-border/60">
                        {noPrim ? (
                          <>
                            <p className="text-[10px] text-rose-600 dark:text-rose-400">Prim yok — net havuz tabanın altında</p>
                            <p className="text-lg font-bold tabular-nums text-muted-foreground">$0</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-muted-foreground">Öngörülen prim</p>
                            <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtPrimUsd(r.totalPrimUsd)}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">
                              Temel {fmtPrimUsd(r.basePrimUsd)}
                              {r.viewBonusUsd > 0 && <> + izlenme {fmtPrimUsd(r.viewBonusUsd)}</>}
                              {" · "}sonra net {fmtPrimUsd(r.netAfterPrimUsd)}
                            </p>
                          </>
                        )}
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

        {/* ── KURALLAR ───────────────────────────────────────────────────── */}
        <TabsContent value="kurallar" className="mt-4 space-y-4">
          <PrimSystemPresetsCard
            presets={PRIM_SYSTEM_PRESETS}
            activeKey={detectActivePresetKey(config)}
            onApply={applySystemPreset}
          />
          <PrimFlowSummary result={result} />
          <PrimScenarioGuideCard scenarios={primScenarios} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Model & oranlar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Zap size={16} /> Prim nasıl hesaplansın?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">3 adımda prim:</strong>
                  {" "}<strong className="text-foreground">1)</strong> Marka geliri − maaş − içerik = kalan.
                  {" "}<strong className="text-foreground">2)</strong> Kalanın %{Math.round((config.basePrimRate ?? 0.1) * 100)}&apos;u havuza + link izlenmeleri (her 1M = $100).
                  {" "}<strong className="text-foreground">3)</strong> Dağıtım sekmesinden kişi ekle/çıkar, puan × kalite ile böl.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <LabeledSelect label="Taban prim modu" value={config.basePrimMode ?? "rate"}
                    options={Object.entries(PRIM_BASE_MODE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    onChange={(v) => setConfigField({ basePrimMode: v as PrimBaseMode })} />
                  {config.basePrimMode === "rate" && (
                    <LabeledSelect label="Oran neye uygulansın?" value={config.basePrimNetBasis ?? "after_payroll_content"}
                      options={Object.entries(PRIM_BASE_NET_BASIS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                      onChange={(v) => setConfigField({ basePrimNetBasis: v as "after_payroll_content" | "distributable" })} />
                  )}
                  <LabeledSelect label="Kişilere bölüşüm" value={config.distributionMode ?? "weighted"}
                    options={Object.entries(PRIM_DISTRIBUTION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    onChange={(v) => setConfigField({ distributionMode: v as PrimDistributionMode })} />
                  <LabeledSelect label="Ek izlenme bonusu (opsiyonel)" value={config.viewBonusMode ?? "off"}
                    options={Object.entries(PRIM_VIEW_BONUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    onChange={(v) => setConfigField({ viewBonusMode: v as PrimViewBonusMode })} />
                  {config.basePrimMode === "rate" && (
                    <LabeledSelect label="Oran neye uygulansın?" value={config.model ?? "net_share"}
                      options={Object.entries(PRIM_MODEL_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                      onChange={(v) => setConfigField({ model: v as PrimModel })} />
                  )}
                </div>

                {/* Kasa payı modu — kasa bakiyesinin yüzdesi */}
                {config.basePrimMode === "kasa_share" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <label className="text-[12px] font-medium text-foreground/90 block">Kasanın yüzde kaçı prim olsun?</label>
                    <SliderRow
                      label="Oran"
                      value={Math.round((config.basePrimRate ?? 0.12) * 100)}
                      min={3}
                      max={40}
                      suffix="%"
                      accent="amber"
                      onChange={(v) => setConfigField({ basePrimRate: v / 100 })}
                    />
                    <div className="rounded-md bg-background/60 px-2.5 py-2 text-[11px] leading-relaxed">
                      Kasa bakiyesi <strong className="tabular-nums text-foreground">{fmtPrimUsd(kasaBalanceUsd)}</strong>
                      {" "}× %{Math.round((config.basePrimRate ?? 0.12) * 100)} ={" "}
                      <strong className="tabular-nums text-foreground">{fmtPrimUsd(kasaBalanceUsd * (config.basePrimRate ?? 0.12))}</strong>.
                      {" "}Net havuzu aşamayacağı için fiilî prim{" "}
                      <strong className="tabular-nums text-amber-600 dark:text-amber-400">{fmtPrimUsd(Math.min(kasaBalanceUsd * (config.basePrimRate ?? 0.12), result.distributablePoolUsd))}</strong>.
                      <br />
                      <span className="text-muted-foreground">
                        {fmtPrimUsd(kasaBalanceUsd)} = <strong>/kasa</strong> sayfasındaki tüm aktif hesapların şu anki toplam bakiyesi.
                        Bu rakam kafa karıştırıyorsa &quot;Bu ay dağıtılacak tutarı kendim yazarım&quot; modunu seç.
                      </span>
                    </div>
                  </div>
                )}

                {/* Sabit tutar modu — önce belirlenen prim havuzu */}
                {config.basePrimMode === "fixed" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <label className="text-[12px] font-medium text-foreground/90 block">Sabit minimal prim ($)</label>
                    <NumberInput value={config.fixedPrimUsd ?? 0} onChange={(v) => setConfigField({ fixedPrimUsd: v })} min={0} step={500} className="h-9" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Her ay dağıtılacak taban prim. Kişilere puana göre bölünür. Üst sınır: dağıtılabilir kâr{" "}
                      <strong className="text-foreground">{fmtPrimUsd(result.distributablePoolUsd)}</strong>.
                    </p>
                    {(config.fixedPrimUsd ?? 0) > result.distributablePoolUsd && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Yazdığın tutar bu sınırı aşıyor; otomatik {fmtPrimUsd(result.distributablePoolUsd)} ile sınırlandı.
                      </p>
                    )}
                  </div>
                )}

                {/* Oran modu — modele göre yüzdeler */}
                {config.basePrimMode === "rate" && (config.model === "net_share" || config.model === "hybrid" || !config.model) && (
                  <SliderRow label={`Kalan kârın yüzdesi (taban prim · şu an %${Math.round((config.basePrimRate) * 100)})`} value={Math.round((config.basePrimRate) * 100)} min={3} max={40} suffix="%" accent="amber"
                    onChange={(v) => setConfigField({ basePrimRate: v / 100 })} />
                )}
                {config.basePrimMode === "rate" && (config.model === "revenue_share" || config.model === "hybrid") && (
                  <SliderRow label="Brüt gelir payı oranı" value={Math.round((config.revenueShareRate ?? 0.05) * 100)} min={1} max={25} suffix="%" accent="emerald"
                    onChange={(v) => setConfigField({ revenueShareRate: v / 100 })} />
                )}

                {config.viewBonusMode === "multiplier" && (
                  <>
                    <SliderRow label="Garantiyi her %10 aştıkça primi şu kadar artır" value={Math.round((config.viewTriggerStepRate) * 100)} min={0} max={25} suffix="%" accent="blue"
                      onChange={(v) => setConfigField({ viewTriggerStepRate: v / 100 })} />
                    <SliderRow label="Bu artış en fazla şu kadar olsun (üst sınır)" value={Math.round((config.viewTriggerCap) * 100)} min={0} max={100} suffix="%" accent="blue"
                      onChange={(v) => setConfigField({ viewTriggerCap: v / 100 })} />
                  </>
                )}
                {config.viewBonusMode === "cpm" && (
                  <SliderRow label="Garanti üstü CPM bonusu ($/1000 izlenme)" value={config.viewCpmBonusUsd ?? 2} min={0} max={20} suffix=" $" accent="blue"
                    onChange={(v) => setConfigField({ viewCpmBonusUsd: v })} />
                )}

                {/* İzlenme havuz bonusu — eşik geçilince havuza ek para */}
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-[12px] font-medium text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.viewPoolBonusEnabled ?? false}
                      onChange={(e) => setConfigField({ viewPoolBonusEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <Eye size={13} /> İzlenme havuz bonusu (5M baraj + kademeli)
                  </label>
                  {config.viewPoolBonusEnabled && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted-foreground">Min. baraj (toplam izlenme)</label>
                          <NumberInput value={config.viewPoolBonusMinViews ?? 5_000_000} onChange={(v) => setConfigField({ viewPoolBonusMinViews: v })} min={0} step={500_000} className="h-8 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted-foreground">Adım boyutu (örn. 1M)</label>
                          <NumberInput value={config.viewPoolBonusThresholdViews ?? 1_000_000} onChange={(v) => setConfigField({ viewPoolBonusThresholdViews: v })} min={0} step={100_000} className="h-8 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted-foreground">1. kademe $/adım</label>
                          <NumberInput value={config.viewPoolBonusPerStepUsd ?? 125} onChange={(v) => setConfigField({ viewPoolBonusPerStepUsd: v })} min={0} step={25} className="h-8 text-xs" />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {describeViewPoolBonusRules({ ...result.config, ...config } as Required<PrimPoolConfig>)}
                        {" "}Bu ay {fmtCompactViews(result.totalActualViews)} →{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {result.viewPoolBonusSteps} adım = +{fmtPrimUsd(result.poolBonusUsd)}
                        </strong>
                        {result.viewPoolBonusBillableViews > 0 && (
                          <> (baraj sonrası {fmtCompactViews(result.viewPoolBonusBillableViews)})</>
                        )}
                        .
                      </p>
                    </>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
                  <strong>Kasa payı:</strong> kasanın belirlediğin yüzdesi prim havuzu olur (dağıtılabilir havuzu aşamaz).
                  <strong> Sabit tutar:</strong> ay için önce bir prim havuzu belirlersin.
                  <strong> Net havuz payı:</strong> dağıtılabilir havuzun yüzdesi otomatik hesaplanır.
                  İzlenme primi çarpan (×) ya da CPM ($/1000) olarak eklenir.
                  <strong> İzlenme havuz bonusu:</strong> belirlediğin izlenme eşiği geçildikçe havuza ekstra para eklenir.
                </p>
              </CardContent>
            </Card>

            {/* Marka ücret & garanti */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Wallet size={16} /> Marka ücret & garanti</CardTitle>
                <CardDescription>
                  {monthLabel(month)} ayı tahsilatları · yalnızca bu tarayıcıda · marka panellerine yansımaz
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={copyPrevMonthFees}>
                    <Copy size={12} /> Önceki ayı kopyala
                  </Button>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRepeatToNextMonth}
                      onChange={(e) => commitSettings({ autoRepeatToNextMonth: e.target.checked })}
                      className="rounded"
                    />
                    <Repeat size={12} /> Yeni ayda otomatik tekrarla
                  </label>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Toplam gelir: <strong className="text-foreground">{fmtPrimUsd(result.totalRevenueUsd)}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-1">
                  <span className="flex-1">Marka</span>
                  <span className="w-24 text-center">Ücret $</span>
                  <span className="w-24 text-center">Garanti izl.</span>
                  <span className="w-8" />
                </div>

                {primBrands.map((b) => (
                  <div key={b.id} className="flex items-start gap-2 rounded-lg border border-border/50 px-2 py-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {b.isCustom ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">P</span>
                      ) : (
                        <BrandLogo brandId={b.id} title={b.name} className="h-6 w-6 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{b.shortName}</span>
                        {brandMeta[b.id]?.notes && (
                          <span className="text-[10px] text-muted-foreground truncate block">{brandMeta[b.id]?.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-24">
                      <NumberInput value={brandFees[b.id] ?? DEFAULT_BRAND_FEE_USD} onChange={(v) => setBrandFee(b.id, v)} min={0} step={500} className="h-8 text-xs" />
                    </div>
                    <div className="w-24">
                      <NumberInput value={brandGuarantees[b.id] ?? DEFAULT_GUARANTEED_VIEWS} onChange={(v) => setBrandGuarantee(b.id, v)} min={0} step={100000} className="h-8 text-xs" />
                    </div>
                    <div className="w-8 flex flex-col gap-0.5">
                      {b.isCustom ? (
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeCustomBrand(b.id)} aria-label="Kaldır">
                          <Trash2 size={13} />
                        </Button>
                      ) : (
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleBrandExcluded(b.id)} aria-label="Hariç tut">
                          <EyeOff size={13} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {activeBrands.filter((b) => brandMeta[b.id]?.excluded).length > 0 && (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hariç tutulan</p>
                    {activeBrands.filter((b) => brandMeta[b.id]?.excluded).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleBrandExcluded(b.id)}
                      >
                        <EyeIcon size={12} /> {b.shortName} — tekrar dahil et
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Input
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    placeholder="Planlama markası adı (ör. yeni anlaşma)"
                    className="h-8 text-xs"
                  />
                  <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1" onClick={addCustomBrand}>
                    <Plus size={13} /> Ekle
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Referans: $10.000 / 1M izlenme. Özel markalar yalnızca prim hesabında görünür; izlenme verisi yoksa 0 sayılır.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Reklam & diğer giderler (elle) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} /> Reklam & diğer giderler (elle)</CardTitle>
              <CardDescription>
                Sisteme girilmeyen ek giderleri (reklam harcaması, hediye, özel ödeme vb.) buradan elle ekle.
                Bu tutarlar gelirden düşülür, böylece net havuz ve dağıtılacak prim doğru hesaplanır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {manualExpenses.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Henüz ek gider yok. Örn. &quot;Reklam — Mayıs kampanyası&quot;.</p>
              ) : (
                <div className="space-y-2">
                  {manualExpenses.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5">
                      <Input value={e.label} onChange={(ev) => updateManualExpense(e.id, { label: ev.target.value })} placeholder="Gider açıklaması" className="h-8 text-xs flex-1" />
                      <div className="w-28">
                        <NumberInput value={e.amountUsd} onChange={(v) => updateManualExpense(e.id, { amountUsd: v })} min={0} step={250} className="h-8 text-xs" />
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600 shrink-0" onClick={() => removeManualExpense(e.id)} aria-label="Sil">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-between text-[11px] pt-1 border-t border-border/60">
                    <span className="text-muted-foreground">Elle eklenen giderler toplamı</span>
                    <span className="tabular-nums font-semibold text-rose-600">−{fmtPrimUsd(result.manualExpenseUsd)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border/60">
                <Input value={newExpenseLabel} onChange={(e) => setNewExpenseLabel(e.target.value)} placeholder="Gider açıklaması (ör. reklam)" className="h-8 text-xs flex-1" />
                <div className="w-32">
                  <NumberInput value={newExpenseAmount} onChange={setNewExpenseAmount} min={0} step={250} className="h-8 text-xs" />
                </div>
                <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1" onClick={addManualExpense}>
                  <Plus size={13} /> Ekle
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rezerv & adalet tavanları */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={16} /> Rezerv (sonraki aya para ayırma) & tavanlar</CardTitle>
              <CardDescription>
                Önce kasada para bırak, kalanı prim olarak dağıt. &quot;Rezerv&quot; = bu aydan kenara ayırıp dağıtmadığın,
                gelecek ay (reklam, kuru ay, sürpriz gider) için sakladığın para. &quot;Havuz tabanı&quot; = net havuz bu tutarın
                altına düşerse o ay hiç prim dağıtılmaz. Tavanlar ise tek kişiye ya da toplamda aşırı prim çıkmasını engeller.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
                <SliderRow label="Sonraki aya ayır: net havuzun yüzdesi" value={Math.round((config.reserveRate ?? 0) * 100)} min={0} max={60} suffix="%" accent="rose"
                  onChange={(v) => setConfigField({ reserveRate: v / 100 })} />
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-foreground/80">Sonraki aya ayır: sabit tutar $</label>
                  <NumberInput value={config.monthlyReserveUsd ?? 0} onChange={(v) => setConfigField({ monthlyReserveUsd: v })} min={0} step={1000} className="h-9" />
                  <p className="text-[10px] text-muted-foreground">Yüzde ile sabit tutar birlikte uygulanır; ikisinin toplamı net havuzu aşamaz.</p>
                </div>
                <SliderRow label="Havuz tabanı: net bunun altındaysa prim yok" value={Math.round((config.minNetFloorUsd ?? 0) / 1000)} min={0} max={50} suffix="K $" accent="rose"
                  onChange={(v) => setConfigField({ minNetFloorUsd: v * 1000 })} />
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-foreground/80">Bir kişi en fazla ne kadar prim alsın? (0 = sınırsız)</label>
                  <NumberInput value={config.maxPrimPerPersonUsd ?? 0} onChange={(v) => setConfigField({ maxPrimPerPersonUsd: v })} min={0} step={500} className="h-9" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-foreground/80">Bu ay toplam en fazla ne kadar prim dağıtılsın? (0 = sınırsız)</label>
                  <NumberInput value={config.maxTotalPrimUsd ?? 0} onChange={(v) => setConfigField({ maxTotalPrimUsd: v })} min={0} step={1000} className="h-9" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Para nereye gidiyor?</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Net havuz (gelir − tüm giderler)</span><span className="tabular-nums font-medium">{fmtPrimUsd(result.netPoolUsd)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Sonraki aya ayrılan (yüzde {pct(config.reserveRate ?? 0)})</span><span className="tabular-nums text-rose-500">−{fmtPrimUsd(Math.min(Math.max(0, result.netPoolUsd), Math.max(0, result.netPoolUsd) * (config.reserveRate ?? 0)))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Sonraki aya ayrılan (sabit)</span><span className="tabular-nums text-rose-500">−{fmtPrimUsd(Math.min(Math.max(0, result.netPoolUsd), config.monthlyReserveUsd ?? 0))}</span></div>
                  <div className="flex justify-between border-t border-border/60 pt-1"><span className="text-muted-foreground">Toplam kenara ayrılan</span><span className="tabular-nums font-semibold text-rose-600">{fmtPrimUsd(result.reserveUsd)}</span></div>
                  {result.viewPoolBonusUsd > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">+ İzlenme havuz bonusu</span><span className="tabular-nums text-emerald-600">+{fmtPrimUsd(result.viewPoolBonusUsd)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">= Prim için kalan havuz</span><span className="tabular-nums font-semibold">{fmtPrimUsd(result.distributablePoolUsd)}</span></div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Güvenlik kontrolleri</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Havuz tabanı</span><span className="tabular-nums">{fmtPrimUsd(config.minNetFloorUsd ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Taban altında mı?</span><span className={cn("font-medium", result.netPoolUsd < (config.minNetFloorUsd ?? 0) ? "text-rose-600" : "text-emerald-600")}>{result.netPoolUsd < (config.minNetFloorUsd ?? 0) ? "Evet — bu ay prim yok" : "Hayır"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kişi başı sınır</span><span className="tabular-nums">{(config.maxPrimPerPersonUsd ?? 0) > 0 ? fmtPrimUsd(config.maxPrimPerPersonUsd!) : "Sınırsız"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Toplam sınır</span><span className="tabular-nums">{(config.maxTotalPrimUsd ?? 0) > 0 ? fmtPrimUsd(config.maxTotalPrimUsd!) : "Sınırsız"}</span></div>
                  <div className="flex justify-between border-t border-border/60 pt-1"><span className="text-muted-foreground">Bu ay dağıtılacak prim</span><span className="tabular-nums font-semibold text-amber-600">{fmtPrimUsd(result.totalPrimUsd)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Prim sonrası ajansta kalan</span><span className="tabular-nums">{fmtPrimUsd(result.netAfterPrimUsd)}</span></div>
                </div>
              </div>

              {/* Bu ayın planı — özet */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{monthLabel(month)} planı</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-md bg-background/60 px-2.5 py-2">
                    <p className="text-muted-foreground">Bu ay dağıtılacak prim</p>
                    <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtPrimUsd(result.totalPrimUsd)}</p>
                    <p className="text-[10px] text-muted-foreground">{result.recipients.length} kişiye, puana göre</p>
                  </div>
                  <div className="rounded-md bg-background/60 px-2.5 py-2">
                    <p className="text-muted-foreground">Sonraki aya ayrılan</p>
                    <p className="text-base font-bold tabular-nums text-rose-600">{fmtPrimUsd(result.reserveUsd)}</p>
                    <p className="text-[10px] text-muted-foreground">Reklam / kuru ay / sürpriz gider için</p>
                  </div>
                  <div className="rounded-md bg-background/60 px-2.5 py-2">
                    <p className="text-muted-foreground">Elle eklenen giderler</p>
                    <p className="text-base font-bold tabular-nums text-rose-600">{fmtPrimUsd(result.manualExpenseUsd)}</p>
                    <p className="text-[10px] text-muted-foreground">Reklam vb. (yukarıdaki kart)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── DAĞITIM ────────────────────────────────────────────────────── */}
        <TabsContent value="dagitim" className="mt-4">
          <PrimDistributionPanel
            monthLabel={monthLabel(month)}
            result={result}
            excludedRecipients={excludedRecipients}
            payrollCandidates={payrollCandidates}
            recipientMeta={recipientMeta}
            newPersonName={newPersonName}
            newPersonNick={newPersonNick}
            newPersonKind={newPersonKind}
            newPersonPoints={newPersonPoints}
            onNewPersonName={setNewPersonName}
            onNewPersonNick={setNewPersonNick}
            onNewPersonKind={setNewPersonKind}
            onNewPersonPoints={setNewPersonPoints}
            onAddCustom={addCustomRecipient}
            onIncludePayroll={includePayrollRecipient}
            onSetPoints={setPoints}
            onSetQuality={setQuality}
            onSetField={setRecipientField}
            onExclude={toggleRecipientExcluded}
            onRemoveCustom={removeCustomRecipient}
            onDistributionMode={(mode) => setConfigField({ distributionMode: mode })}
          />
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-center">
        Yalnızca ana yönetici (Orkun) tarafından görülebilir — marka ve yayıncı hesapları erişemez.
        Prim ayarları <strong> yalnızca bu tarayıcıya</strong> kaydedilir (ay bazlı).
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

// ── Hazır sistem seçimi ─────────────────────────────────────────────────────
function detectActivePresetKey(config: PrimPoolConfig): string | null {
  for (const p of PRIM_SYSTEM_PRESETS) {
    const c = p.config;
    const match =
      (config.basePrimMode ?? "rate") === (c.basePrimMode ?? "rate") &&
      Math.abs((config.basePrimRate ?? 0.1) - (c.basePrimRate ?? 0.1)) < 0.001 &&
      (config.viewPoolBonusEnabled ?? false) === (c.viewPoolBonusEnabled ?? false) &&
      (config.viewBonusMode ?? "off") === (c.viewBonusMode ?? "off") &&
      (config.basePrimNetBasis ?? "after_payroll_content") === (c.basePrimNetBasis ?? "after_payroll_content");
    if (match && (c.basePrimMode !== "fixed" || config.fixedPrimUsd === c.fixedPrimUsd)) {
      return p.key;
    }
  }
  return null;
}

function PrimSystemPresetsCard({
  presets,
  activeKey,
  onApply,
}: {
  presets: PrimSystemPreset[];
  activeKey: string | null;
  onApply: (p: PrimSystemPreset) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Hazır sistemler</CardTitle>
        <CardDescription>Bir model seç — kurallar ve oranlar otomatik ayarlanır. Sonra Dağıtım sekmesinden kişileri düzenle.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onApply(p)}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              activeKey === p.key
                ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30"
                : "border-border/60 bg-card hover:border-amber-500/30 hover:bg-muted/30",
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">{p.label}</span>
              <Badge variant="outline" className="text-[9px]">{p.tag}</Badge>
            </div>
            <p className="text-[11px] font-medium text-foreground/90">{p.description}</p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{p.detail}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function PrimFlowSummary({ result }: { result: PrimPoolResult }) {
  const pct = Math.round(result.config.basePrimRate * 100);
  const steps = [
    { n: 1, label: "Marka geliri", value: fmtPrimUsd(result.totalRevenueUsd) },
    { n: 2, label: "− Maaş − İçerik", value: fmtPrimUsd(result.payrollUsd + result.contentExpenseUsd) },
    { n: 3, label: "= Kalan", value: fmtPrimUsd(result.payrollContentNetUsd) },
    { n: 4, label: `Taban prim (%${pct})`, value: fmtPrimUsd(result.basePrimUsd) },
    { n: 5, label: "+ Link izlenme", value: fmtPrimUsd(result.poolBonusUsd) },
    { n: 6, label: "= Toplam prim", value: fmtPrimUsd(result.totalPrimUsd) },
  ];
  return (
    <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Bu ayın akışı (özet)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <div className="rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5">
                <p className="text-[9px] text-muted-foreground uppercase">{s.label}</p>
                <p className="font-bold tabular-nums text-foreground">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Prim kuralları kartı ─────────────────────────────────────────────────────
function PrimRulesCard({ rules, formula }: { rules: PrimRuleLine[]; formula: string }) {
  const statusCls: Record<PrimRuleLine["status"], string> = {
    ok: "border-emerald-500/30 bg-emerald-500/5",
    warn: "border-amber-500/30 bg-amber-500/5",
    off: "border-border/60 bg-muted/20 opacity-80",
  };
  const valueCls: Record<PrimRuleLine["status"], string> = {
    ok: "text-emerald-700 dark:text-emerald-300",
    warn: "text-amber-700 dark:text-amber-300",
    off: "text-muted-foreground",
  };

  return (
    <Card className="border-amber-500/25 bg-amber-500/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-600" />
          Prim kuralları
        </CardTitle>
        <CardDescription>
          Adım adım hesap mantığı. Bu ayın sonucu: <strong className="text-foreground">{formula}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={cn("rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed", statusCls[rule.status])}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-semibold text-foreground">
                  {rule.step}. {rule.title}
                </span>
                {rule.value && (
                  <span className={cn("shrink-0 font-bold tabular-nums text-xs", valueCls[rule.status])}>
                    {rule.value}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">{rule.description}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ── Ne olursa ne kadar prim? ─────────────────────────────────────────────────
function PrimScenarioGuideCard({ scenarios }: { scenarios: PrimScenarioRow[] }) {
  return (
    <Card className="border-blue-500/25 bg-blue-500/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target size={16} className="text-blue-600" />
          Ne olursa ne kadar prim?
        </CardTitle>
        <CardDescription>
          Somut if-then kuralları. Yeşil satırlar bu ay tetiklendi veya geçerli.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left">
                <th className="px-3 py-2 font-semibold text-muted-foreground w-[38%]">Ne olursa</th>
                <th className="px-3 py-2 font-semibold text-muted-foreground w-[34%]">Ne olur</th>
                <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-[28%]">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((row, i) => (
                <tr
                  key={`${row.when}-${i}`}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    row.active ? "bg-emerald-500/5" : "bg-transparent",
                  )}
                >
                  <td className="px-3 py-2.5 text-foreground/90 align-top">{row.when}</td>
                  <td className="px-3 py-2.5 text-muted-foreground align-top">{row.then}</td>
                  <td className={cn(
                    "px-3 py-2.5 text-right font-bold tabular-nums align-top",
                    row.active ? "text-emerald-700 dark:text-emerald-300" : "text-foreground",
                  )}>
                    {row.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── İzlenme tetik banner ─────────────────────────────────────────────────────
function ViewTriggerBanner({ result }: { result: PrimPoolResult }) {
  const overViews = Math.max(0, result.totalActualViews - result.totalGuaranteedViews);
  const cfg = result.config;

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
            {result.viewTriggered
              ? `İzlenme hedefi aşıldı — +${fmtCompactViews(overViews)} fazla izlenme`
              : "İzlenme hedefi henüz tutmadı — sadece taban prim"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtCompactViews(result.totalActualViews)} / {fmtCompactViews(result.totalGuaranteedViews)} garanti
            {result.viewTriggered && cfg.viewBonusMode === "cpm" && (
              <> · fazla her 1K izlenme = +{fmtPrimUsd(cfg.viewCpmBonusUsd)}</>
            )}
            {result.viewPoolBonusUsd > 0 && (
              <> · eşik bonusu +{fmtPrimUsd(result.viewPoolBonusUsd)}</>
            )}
          </p>
        </div>
        <Badge variant={result.viewTriggered ? "default" : "outline"} className="shrink-0">
          <Eye size={12} className="mr-1" />
          {result.viewBonusUsd > 0 ? `+${fmtPrimUsd(result.viewBonusUsd)} izlenme` : "Taban prim"}
        </Badge>
      </CardContent>
    </Card>
  );
}
