import type { Brand, BrandLink, ContentExpense, Employee, ExpenseEntry, LinkSnapshot } from "@/store/store";
import {
  calcNetPayable,
  isPayrollActive,
  type Advance,
  type MonthPaymentStatus,
  type SalaryExtra,
} from "@/store/store";
import { totalContentExpensesForMonth, totalLinkViewsForMonth } from "@/lib/brand-month-metrics";
import { toYearMonthLocal } from "@/lib/data";
import { last12MonthsYm } from "@/lib/calendar-months";

/** Standard paket referans — marka başına varsayılan tahsilat & garanti. */
export const DEFAULT_BRAND_FEE_USD = 10_000;
export const DEFAULT_GUARANTEED_VIEWS = 1_000_000;

/** Prim havuzunun nasıl hesaplandığı. */
export type PrimModel = "net_share" | "revenue_share" | "hybrid";
/** Temel prim nasıl belirlenir: orana göre mi sabit tutar mı. */
export type PrimBaseMode = "rate" | "fixed";
/** İzlenme primi yöntemi. */
export type PrimViewBonusMode = "multiplier" | "cpm" | "off";
/** Kişilere dağıtım yöntemi. */
export type PrimDistributionMode = "weighted" | "equal" | "performance";

export type PrimPoolConfig = {
  /** Havuz modeli (varsayılan net_share). */
  model?: PrimModel;
  /** Temel prim belirleme yöntemi (varsayılan rate). */
  basePrimMode?: PrimBaseMode;
  /** Sabit mod: o ay için elle belirlenen sabit prim havuzu (USD). */
  fixedPrimUsd?: number;
  /** Net havuzdan sabit prim oranı (0.15 = %15). net_share/hybrid. */
  basePrimRate: number;
  /** Brüt gelirden pay oranı (revenue_share/hybrid). */
  revenueShareRate?: number;
  /** Dağıtımdan önce gelecek aylar/kuru aylar için ayrılan pay oranı (0.15 = %15). */
  reserveRate?: number;
  /** Sabit aylık rezerv (sürekli/öngörülen & sürpriz giderler tamponu) USD. */
  monthlyReserveUsd?: number;
  /** İzlenme primi yöntemi (varsayılan multiplier). */
  viewBonusMode?: PrimViewBonusMode;
  /** Multiplier modu: garanti aşımında her %10 için temel prime eklenen oran. */
  viewTriggerStepRate: number;
  /** Multiplier modu: izlenme tetikleyicisi tavanı. */
  viewTriggerCap: number;
  /** CPM modu: garanti üstü her 1.000 izlenme için ek USD. */
  viewCpmBonusUsd?: number;
  /** Net havuz bu tabanın altındaysa prim dağıtılmaz (ajans güvenliği). */
  minNetFloorUsd?: number;
  /** Kişi başı azami prim (adalet tavanı) USD. 0 = sınırsız. */
  maxPrimPerPersonUsd?: number;
  /** Toplam prim tavanı USD. 0 = sınırsız. */
  maxTotalPrimUsd?: number;
  /** Dağıtım yöntemi (varsayılan weighted). */
  distributionMode?: PrimDistributionMode;
};

/** Kütüphane varsayılanı — nötr (rezerv/tavan kapalı). Geriye dönük uyumluluk. */
export const DEFAULT_PRIM_CONFIG: PrimPoolConfig = {
  model: "net_share",
  basePrimMode: "rate",
  fixedPrimUsd: 0,
  basePrimRate: 0.15,
  revenueShareRate: 0.05,
  reserveRate: 0,
  monthlyReserveUsd: 0,
  viewBonusMode: "multiplier",
  viewTriggerStepRate: 0.08,
  viewTriggerCap: 0.35,
  viewCpmBonusUsd: 2,
  minNetFloorUsd: 0,
  maxPrimPerPersonUsd: 0,
  maxTotalPrimUsd: 0,
  distributionMode: "weighted",
};

/**
 * Panelin başlangıç önayarı — "adil & güvenli" profil.
 * Önce sabit bir prim tutarı belirlenir, gelecek aylar için rezerv ayrılır,
 * kişi başı tavan ile aşırı yüksek ödemeler engellenir.
 */
export const FAIR_PRIM_CONFIG: PrimPoolConfig = {
  model: "net_share",
  basePrimMode: "fixed",
  fixedPrimUsd: 12_000,
  basePrimRate: 0.1,
  revenueShareRate: 0.04,
  reserveRate: 0.15,
  monthlyReserveUsd: 0,
  viewBonusMode: "multiplier",
  viewTriggerStepRate: 0.05,
  viewTriggerCap: 0.2,
  viewCpmBonusUsd: 1.5,
  minNetFloorUsd: 10_000,
  maxPrimPerPersonUsd: 6_000,
  maxTotalPrimUsd: 0,
  distributionMode: "weighted",
};

export const PRIM_MODEL_LABELS: Record<PrimModel, string> = {
  net_share: "Net havuz payı",
  revenue_share: "Brüt gelir payı",
  hybrid: "Hibrit (net + gelir)",
};

export const PRIM_BASE_MODE_LABELS: Record<PrimBaseMode, string> = {
  fixed: "Sabit tutar (önce belirle)",
  rate: "Orana göre (otomatik)",
};

export const PRIM_VIEW_BONUS_LABELS: Record<PrimViewBonusMode, string> = {
  multiplier: "Çarpan (aşım %)",
  cpm: "CPM (1000 izlenme)",
  off: "Kapalı",
};

export const PRIM_DISTRIBUTION_LABELS: Record<PrimDistributionMode, string> = {
  weighted: "Ağırlıklı (rol)",
  equal: "Eşit",
  performance: "Performans (ağırlık²)",
};

export type PrimBrandRow = {
  brandId: string;
  brandName: string;
  shortName: string;
  monthlyFeeUsd: number;
  guaranteedViews: number;
  actualViews: number;
  viewsOverGuarantee: number;
  viewsOverPct: number;
  triggered: boolean;
  /** Bu markanın efektif CPM'i ($/1000 izlenme). */
  cpmUsd: number;
};

export type PrimRecipientRow = {
  employeeId: string;
  name: string;
  kind: string;
  weight: number;
  sharePct: number;
  baseShareUsd: number;
  viewBonusUsd: number;
  totalUsd: number;
};

export type PrimPoolResult = {
  monthYm: string;
  brandRows: PrimBrandRow[];
  totalRevenueUsd: number;
  payrollUsd: number;
  contentExpenseUsd: number;
  generalExpenseUsd: number;
  totalOpsUsd: number;
  netPoolUsd: number;
  /** Gelecek aylar / sürpriz gider tamponu için ayrılan tutar. */
  reserveUsd: number;
  /** Rezerv sonrası dağıtıma açık havuz. */
  distributablePoolUsd: number;
  /** Prim sonrası ajansta kalan net (netPool - totalPrim). */
  netAfterPrimUsd: number;
  totalGuaranteedViews: number;
  totalActualViews: number;
  totalOverPct: number;
  /** Tüm markaların ortalama CPM'i. */
  blendedCpmUsd: number;
  viewTriggered: boolean;
  basePrimUsd: number;
  viewBonusUsd: number;
  /** İzlenme primi efektif çarpanı (örn. 0.18 = temel primin +%18'i). */
  viewBonusMultiplier: number;
  /** Tavanlardan önce hesaplanan ham prim. */
  grossPrimUsd: number;
  /** Tavanlarla kırpılan tutar (gross − total). */
  cappedAmountUsd: number;
  totalPrimUsd: number;
  /** Prim / dağıtılabilir havuz oranı (yük). */
  primLoadPct: number;
  recipients: PrimRecipientRow[];
  config: Required<PrimPoolConfig>;
};

function normalizeConfig(config?: PrimPoolConfig): Required<PrimPoolConfig> {
  const c = config ?? DEFAULT_PRIM_CONFIG;
  return {
    model: c.model ?? "net_share",
    basePrimMode: c.basePrimMode ?? "rate",
    fixedPrimUsd: c.fixedPrimUsd ?? 0,
    basePrimRate: c.basePrimRate,
    revenueShareRate: c.revenueShareRate ?? 0.05,
    reserveRate: c.reserveRate ?? 0,
    monthlyReserveUsd: c.monthlyReserveUsd ?? 0,
    viewBonusMode: c.viewBonusMode ?? "multiplier",
    viewTriggerStepRate: c.viewTriggerStepRate,
    viewTriggerCap: c.viewTriggerCap,
    viewCpmBonusUsd: c.viewCpmBonusUsd ?? 2,
    minNetFloorUsd: c.minNetFloorUsd ?? 0,
    maxPrimPerPersonUsd: c.maxPrimPerPersonUsd ?? 0,
    maxTotalPrimUsd: c.maxTotalPrimUsd ?? 0,
    distributionMode: c.distributionMode ?? "weighted",
  };
}

export function brandViewsForMonth(
  brandId: string,
  links: BrandLink[],
  monthYm: string,
  snaps: LinkSnapshot[],
  todayYm: string
): number {
  const brandLinks = links.filter((l) => l.brandId === brandId);
  return totalLinkViewsForMonth(brandLinks, monthYm, snaps, todayYm);
}

export function payrollTotalForMonth(
  employees: Employee[],
  monthYm: string,
  advances: Advance[],
  salaryExtras: SalaryExtra[],
  paymentStatuses: MonthPaymentStatus[]
): number {
  return employees
    .filter((e) => e.kind !== "coordinator" && isPayrollActive(e, monthYm))
    .reduce((s, e) => s + calcNetPayable(e, monthYm, advances, salaryExtras, paymentStatuses), 0);
}

export function generalExpensesForMonth(expenses: ExpenseEntry[], monthYm: string): number {
  return expenses
    .filter((e) => e.date.startsWith(monthYm))
    .reduce((s, e) => s + e.amount, 0);
}

/** Prim dağıtım ağırlığı — yayıncı/moderatör eşit, koordinatör hariç. */
export function primRecipientWeight(emp: Employee): number {
  if (emp.kind === "streamer") return 1;
  if (emp.kind === "moderator") return 0.85;
  return 0;
}

/** Ayın ne kadarının geçtiği (0..1). Projeksiyon için. */
export function monthProgress(monthYm: string, today: Date = new Date()): number {
  const [y, m] = monthYm.split("-").map(Number);
  if (!y || !m) return 1;
  const todayYm = toYearMonthLocal(today);
  if (monthYm < todayYm) return 1; // geçmiş ay tamamlandı
  if (monthYm > todayYm) return 0; // gelecek ay başlamadı
  const daysInMonth = new Date(y, m, 0).getDate();
  const day = today.getDate();
  return Math.min(1, Math.max(0.01, day / daysInMonth));
}

/** Ay sonu izlenme projeksiyonu (run-rate). */
export function projectMonthEndViews(currentViews: number, progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return currentViews;
  return Math.round(currentViews / progress);
}

function distributionShares(
  recipients: { id: string; name: string; kind: string; weight: number }[],
  mode: PrimDistributionMode
): Map<string, number> {
  const shares = new Map<string, number>();
  const active = recipients.filter((r) => r.weight > 0);
  if (active.length === 0) return shares;

  if (mode === "equal") {
    const each = 1 / active.length;
    active.forEach((r) => shares.set(r.id, each));
    return shares;
  }
  const exponent = mode === "performance" ? 1.5 : 1;
  const weights = active.map((r) => Math.pow(r.weight, exponent));
  const total = weights.reduce((s, w) => s + w, 0);
  active.forEach((r, i) => shares.set(r.id, total > 0 ? weights[i] / total : 0));
  return shares;
}

export function computePrimPool(input: {
  monthYm: string;
  brands: Brand[];
  brandFees: Record<string, number>;
  brandGuarantees: Record<string, number>;
  brandViews: Record<string, number>;
  payrollUsd: number;
  contentExpenseUsd: number;
  generalExpenseUsd: number;
  recipients: { id: string; name: string; kind: string; weight: number }[];
  config?: PrimPoolConfig;
}): PrimPoolResult {
  const config = normalizeConfig(input.config);
  const activeBrands = input.brands.filter((b) => b.status === "active");

  const brandRows: PrimBrandRow[] = activeBrands.map((b) => {
    const monthlyFeeUsd = input.brandFees[b.id] ?? DEFAULT_BRAND_FEE_USD;
    const guaranteedViews = input.brandGuarantees[b.id] ?? DEFAULT_GUARANTEED_VIEWS;
    const actualViews = input.brandViews[b.id] ?? 0;
    const viewsOverGuarantee = Math.max(0, actualViews - guaranteedViews);
    const viewsOverPct = guaranteedViews > 0 ? viewsOverGuarantee / guaranteedViews : 0;
    const cpmUsd = actualViews > 0 ? (monthlyFeeUsd / actualViews) * 1000 : 0;
    return {
      brandId: b.id,
      brandName: b.name,
      shortName: b.shortName,
      monthlyFeeUsd,
      guaranteedViews,
      actualViews,
      viewsOverGuarantee,
      viewsOverPct,
      triggered: actualViews >= guaranteedViews && guaranteedViews > 0,
      cpmUsd,
    };
  });

  const totalRevenueUsd = brandRows.reduce((s, r) => s + r.monthlyFeeUsd, 0);
  const totalOpsUsd = input.payrollUsd + input.contentExpenseUsd + input.generalExpenseUsd;
  const netPoolUsd = totalRevenueUsd - totalOpsUsd;
  const positiveNet = Math.max(0, netPoolUsd);

  // Rezerv — gelecek aylar / kuru aylar / sürpriz giderler için dağıtımdan önce ayrılır.
  const reserveUsd = Math.min(
    positiveNet,
    config.monthlyReserveUsd + positiveNet * config.reserveRate
  );
  const distributablePoolUsd = Math.max(0, positiveNet - reserveUsd);

  const totalGuaranteedViews = brandRows.reduce((s, r) => s + r.guaranteedViews, 0);
  const totalActualViews = brandRows.reduce((s, r) => s + r.actualViews, 0);
  const totalViewsOver = Math.max(0, totalActualViews - totalGuaranteedViews);
  const totalOverPct =
    totalGuaranteedViews > 0 ? totalViewsOver / totalGuaranteedViews : 0;
  const blendedCpmUsd = totalActualViews > 0 ? (totalRevenueUsd / totalActualViews) * 1000 : 0;

  // Net havuz tabanı kontrolü — yalnızca net bazlı modellerde geçerli.
  const belowFloor = config.model !== "revenue_share" && netPoolUsd < config.minNetFloorUsd;

  // Temel prim — sabit tutar veya orana göre, modele bağlı.
  let rawBasePrimUsd = 0;
  if (!belowFloor) {
    if (config.basePrimMode === "fixed") {
      // Önce belirlenen sabit tutar — dağıtılabilir havuzu aşamaz (gider bağımsız model hariç).
      const cap = config.model === "revenue_share" ? Number.POSITIVE_INFINITY : distributablePoolUsd;
      rawBasePrimUsd = Math.min(config.fixedPrimUsd, cap);
    } else if (config.model === "net_share") {
      rawBasePrimUsd = distributablePoolUsd * config.basePrimRate;
    } else if (config.model === "revenue_share") {
      rawBasePrimUsd = totalRevenueUsd * config.revenueShareRate;
    } else {
      // hybrid
      rawBasePrimUsd = distributablePoolUsd * config.basePrimRate + totalRevenueUsd * config.revenueShareRate;
    }
  }

  // İzlenme primi.
  const viewTriggered = totalActualViews >= totalGuaranteedViews && totalGuaranteedViews > 0;
  let rawViewBonusUsd = 0;
  let viewBonusMultiplier = 0;
  if (!belowFloor && config.viewBonusMode !== "off" && viewTriggered) {
    if (config.viewBonusMode === "multiplier") {
      const steps = Math.floor(totalOverPct * 10);
      const mult = Math.min(config.viewTriggerCap, steps * config.viewTriggerStepRate);
      viewBonusMultiplier = mult;
      rawViewBonusUsd = rawBasePrimUsd * mult;
    } else if (config.viewBonusMode === "cpm") {
      rawViewBonusUsd = (totalViewsOver / 1000) * config.viewCpmBonusUsd;
      viewBonusMultiplier = rawBasePrimUsd > 0 ? rawViewBonusUsd / rawBasePrimUsd : 0;
    }
  }

  // Toplam prim tavanı — base & bonus oransal kırpılır.
  const grossPrimUsd = rawBasePrimUsd + rawViewBonusUsd;
  const cappedPool =
    config.maxTotalPrimUsd > 0 ? Math.min(grossPrimUsd, config.maxTotalPrimUsd) : grossPrimUsd;
  const totalCapScale = grossPrimUsd > 0 ? cappedPool / grossPrimUsd : 0;
  const basePrimUsd = rawBasePrimUsd * totalCapScale;
  const viewBonusUsd = rawViewBonusUsd * totalCapScale;

  // Dağıtım + kişi başı adalet tavanı.
  const shares = distributionShares(input.recipients, config.distributionMode);
  const recipients: PrimRecipientRow[] = input.recipients
    .filter((r) => r.weight > 0)
    .map((r) => {
      const share = shares.get(r.id) ?? 0;
      let baseShareUsd = basePrimUsd * share;
      let viewBonusShare = viewBonusUsd * share;
      let totalUsd = baseShareUsd + viewBonusShare;
      if (config.maxPrimPerPersonUsd > 0 && totalUsd > config.maxPrimPerPersonUsd) {
        const personScale = totalUsd > 0 ? config.maxPrimPerPersonUsd / totalUsd : 0;
        baseShareUsd *= personScale;
        viewBonusShare *= personScale;
        totalUsd = config.maxPrimPerPersonUsd;
      }
      return {
        employeeId: r.id,
        name: r.name,
        kind: r.kind,
        weight: r.weight,
        sharePct: share,
        baseShareUsd,
        viewBonusUsd: viewBonusShare,
        totalUsd,
      };
    });

  // Fiilen ödenen toplam (kişi başı tavan sonrası).
  const totalPrimUsd = recipients.reduce((s, r) => s + r.totalUsd, 0);
  const cappedAmountUsd = Math.max(0, grossPrimUsd - totalPrimUsd);
  const netAfterPrimUsd = netPoolUsd - totalPrimUsd;
  const primLoadPct = distributablePoolUsd > 0 ? totalPrimUsd / distributablePoolUsd : 0;

  return {
    monthYm: input.monthYm,
    brandRows,
    totalRevenueUsd,
    payrollUsd: input.payrollUsd,
    contentExpenseUsd: input.contentExpenseUsd,
    generalExpenseUsd: input.generalExpenseUsd,
    totalOpsUsd,
    netPoolUsd,
    reserveUsd,
    distributablePoolUsd,
    netAfterPrimUsd,
    totalGuaranteedViews,
    totalActualViews,
    totalOverPct,
    blendedCpmUsd,
    viewTriggered,
    basePrimUsd,
    viewBonusUsd,
    viewBonusMultiplier,
    grossPrimUsd,
    cappedAmountUsd,
    totalPrimUsd,
    primLoadPct,
    recipients,
    config,
  };
}

/** Senaryo — çarpanlarla baz girdileri büyütüp/küçültür. */
export type PrimScenario = {
  key: string;
  label: string;
  description: string;
  revenueMultiplier: number;
  expenseMultiplier: number;
  viewsMultiplier: number;
};

export const DEFAULT_SCENARIOS: PrimScenario[] = [
  { key: "worst", label: "Kötü", description: "Gelir düşük, gider yüksek, izlenme zayıf", revenueMultiplier: 0.7, expenseMultiplier: 1.15, viewsMultiplier: 0.55 },
  { key: "low", label: "Temkinli", description: "Hafif düşüş senaryosu", revenueMultiplier: 0.9, expenseMultiplier: 1.05, viewsMultiplier: 0.8 },
  { key: "base", label: "Baz (gerçek)", description: "Sistemdeki güncel veriler", revenueMultiplier: 1, expenseMultiplier: 1, viewsMultiplier: 1 },
  { key: "good", label: "İyi", description: "Hedeflerin üzerinde performans", revenueMultiplier: 1.15, expenseMultiplier: 0.95, viewsMultiplier: 1.4 },
  { key: "aggressive", label: "Agresif", description: "Güçlü büyüme + viral içerik", revenueMultiplier: 1.3, expenseMultiplier: 0.9, viewsMultiplier: 1.9 },
];

export type PrimBaseInputs = {
  monthYm: string;
  brands: Brand[];
  brandFees: Record<string, number>;
  brandGuarantees: Record<string, number>;
  brandViews: Record<string, number>;
  payrollUsd: number;
  contentExpenseUsd: number;
  generalExpenseUsd: number;
  recipients: { id: string; name: string; kind: string; weight: number }[];
  config?: PrimPoolConfig;
};

function scaleRecord(rec: Record<string, number>, mult: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(rec)) out[k] = rec[k] * mult;
  return out;
}

export function computeWithScenario(base: PrimBaseInputs, scenario: PrimScenario): PrimPoolResult {
  return computePrimPool({
    monthYm: base.monthYm,
    brands: base.brands,
    brandFees: scaleRecord(base.brandFees, scenario.revenueMultiplier),
    brandGuarantees: base.brandGuarantees,
    brandViews: scaleRecord(base.brandViews, scenario.viewsMultiplier),
    payrollUsd: base.payrollUsd * scenario.expenseMultiplier,
    contentExpenseUsd: base.contentExpenseUsd * scenario.expenseMultiplier,
    generalExpenseUsd: base.generalExpenseUsd * scenario.expenseMultiplier,
    recipients: base.recipients,
    config: base.config,
  });
}

/** Tüm hazır senaryoları hesapla. */
export function computeAllScenarios(base: PrimBaseInputs, scenarios = DEFAULT_SCENARIOS) {
  return scenarios.map((s) => ({ scenario: s, result: computeWithScenario(base, s) }));
}

/** Son 12 ay toplam izlenme geçmişi (link snapshot bazlı). */
export function viewershipHistory(
  endYm: string,
  brands: Brand[],
  brandLinks: BrandLink[],
  linkSnapshots: LinkSnapshot[]
): { ym: string; views: number }[] {
  const todayYm = toYearMonthLocal(new Date());
  const months = last12MonthsYm(endYm);
  return months.map((ym) => {
    let views = 0;
    for (const b of brands.filter((x) => x.status === "active")) {
      views += brandViewsForMonth(b.id, brandLinks, ym, linkSnapshots, todayYm);
    }
    return { ym, views };
  });
}

/** Marka bazlı son 12 ay izlenme (yığılmış grafik için). */
export function brandViewershipHistory(
  endYm: string,
  brands: Brand[],
  brandLinks: BrandLink[],
  linkSnapshots: LinkSnapshot[]
): { ym: string; [brandShort: string]: number | string }[] {
  const todayYm = toYearMonthLocal(new Date());
  const months = last12MonthsYm(endYm);
  const active = brands.filter((x) => x.status === "active");
  return months.map((ym) => {
    const row: { ym: string; [k: string]: number | string } = { ym };
    for (const b of active) {
      row[b.shortName] = brandViewsForMonth(b.id, brandLinks, ym, linkSnapshots, todayYm);
    }
    return row;
  });
}

/** Store verisinden baz girdileri çıkar (senaryo & projeksiyon için tekrar kullanılır). */
export function buildPrimBaseInputs(input: {
  monthYm: string;
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  employees: Employee[];
  advances: Advance[];
  salaryExtras: SalaryExtra[];
  paymentStatuses: MonthPaymentStatus[];
  contentExpenses: ContentExpense[];
  expenses: ExpenseEntry[];
  brandFees?: Record<string, number>;
  brandGuarantees?: Record<string, number>;
  recipientWeights?: Record<string, number>;
  config?: PrimPoolConfig;
}): PrimBaseInputs {
  const todayYm = toYearMonthLocal(new Date());
  const brandViews: Record<string, number> = {};
  const brandFees: Record<string, number> = {};
  const brandGuarantees: Record<string, number> = {};
  for (const b of input.brands) {
    brandViews[b.id] = brandViewsForMonth(b.id, input.brandLinks, input.monthYm, input.linkSnapshots, todayYm);
    brandFees[b.id] = input.brandFees?.[b.id] ?? DEFAULT_BRAND_FEE_USD;
    brandGuarantees[b.id] = input.brandGuarantees?.[b.id] ?? DEFAULT_GUARANTEED_VIEWS;
  }

  const payrollUsd = payrollTotalForMonth(
    input.employees,
    input.monthYm,
    input.advances,
    input.salaryExtras,
    input.paymentStatuses
  );
  const contentExpenseUsd = totalContentExpensesForMonth(input.contentExpenses, input.monthYm);
  const generalExpenseUsd = generalExpensesForMonth(input.expenses, input.monthYm);

  const recipients = input.employees
    .filter((e) => e.status === "active" && isPayrollActive(e, input.monthYm))
    .map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      weight: input.recipientWeights?.[e.id] ?? primRecipientWeight(e),
    }))
    .filter((r) => r.weight > 0);

  return {
    monthYm: input.monthYm,
    brands: input.brands,
    brandFees,
    brandGuarantees,
    brandViews,
    payrollUsd,
    contentExpenseUsd,
    generalExpenseUsd,
    recipients,
    config: input.config,
  };
}

/** Store verisinden aylık prim havuzu hesapla. */
export function buildPrimPoolFromStore(input: {
  monthYm: string;
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  employees: Employee[];
  advances: Advance[];
  salaryExtras: SalaryExtra[];
  paymentStatuses: MonthPaymentStatus[];
  contentExpenses: ContentExpense[];
  expenses: ExpenseEntry[];
  brandFees?: Record<string, number>;
  brandGuarantees?: Record<string, number>;
  recipientWeights?: Record<string, number>;
  config?: PrimPoolConfig;
}): PrimPoolResult {
  const base = buildPrimBaseInputs(input);
  return computePrimPool({
    monthYm: base.monthYm,
    brands: base.brands,
    brandFees: base.brandFees,
    brandGuarantees: base.brandGuarantees,
    brandViews: base.brandViews,
    payrollUsd: base.payrollUsd,
    contentExpenseUsd: base.contentExpenseUsd,
    generalExpenseUsd: base.generalExpenseUsd,
    recipients: base.recipients,
    config: input.config,
  });
}

export function fmtPrimUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("tr-TR")}`;
}
