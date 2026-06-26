import type { Brand, BrandLink, ContentExpense, Employee, ExpenseEntry, LinkSnapshot } from "@/store/store";
import {
  calcNetPayable,
  isPayrollActive,
  isPrimEligible,
  payrollProrationFactor,
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
/** Temel prim nasıl belirlenir: orana göre, sabit tutar veya kasa payı. */
export type PrimBaseMode = "rate" | "fixed" | "kasa_share";
/** İzlenme primi yöntemi. */
export type PrimViewBonusMode = "multiplier" | "cpm" | "off";
/** Kişilere dağıtım yöntemi. */
export type PrimDistributionMode = "weighted" | "equal" | "performance";

/** Taban prim hangi kâr üzerinden hesaplanır. */
export type PrimBaseNetBasis = "after_payroll_content" | "distributable";

export type PrimPoolConfig = {
  /** Havuz modeli (varsayılan net_share). */
  model?: PrimModel;
  /** Temel prim belirleme yöntemi (varsayılan rate). */
  basePrimMode?: PrimBaseMode;
  /** Sabit mod: o ay için elle belirlenen sabit prim havuzu (USD). */
  fixedPrimUsd?: number;
  /** Net havuzdan sabit prim oranı (0.10 = %10). net_share/hybrid. */
  basePrimRate: number;
  /** Taban prim oranının uygulandığı kâr: gelir−maaş−içerik (önerilen) veya dağıtılabilir havuz. */
  basePrimNetBasis?: PrimBaseNetBasis;
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
  /** Toplam prim tavanı USD. 0 = sınırsız. İzlenme havuz bonusu bu tavandan muaf tutulur. */
  maxTotalPrimUsd?: number;
  /** İzlenme havuz bonusu kâr tabanı ve toplam tavan kısıtlarından muaf (varsayılan true). */
  viewPoolBonusUncapped?: boolean;
  /** Dağıtım yöntemi (varsayılan weighted). */
  distributionMode?: PrimDistributionMode;
  /** İzlenme havuz bonusu açık mı? (eşik geçilince havuza ek para). */
  viewPoolBonusEnabled?: boolean;
  /** Bu izlenmeye ulaşmadan havuz bonusu sayılmaz (örn. 5M). */
  viewPoolBonusMinViews?: number;
  /** Her adımda sayılacak izlenme miktarı (örn. 1M). */
  viewPoolBonusThresholdViews?: number;
  /** Her eşik adımı için havuza eklenen tutar (USD) — kademe yoksa sabit oran. */
  viewPoolBonusPerStepUsd?: number;
  /** Kademeli ödeme: billable izlenme üzerinden artan kademeler (üst sınırlı). */
  viewPoolBonusTiers?: PrimViewPoolTier[];
  /** Bu sayfada elle eklenen ek giderler (reklam vb.) — net havuzdan düşülür. */
  manualExpenses?: PrimManualExpense[];
};

/** İzlenme havuz bonusu kademesi (min eşik sonrası billable izlenme üzerinden). */
export type PrimViewPoolTier = {
  /** Billable izlenmede bu kademenin üst sınırı (kümülatif). Son kademe: Infinity. */
  upToBillableViews: number;
  /** Bu kademede her adım için USD. */
  perStepUsd: number;
  /** Adım boyutu (varsayılan viewPoolBonusThresholdViews). */
  stepViews?: number;
  /** Bu kademede en fazla kaç adım (ekstrem viral tavan). */
  maxSteps?: number;
};

/** Varsayılan kademe: 5M sonrası ilk 15M billable $125/M, sonra $100, sonra $75 (max 100 adım). */
export const DEFAULT_VIEW_POOL_TIERS: PrimViewPoolTier[] = [
  { upToBillableViews: 15_000_000, perStepUsd: 125 },
  { upToBillableViews: 45_000_000, perStepUsd: 100 },
  { upToBillableViews: Infinity, perStepUsd: 75, maxSteps: 100 },
];

/** Prim sayfasında elle eklenen ek gider (örn. reklam harcaması). */
export type PrimManualExpense = {
  id: string;
  label: string;
  amountUsd: number;
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
  basePrimNetBasis: "distributable",
};

/**
 * Panelin başlangıç önayarı — ekip dostu, mantıklı sınırlar içinde.
 * 1) Marka tahsilatı − maaş − içerik = kalan
 * 2) Kalanın %10'u taban prim havuzuna (gerçek net kârı aşmaz)
 * 3) 5M izlenme barajı sonrası her 1M = kademeli havuz bonusu ($125 → $100 → $75)
 * 4) Puan × kalite ile kişilere bölüşüm
 */
export const FAIR_PRIM_CONFIG: PrimPoolConfig = {
  model: "net_share",
  basePrimMode: "rate",
  basePrimRate: 0.1,
  basePrimNetBasis: "after_payroll_content",
  fixedPrimUsd: 0,
  revenueShareRate: 0.04,
  reserveRate: 0,
  monthlyReserveUsd: 0,
  viewBonusMode: "off",
  viewTriggerStepRate: 0.05,
  viewTriggerCap: 0.25,
  viewCpmBonusUsd: 2,
  minNetFloorUsd: 0,
  maxPrimPerPersonUsd: 0,
  maxTotalPrimUsd: 0,
  viewPoolBonusUncapped: true,
  distributionMode: "weighted",
  viewPoolBonusEnabled: true,
  viewPoolBonusMinViews: 5_000_000,
  viewPoolBonusThresholdViews: 1_000_000,
  viewPoolBonusPerStepUsd: 125,
  viewPoolBonusTiers: DEFAULT_VIEW_POOL_TIERS,
};

export const PRIM_MODEL_LABELS: Record<PrimModel, string> = {
  net_share: "Net havuz payı",
  revenue_share: "Brüt gelir payı",
  hybrid: "Hibrit (net + gelir)",
};

export const PRIM_BASE_MODE_LABELS: Record<PrimBaseMode, string> = {
  fixed: "Sabit tutar (elle belirle)",
  rate: "Kalan kârın yüzdesi (önerilen · %10)",
  kasa_share: "Kasa bakiyesinin yüzdesi",
};

export const PRIM_BASE_NET_BASIS_LABELS: Record<PrimBaseNetBasis, string> = {
  after_payroll_content: "Gelir − maaş − içerik (önerilen)",
  distributable: "Dağıtılabilir havuz (rezerv sonrası)",
};

/** Hazır prim sistemleri — tek tıkla uygula. */
export type PrimSystemPreset = {
  key: string;
  label: string;
  tag: string;
  description: string;
  detail: string;
  config: PrimPoolConfig;
};

export const PRIM_SYSTEM_PRESETS: PrimSystemPreset[] = [
  {
    key: "standard",
    label: "Önerilen",
    tag: "Varsayılan",
    description: "Kalan kârın %10'u + cömert izlenme havuzu",
    detail:
      "Marka tahsilatından maaş ve içerik düşülür; kalanın %10'u taban prim olur. " +
      "5M izlenme barajı sonrası her 1M kademeli bonus (+$125 / +$100 / +$75). Kişilere puan × kalite ile bölünür.",
    config: { ...FAIR_PRIM_CONFIG },
  },
  {
    key: "percent_only",
    label: "Sadece %10",
    tag: "Basit",
    description: "Yalnızca kalan kârın yüzdesi — izlenme bonusu yok",
    detail: "Gelir − maaş − içerik kalanının belirlediğin yüzdesi prim olur. İzlenme takibi devre dışı.",
    config: {
      ...FAIR_PRIM_CONFIG,
      viewPoolBonusEnabled: false,
      viewBonusMode: "off",
    },
  },
  {
    key: "fixed_legacy",
    label: "Sabit tutar",
    tag: "Alternatif",
    description: "Her ay sabit $ prim (kârdan bağımsız üst sınır)",
    detail: "Ay başında sabit bir taban prim belirlersin; kâr yetmezse otomatik düşer. İzlenme havuzu isteğe bağlı açık kalır.",
    config: {
      ...FAIR_PRIM_CONFIG,
      basePrimMode: "fixed",
      fixedPrimUsd: 8_000,
      basePrimNetBasis: "distributable",
      reserveRate: 0.1,
      minNetFloorUsd: 5_000,
    },
  },
  {
    key: "aggressive_views",
    label: "İzlenme ağırlıklı",
    tag: "Alternatif",
    description: "%8 taban + 1M izlenme + garanti üstü CPM",
    detail: "Daha düşük taban oranı; izlenme hem havuz adımı hem garanti üstü CPM ile ödüllendirilir. Viral aylar için.",
    config: {
      ...FAIR_PRIM_CONFIG,
      basePrimRate: 0.08,
      viewBonusMode: "cpm",
      viewCpmBonusUsd: 2,
      viewPoolBonusEnabled: true,
    },
  },
];

export const PRIM_VIEW_BONUS_LABELS: Record<PrimViewBonusMode, string> = {
  multiplier: "Garanti aşıldıkça taban primi yüzdeyle artır",
  cpm: "Fazla izlenme başına $ ekle (önerilen)",
  off: "İzlenme bonusu yok",
};

export const PRIM_DISTRIBUTION_LABELS: Record<PrimDistributionMode, string> = {
  weighted: "Puana göre böl",
  equal: "Herkese eşit böl",
  performance: "Puanı yüksek olana daha çok ver",
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
  /** Takma ad (nickname) — varsa kart üzerinde gösterilir. */
  nickname?: string;
  kind: string;
  weight: number;
  /** Performans puanı (dağıtımda kullanılan ağırlık). */
  points: number;
  /** İçerik kalitesi çarpanı (0.75 düşük … 1.5 üstün). */
  qualityMultiplier: number;
  /** Puan × kalite — dağıtımda kullanılan efektif ağırlık. */
  effectivePoints: number;
  sharePct: number;
  baseShareUsd: number;
  /** 1M izlenme başına havuza giren pay (puana göre). */
  poolShareUsd: number;
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
  /** Gelir − maaş − içerik (taban prim oranının uygulandığı kâr). */
  payrollContentNetUsd: number;
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
  /** Elle eklenen ek giderlerin (reklam vb.) toplamı. */
  manualExpenseUsd: number;
  /** İzlenme eşiği geçilince havuza eklenen ek para. */
  viewPoolBonusUsd: number;
  /** İzlenme havuz bonusunun kaç eşik adımı tetiklendiği. */
  viewPoolBonusSteps: number;
  /** Min baraj sonrası fatura edilen izlenme. */
  viewPoolBonusBillableViews: number;
  /** Kişilere dağıtılan izlenme havuz bonusu (tavan sonrası). */
  poolBonusUsd: number;
  /** Dağıtımda kullanılan toplam puan. */
  totalPoints: number;
  /** 1 puanın karşılığı (temel prim / toplam puan). */
  perPointUsd: number;
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
    basePrimNetBasis: c.basePrimNetBasis ?? "after_payroll_content",
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
    viewPoolBonusEnabled: c.viewPoolBonusEnabled ?? false,
    viewPoolBonusMinViews: c.viewPoolBonusMinViews ?? 0,
    viewPoolBonusThresholdViews: c.viewPoolBonusThresholdViews ?? 1_000_000,
    viewPoolBonusPerStepUsd: c.viewPoolBonusPerStepUsd ?? 125,
    viewPoolBonusTiers: c.viewPoolBonusTiers ?? [],
    viewPoolBonusUncapped: c.viewPoolBonusUncapped ?? true,
    manualExpenses: c.manualExpenses ?? [],
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

/** İzlenme havuz bonusu — min baraj + kademeli adım hesabı. */
export function calcViewPoolBonus(
  totalViews: number,
  config: Pick<
    Required<PrimPoolConfig>,
    | "viewPoolBonusEnabled"
    | "viewPoolBonusMinViews"
    | "viewPoolBonusThresholdViews"
    | "viewPoolBonusPerStepUsd"
    | "viewPoolBonusTiers"
  >,
): { billableViews: number; steps: number; bonusUsd: number } {
  if (!config.viewPoolBonusEnabled) {
    return { billableViews: 0, steps: 0, bonusUsd: 0 };
  }

  const minGate = Math.max(0, config.viewPoolBonusMinViews ?? 0);
  const defaultStep = config.viewPoolBonusThresholdViews ?? 1_000_000;
  const billable = Math.max(0, totalViews - minGate);
  if (billable <= 0 || defaultStep <= 0) {
    return { billableViews: 0, steps: 0, bonusUsd: 0 };
  }

  const tiers =
    config.viewPoolBonusTiers.length > 0
      ? config.viewPoolBonusTiers
      : [{ upToBillableViews: Infinity, perStepUsd: config.viewPoolBonusPerStepUsd, stepViews: defaultStep }];

  let bonusUsd = 0;
  let steps = 0;
  let cursor = 0;

  for (const tier of tiers) {
    if (cursor >= billable) break;
    const tierEnd =
      tier.upToBillableViews === Infinity
        ? billable
        : Math.min(billable, tier.upToBillableViews);
    const tierSpan = Math.max(0, tierEnd - cursor);
    if (tierSpan <= 0) continue;

    const step = tier.stepViews ?? defaultStep;
    let tierSteps = Math.floor(tierSpan / step);
    if (tier.maxSteps != null) tierSteps = Math.min(tierSteps, tier.maxSteps);

    bonusUsd += tierSteps * tier.perStepUsd;
    steps += tierSteps;
    cursor += tierSteps * step;
  }

  return { billableViews: billable, steps, bonusUsd };
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
  recipients: {
    id: string;
    name: string;
    nickname?: string;
    kind: string;
    weight: number;
    points?: number;
    qualityMultiplier?: number;
  }[];
  /** Aktif kasaların toplam bakiyesi (USD). kasa_share modunda kullanılır. */
  kasaBalanceUsd?: number;
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
  const manualExpenseUsd = (config.manualExpenses ?? []).reduce(
    (s, e) => s + (Number.isFinite(e.amountUsd) ? e.amountUsd : 0),
    0,
  );
  const totalOpsUsd =
    input.payrollUsd + input.contentExpenseUsd + input.generalExpenseUsd + manualExpenseUsd;
  const netPoolUsd = totalRevenueUsd - totalOpsUsd;
  const positiveNet = Math.max(0, netPoolUsd);
  const payrollContentNetUsd = totalRevenueUsd - input.payrollUsd - input.contentExpenseUsd;
  const positivePayrollContentNet = Math.max(0, payrollContentNetUsd);

  const totalGuaranteedViews = brandRows.reduce((s, r) => s + r.guaranteedViews, 0);
  const totalActualViews = brandRows.reduce((s, r) => s + r.actualViews, 0);
  const totalViewsOver = Math.max(0, totalActualViews - totalGuaranteedViews);
  const totalOverPct =
    totalGuaranteedViews > 0 ? totalViewsOver / totalGuaranteedViews : 0;
  const blendedCpmUsd = totalActualViews > 0 ? (totalRevenueUsd / totalActualViews) * 1000 : 0;

  // İzlenme havuz bonusu — min baraj + kademeli adımlar.
  const poolBonusCalc = calcViewPoolBonus(totalActualViews, config);
  const viewPoolBonusSteps = poolBonusCalc.steps;
  const viewPoolBonusUsd = poolBonusCalc.bonusUsd;
  const viewPoolBonusBillableViews = poolBonusCalc.billableViews;

  // Rezerv — gelecek aylar / kuru aylar / sürpriz giderler için dağıtımdan önce ayrılır.
  const reserveUsd = Math.min(
    positiveNet,
    config.monthlyReserveUsd + positiveNet * config.reserveRate
  );
  // Dağıtılabilir kâr = net − rezerv. İzlenme havuz bonusu ayrıca prim olarak eklenir.
  const distributablePoolUsd = Math.max(0, positiveNet - reserveUsd);

  // Net havuz tabanı kontrolü — yalnızca net bazlı modellerde geçerli.
  const belowFloor = config.model !== "revenue_share" && netPoolUsd < config.minNetFloorUsd;

  // Temel prim — sabit tutar, kasa payı veya orana göre, modele bağlı.
  const baseRateNetUsd =
    config.basePrimNetBasis === "after_payroll_content"
      ? positivePayrollContentNet
      : distributablePoolUsd;

  let rawBasePrimUsd = 0;
  if (!belowFloor) {
    if (config.basePrimMode === "fixed") {
      const cap = config.model === "revenue_share" ? Number.POSITIVE_INFINITY : distributablePoolUsd;
      rawBasePrimUsd = Math.min(config.fixedPrimUsd, cap);
    } else if (config.basePrimMode === "kasa_share") {
      const kasaBal = Math.max(0, input.kasaBalanceUsd ?? 0);
      const cap = config.model === "revenue_share" ? Number.POSITIVE_INFINITY : distributablePoolUsd;
      rawBasePrimUsd = Math.min(kasaBal * config.basePrimRate, cap);
    } else if (config.model === "net_share") {
      rawBasePrimUsd = baseRateNetUsd * config.basePrimRate;
      if (config.basePrimNetBasis === "after_payroll_content") {
        // Taban prim rezervden etkilenmez; yalnızca gerçek net kârı aşamaz.
        rawBasePrimUsd = Math.min(rawBasePrimUsd, positiveNet);
      }
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

  // Toplam prim tavanı — taban + izlenme bonusu kırpılabilir; izlenme havuz bonusu muaf kalabilir.
  const poolUncapped = config.viewPoolBonusUncapped;
  const rawPoolBonusUsd =
    poolUncapped || !belowFloor ? viewPoolBonusUsd : 0;
  const rawBaseAndView = rawBasePrimUsd + rawViewBonusUsd;
  let basePrimUsd = rawBasePrimUsd;
  let viewBonusUsd = rawViewBonusUsd;
  let poolBonusUsd = rawPoolBonusUsd;
  if (config.maxTotalPrimUsd > 0) {
    if (poolUncapped) {
      const capOnBaseView = Math.min(rawBaseAndView, config.maxTotalPrimUsd);
      const baseViewScale = rawBaseAndView > 0 ? capOnBaseView / rawBaseAndView : 0;
      basePrimUsd = rawBasePrimUsd * baseViewScale;
      viewBonusUsd = rawViewBonusUsd * baseViewScale;
      poolBonusUsd = rawPoolBonusUsd;
    } else {
      const grossPrimUsd = rawBaseAndView + rawPoolBonusUsd;
      const cappedPool = Math.min(grossPrimUsd, config.maxTotalPrimUsd);
      const totalCapScale = grossPrimUsd > 0 ? cappedPool / grossPrimUsd : 0;
      basePrimUsd = rawBasePrimUsd * totalCapScale;
      viewBonusUsd = rawViewBonusUsd * totalCapScale;
      poolBonusUsd = rawPoolBonusUsd * totalCapScale;
    }
  }

  const grossPrimUsd = basePrimUsd + viewBonusUsd + poolBonusUsd;

  // Dağıtım — puan × içerik kalitesi ile efektif ağırlık hesaplanır.
  const pointOf = (r: { points?: number; weight: number }) =>
    Math.max(0, r.points ?? r.weight);
  const qualityOf = (r: { qualityMultiplier?: number }) =>
    clampQualityMultiplier(r.qualityMultiplier ?? 1);
  const effectiveOf = (r: { points?: number; weight: number; qualityMultiplier?: number }) =>
    pointOf(r) * qualityOf(r);

  const distInput = input.recipients.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    weight: effectiveOf(r),
  }));
  const shares = distributionShares(distInput, config.distributionMode);
  const totalPoints = input.recipients.reduce((s, r) => s + pointOf(r), 0);
  const totalEffectivePoints = input.recipients.reduce((s, r) => s + effectiveOf(r), 0);
  const perPointUsd = totalEffectivePoints > 0 ? (basePrimUsd + poolBonusUsd) / totalEffectivePoints : 0;

  const recipients: PrimRecipientRow[] = input.recipients
    .filter((r) => effectiveOf(r) > 0)
    .map((r) => {
      const share = shares.get(r.id) ?? 0;
      const q = qualityOf(r);
      const pts = pointOf(r);
      const eff = effectiveOf(r);
      let baseShareUsd = basePrimUsd * share;
      let poolShareUsd = poolBonusUsd * share;
      let viewBonusShare = viewBonusUsd * share;
      if (config.maxPrimPerPersonUsd > 0) {
        const baseViewTotal = baseShareUsd + viewBonusShare;
        if (baseViewTotal > config.maxPrimPerPersonUsd) {
          const personScale = config.maxPrimPerPersonUsd / baseViewTotal;
          baseShareUsd *= personScale;
          viewBonusShare *= personScale;
        }
      }
      const totalUsd = baseShareUsd + poolShareUsd + viewBonusShare;
      return {
        employeeId: r.id,
        name: r.name,
        nickname: r.nickname,
        kind: r.kind,
        weight: r.weight,
        points: pts,
        qualityMultiplier: q,
        effectivePoints: eff,
        sharePct: share,
        baseShareUsd,
        poolShareUsd,
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
    payrollContentNetUsd,
    reserveUsd,
    distributablePoolUsd,
    netAfterPrimUsd,
    totalGuaranteedViews,
    totalActualViews,
    totalOverPct,
    blendedCpmUsd,
    viewTriggered,
    manualExpenseUsd,
    viewPoolBonusUsd,
    viewPoolBonusSteps,
    viewPoolBonusBillableViews,
    poolBonusUsd,
    totalPoints,
    perPointUsd,
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
  /** Kısa özet (kart başlığı altı). */
  description: string;
  /** Detaylı açıklama — ne varsayılıyor, prim nasıl etkilenir. */
  detail: string;
  revenueMultiplier: number;
  expenseMultiplier: number;
  viewsMultiplier: number;
};

export const DEFAULT_SCENARIOS: PrimScenario[] = [
  {
    key: "worst",
    label: "Kötü",
    description: "Gelir %30 düşük · gider %15 yüksek · izlenme yarıya yakın",
    detail:
      "Marka tahsilatları hedefin altında kalır, maaş ve operasyon giderleri artar, içerik performansı garantinin çok altında. Net havuz daralır; kasa payı ve izlenme primi birlikte düşer. Prim dağıtımı taban kontrolüne takılabilir.",
    revenueMultiplier: 0.7,
    expenseMultiplier: 1.15,
    viewsMultiplier: 0.55,
  },
  {
    key: "low",
    label: "Temkinli",
    description: "Hafif gelir düşüşü, kontrollü gider, orta izlenme",
    detail:
      "Yeni marka kaybı veya gecikmeli tahsilat senaryosu. Giderler hafif artar, izlenme hedefin %80'i civarında. Prim, baz senaryoya göre biraz daha düşük ama sıfırlanmaz.",
    revenueMultiplier: 0.9,
    expenseMultiplier: 1.05,
    viewsMultiplier: 0.8,
  },
  {
    key: "base",
    label: "Baz (gerçek)",
    description: "Paneldeki güncel marka, gider ve izlenme verileri",
    detail:
      "Bu ayın gerçek marka tahsilatı, maaş/içerik giderleri ve link izlenmeleri. " +
      "Prim = kalan kârın %10'u + izlenme havuz adımları.",
    revenueMultiplier: 1,
    expenseMultiplier: 1,
    viewsMultiplier: 1,
  },
  {
    key: "good",
    label: "İyi",
    description: "Gelir %15 üstü · gider %5 tasarruf · izlenme %40 fazla",
    detail:
      "Markalar hedefi aşar, içerik ekibi verimli çalışır, garanti üstü izlenme tetikleyicisi devreye girer. Net havuz genişler; kasa ve dağıtılabilir havuz büyüdükçe prim payı artar.",
    revenueMultiplier: 1.15,
    expenseMultiplier: 0.95,
    viewsMultiplier: 1.4,
  },
  {
    key: "aggressive",
    label: "Agresif",
    description: "Güçlü büyüme · düşük gider · viral izlenme patlaması",
    detail:
      "Yeni marka anlaşmaları, düşük operasyon maliyeti ve viral içerik dalgası. İzlenme garantisinin neredeyse iki katı; çarpanlı izlenme primi tavanına yaklaşabilir. En yüksek prim senaryosu.",
    revenueMultiplier: 1.3,
    expenseMultiplier: 0.9,
    viewsMultiplier: 1.9,
  },
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
  recipients: {
    id: string;
    name: string;
    nickname?: string;
    kind: string;
    weight: number;
    points?: number;
    qualityMultiplier?: number;
  }[];
  /** Aktif kasaların toplam bakiyesi — senaryoda net havuzla ölçeklenir. */
  kasaBalanceUsd?: number;
  config?: PrimPoolConfig;
};

/** İçerik kalitesi seçenekleri — prim payını etkiler. */
export const PRIM_QUALITY_PRESETS = [
  { value: 0.75, label: "Düşük", hint: "Zayıf içerik · prim %25 azalır" },
  { value: 1, label: "Normal", hint: "Standart kalite" },
  { value: 1.25, label: "İyi", hint: "Kaliteli içerik · prim %25 artar" },
  { value: 1.5, label: "Üstün", hint: "Çok iyi içerik · prim %50 artar" },
] as const;

export function clampQualityMultiplier(v: number): number {
  return Math.max(0.5, Math.min(1.5, v));
}

/** Prim sayfasında bir kişiye dair özelleştirme (takma ad, puan, kalite, custom kişi). */
export type PrimRecipientMeta = {
  name?: string;
  nickname?: string;
  /** Prim dağıtımından çıkarıldı mı? (bordroyu etkilemez, sadece prim listesi). */
  excluded?: boolean;
  /** İçerik kalitesi çarpanı (kalıcı varsayılan). */
  qualityMultiplier?: number;
};

/** Prim sayfasına elle eklenen, bordro dışı kişi. */
export type PrimCustomRecipient = {
  id: string;
  name: string;
  nickname?: string;
  kind: string;
};

function scaleRecord(rec: Record<string, number>, mult: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(rec)) out[k] = rec[k] * mult;
  return out;
}

/** Senaryoda kasa bakiyesini net havuz değişimine göre ölçekle (prim farklılaşsın). */
export function scaleKasaForScenario(
  baseKasaUsd: number,
  baseDistributableUsd: number,
  scenarioDistributableUsd: number,
  scenario: PrimScenario,
): number {
  if (baseKasaUsd <= 0) return 0;
  if (baseDistributableUsd > 0) {
    const ratio = scenarioDistributableUsd / baseDistributableUsd;
    return baseKasaUsd * Math.max(0.25, Math.min(2, ratio));
  }
  const blend = (scenario.revenueMultiplier * 0.55 + (2 - scenario.expenseMultiplier) * 0.45);
  return baseKasaUsd * Math.max(0.25, Math.min(2, blend));
}

/** Senaryo primi için sabit tutar modunu geçici olarak kasa/net payına çevir. */
export function scenarioPrimConfig(base: PrimBaseInputs): PrimPoolConfig | undefined {
  const cfg = base.config;
  if (!cfg) return undefined;
  if (cfg.basePrimMode === "fixed") {
    return {
      ...cfg,
      basePrimMode: "rate",
      basePrimRate: cfg.basePrimRate > 0 ? cfg.basePrimRate : 0.12,
    };
  }
  return cfg;
}

export function computeWithScenario(base: PrimBaseInputs, scenario: PrimScenario): PrimPoolResult {
  const scaledInput = {
    monthYm: base.monthYm,
    brands: base.brands,
    brandFees: scaleRecord(base.brandFees, scenario.revenueMultiplier),
    brandGuarantees: base.brandGuarantees,
    brandViews: scaleRecord(base.brandViews, scenario.viewsMultiplier),
    payrollUsd: base.payrollUsd * scenario.expenseMultiplier,
    contentExpenseUsd: base.contentExpenseUsd * scenario.expenseMultiplier,
    generalExpenseUsd: base.generalExpenseUsd * scenario.expenseMultiplier,
    recipients: base.recipients,
    config: scenarioPrimConfig(base),
  };

  const baseRef =
    base.kasaBalanceUsd != null && base.kasaBalanceUsd > 0
      ? computePrimPool({ ...base, config: scenarioPrimConfig(base) })
      : null;

  const scenarioKasa =
    baseRef && base.kasaBalanceUsd != null
      ? scaleKasaForScenario(
          base.kasaBalanceUsd,
          baseRef.distributablePoolUsd,
          computePrimPool(scaledInput).distributablePoolUsd,
          scenario,
        )
      : base.kasaBalanceUsd;

  return computePrimPool({
    ...scaledInput,
    kasaBalanceUsd: scenarioKasa,
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
  /** Kişi başı performans puanı (yoksa varsayılan 1). */
  recipientPoints?: Record<string, number>;
  /** Kişi başı takma ad / isim override. */
  recipientMeta?: Record<string, PrimRecipientMeta>;
  /** Ay bazlı içerik kalitesi çarpanı (0.75–1.5). */
  recipientQuality?: Record<string, number>;
  /** Bordro dışı, elle eklenen kişiler. */
  customRecipients?: PrimCustomRecipient[];
  kasaBalanceUsd?: number;
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

  /** Puan: ayrı puan kaydı varsa onu, yoksa eski ağırlığı, o da yoksa role göre 1/2 baz. */
  const pointsFor = (e: Employee): number => {
    const explicit = input.recipientPoints?.[e.id];
    if (explicit !== undefined) return Math.max(0, explicit);
    const legacyWeight = input.recipientWeights?.[e.id];
    if (legacyWeight !== undefined) return Math.max(0, Math.round(legacyWeight * 2));
    return e.kind === "moderator" ? 1.5 : 2;
  };

  const qualityFor = (id: string): number => {
    const fromMonth = input.recipientQuality?.[id];
    if (fromMonth !== undefined) return clampQualityMultiplier(fromMonth);
    const fromMeta = input.recipientMeta?.[id]?.qualityMultiplier;
    if (fromMeta !== undefined) return clampQualityMultiplier(fromMeta);
    return 1;
  };

  const employeeRecipients = input.employees
    .filter((e) => e.kind !== "coordinator" && isPrimEligible(e, input.monthYm))
    .filter((e) => !input.recipientMeta?.[e.id]?.excluded)
    .map((e) => {
      const meta = input.recipientMeta?.[e.id];
      const proration = payrollProrationFactor(e, input.monthYm);
      const points = Math.round(pointsFor(e) * proration * 100) / 100;
      return {
        id: e.id,
        name: meta?.name?.trim() || e.name,
        nickname: meta?.nickname?.trim() || undefined,
        kind: e.kind,
        weight: points,
        points,
        qualityMultiplier: qualityFor(e.id),
      };
    })
    .filter((r) => r.points > 0);

  const customRecipientRows = (input.customRecipients ?? [])
    .filter((c) => !input.recipientMeta?.[c.id]?.excluded)
    .map((c) => {
    const meta = input.recipientMeta?.[c.id];
    const points = Math.max(0, input.recipientPoints?.[c.id] ?? 1);
    return {
      id: c.id,
      name: meta?.name?.trim() || c.name,
      nickname: meta?.nickname?.trim() || c.nickname || undefined,
      kind: c.kind,
      weight: points,
      points,
      qualityMultiplier: qualityFor(c.id),
    };
  }).filter((r) => r.points > 0);

  const recipients = [...employeeRecipients, ...customRecipientRows];

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
    kasaBalanceUsd: input.kasaBalanceUsd,
    config: input.config,
  };
}

/** Prim hesabı için kasa payı özeti. */
export function describePrimBaseSource(
  result: PrimPoolResult,
  kasaBalanceUsd: number,
): string {
  const cfg = result.config;
  if (cfg.basePrimMode === "kasa_share" && kasaBalanceUsd > 0) {
    return `Kasa ${fmtPrimUsd(kasaBalanceUsd)} × ${pctLabel(cfg.basePrimRate)}`;
  }
  if (cfg.basePrimMode === "fixed") {
    return `Sabit prim ${fmtPrimUsd(cfg.fixedPrimUsd)}`;
  }
  if (cfg.basePrimNetBasis === "after_payroll_content") {
    return `Kalan (gelir−maaş−içerik) ${pctLabel(cfg.basePrimRate)}`;
  }
  if (cfg.model === "revenue_share") {
    return `Gelir ${pctLabel(cfg.revenueShareRate)}`;
  }
  return `Dağıtılabilir kâr ${pctLabel(cfg.basePrimRate)}`;
}

/** Tek satırlık prim formülü — özet kartları için. */
export function describePrimFormula(result: PrimPoolResult): string {
  const parts: string[] = [];
  if (result.basePrimUsd > 0) parts.push(`taban ${fmtPrimUsd(result.basePrimUsd)}`);
  if (result.poolBonusUsd > 0) parts.push(`havuz ${fmtPrimUsd(result.poolBonusUsd)}`);
  if (result.viewBonusUsd > 0) parts.push(`izlenme ${fmtPrimUsd(result.viewBonusUsd)}`);
  if (parts.length === 0) return "Bu ay prim dağıtılmıyor";
  return parts.join(" + ") + ` = ${fmtPrimUsd(result.totalPrimUsd)}`;
}

export type PrimRuleStatus = "ok" | "warn" | "off";

/** Anlaşılır prim kuralları listesi — panelde gösterilir. */
export type PrimRuleLine = {
  id: string;
  step: number;
  title: string;
  description: string;
  value?: string;
  status: PrimRuleStatus;
};

/** İzlenme havuz bonusu kural metni. */
export function describeViewPoolBonusRules(cfg: Required<PrimPoolConfig>): string {
  if (!cfg.viewPoolBonusEnabled) return "Link izlenme havuz bonusu kapalı.";
  const min = cfg.viewPoolBonusMinViews ?? 0;
  const step = fmtCompactViews(cfg.viewPoolBonusThresholdViews);
  const parts: string[] = [];
  if (min > 0) {
    parts.push(`Önce ${fmtCompactViews(min)} toplam izlenme barajı geçilir`);
  }
  if (cfg.viewPoolBonusTiers.length > 0) {
    const tierText = cfg.viewPoolBonusTiers
      .map((t, i) => {
        const prev = i === 0 ? 0 : cfg.viewPoolBonusTiers[i - 1].upToBillableViews;
        const to =
          t.upToBillableViews === Infinity
            ? "üstü"
            : fmtCompactViews(min + t.upToBillableViews);
        const from = fmtCompactViews(min + prev);
        const cap = t.maxSteps ? ` (max ${t.maxSteps} adım)` : "";
        return `${from}–${to}: her ${step} +${fmtPrimUsd(t.perStepUsd)}${cap}`;
      })
      .join(" · ");
    parts.push(`sonra kademeli: ${tierText}`);
  } else {
    parts.push(`her ${step} izlenme +${fmtPrimUsd(cfg.viewPoolBonusPerStepUsd)}`);
  }
  return parts.join("; ") + ".";
}

export function buildPrimRules(result: PrimPoolResult): PrimRuleLine[] {
  const cfg = result.config;
  const belowFloor = result.netPoolUsd < cfg.minNetFloorUsd;
  const pct = Math.round(cfg.basePrimRate * 100);

  const viewBonusDesc =
    cfg.viewBonusMode === "off"
      ? "İzlenme CPM bonusu kapalı — link izlenmeleri yalnızca havuz adımıyla ödüllendirilir."
      : cfg.viewBonusMode === "cpm"
        ? `Garanti üstü her 1.000 izlenme için +${fmtPrimUsd(cfg.viewCpmBonusUsd)} eklenir.`
        : `Garanti her %10 aşıldıkça taban prim +%${Math.round(cfg.viewTriggerStepRate * 100)} artar.`;

  const poolBonusDesc = describeViewPoolBonusRules(cfg) +
    (cfg.viewPoolBonusEnabled
      ? ` Bu ay ${fmtCompactViews(result.totalActualViews)} toplam` +
        (result.viewPoolBonusBillableViews > 0
          ? `, baraj sonrası ${fmtCompactViews(result.viewPoolBonusBillableViews)} fatura edildi = ${result.viewPoolBonusSteps} adım.`
          : ` — baraj (${fmtCompactViews(cfg.viewPoolBonusMinViews)}) henüz geçilmedi.`)
      : "");

  const baseDesc =
    cfg.basePrimMode === "fixed"
      ? `Sabit ${fmtPrimUsd(cfg.fixedPrimUsd)} taban prim.`
      : cfg.basePrimNetBasis === "after_payroll_content"
        ? `Marka geliri − maaş − içerik = ${fmtPrimUsd(result.payrollContentNetUsd)} kalan. Bunun %${pct}'u (${fmtPrimUsd(result.basePrimUsd)}) prim havuzuna girer.`
        : `Dağıtılabilir kârın %${pct}'u taban prim olarak hesaplanır.`;

  return [
    {
      id: "revenue",
      step: 1,
      title: "Marka tahsilatları",
      description: `${result.brandRows.length} markadan bu ay toplanan gelir. Prim hesabının başlangıç noktası.`,
      value: fmtPrimUsd(result.totalRevenueUsd),
      status: result.totalRevenueUsd > 0 ? "ok" : "warn",
    },
    {
      id: "ops",
      step: 2,
      title: "Maaş & içerik düşüldü",
      description: `Bordro ${fmtPrimUsd(result.payrollUsd)} + içerik ${fmtPrimUsd(result.contentExpenseUsd)} düşülünce kalan ${fmtPrimUsd(result.payrollContentNetUsd)}. (Genel giderler ayrıca net kârı etkiler.)`,
      value: fmtPrimUsd(result.payrollContentNetUsd),
      status: result.payrollContentNetUsd > 0 ? "ok" : "warn",
    },
    {
      id: "base",
      step: 3,
      title: cfg.basePrimMode === "fixed" ? "Sabit taban prim" : `Taban prim (%${pct})`,
      description: belowFloor && cfg.minNetFloorUsd > 0
        ? `Net kâr tabanın (${fmtPrimUsd(cfg.minNetFloorUsd)}) altında — taban prim yok.`
        : baseDesc,
      value: fmtPrimUsd(result.basePrimUsd),
      status: result.basePrimUsd > 0 ? "ok" : belowFloor ? "warn" : "off",
    },
    {
      id: "pool-bonus",
      step: 4,
      title: "Link & platform izlenmeleri",
      description: poolBonusDesc,
      value: result.poolBonusUsd > 0 ? fmtPrimUsd(result.poolBonusUsd) : cfg.viewPoolBonusEnabled ? "$0" : "Kapalı",
      status: !cfg.viewPoolBonusEnabled ? "off" : result.poolBonusUsd > 0 ? "ok" : "warn",
    },
    {
      id: "views",
      step: 5,
      title: "Ek izlenme bonusu (opsiyonel)",
      description: `${viewBonusDesc} ${fmtCompactViews(result.totalActualViews)} / ${fmtCompactViews(result.totalGuaranteedViews)} garanti.`,
      value: result.viewBonusUsd > 0 ? fmtPrimUsd(result.viewBonusUsd) : cfg.viewBonusMode === "off" ? "Kapalı" : "Henüz yok",
      status: cfg.viewBonusMode === "off" ? "off" : result.viewBonusUsd > 0 ? "ok" : "warn",
    },
    {
      id: "split",
      step: 6,
      title: "Kişilere dağıtım",
      description: `Toplam ${fmtPrimUsd(result.totalPrimUsd)} → ${result.recipients.length} kişi, puan × kalite. 1 efektif puan = ${fmtPrimUsd(result.perPointUsd)}.`,
      value: `${result.recipients.reduce((s, r) => s + r.effectivePoints, 0)} efektif puan`,
      status: result.recipients.length > 0 ? "ok" : "warn",
    },
    {
      id: "quality",
      step: 7,
      title: "İçerik kalitesi",
      description:
        "Çekilen içeriğin kalitesi payı değiştirir: Düşük ×0.75, Normal ×1, İyi ×1.25, Üstün ×1.5.",
      value: result.recipients.some((r) => r.qualityMultiplier !== 1) ? "Ayarlı" : "Hepsi normal",
      status: result.recipients.some((r) => r.qualityMultiplier !== 1) ? "ok" : "off",
    },
  ];
}

/** "Ne olursa ne kadar prim?" — somut if-then rehberi. */
export type PrimScenarioRow = {
  when: string;
  then: string;
  amount: string;
  /** Bu ay bu kural devrede / tetiklendi mi */
  active: boolean;
};

export function buildPrimScenarioGuide(result: PrimPoolResult): PrimScenarioRow[] {
  const cfg = result.config;
  const belowFloor = result.netPoolUsd < cfg.minNetFloorUsd;
  const pct = Math.round(cfg.basePrimRate * 100);
  const rows: PrimScenarioRow[] = [];

  rows.push({
    when: "Marka tahsilatları toplandı",
    then: `${result.brandRows.length} markanın aylık geliri`,
    amount: fmtPrimUsd(result.totalRevenueUsd),
    active: result.totalRevenueUsd > 0,
  });
  rows.push({
    when: "Maaş ve içerik ödemeleri düşüldü",
    then: `Bordro + içerik gideri çıkarıldı`,
    amount: fmtPrimUsd(result.payrollContentNetUsd),
    active: result.payrollContentNetUsd > 0,
  });

  if (cfg.basePrimMode === "rate" && cfg.basePrimNetBasis === "after_payroll_content") {
    rows.push({
      when: `Kalan tutarın %${pct}'u (sabit oran)`,
      then: "Taban prim havuzuna aktarılır",
      amount: fmtPrimUsd(result.basePrimUsd),
      active: result.basePrimUsd > 0 && !belowFloor,
    });
    rows.push({
      when: `Örnek: kalan ${fmtPrimUsd(50_000)} ise`,
      then: `Taban prim = %${pct}`,
      amount: fmtPrimUsd(50_000 * cfg.basePrimRate),
      active: false,
    });
  } else if (cfg.basePrimMode === "fixed") {
    rows.push({
      when: "Her ay sabit taban prim",
      then: "Puana göre bölünür",
      amount: fmtPrimUsd(cfg.fixedPrimUsd),
      active: result.basePrimUsd > 0,
    });
  }

  if (cfg.minNetFloorUsd > 0) {
    rows.push({
      when: `Net kâr ${fmtPrimUsd(cfg.minNetFloorUsd)} altına düşerse`,
      then:
        cfg.viewPoolBonusUncapped && cfg.viewPoolBonusEnabled
          ? "Taban prim yok — izlenme havuzu yine ödenir"
          : "Prim dağıtılmaz",
      amount: belowFloor && result.poolBonusUsd > 0 ? fmtPrimUsd(result.poolBonusUsd) : "$0",
      active: belowFloor,
    });
  }

  if (cfg.viewPoolBonusEnabled) {
    if (cfg.viewPoolBonusMinViews > 0) {
      rows.push({
        when: `Toplam izlenme ${fmtCompactViews(cfg.viewPoolBonusMinViews)} barajını geçerse`,
        then: "İzlenme havuz bonusu sayılmaya başlar",
        amount: fmtPrimUsd(result.poolBonusUsd),
        active: result.viewPoolBonusBillableViews > 0,
      });
    }
    if (cfg.viewPoolBonusTiers.length > 0) {
      rows.push({
        when: "Baraj sonrası kademeli ödeme",
        then: describeViewPoolBonusRules(cfg),
        amount: "Kademeli",
        active: true,
      });
      const ex100M = calcViewPoolBonus(100_000_000, cfg);
      rows.push({
        when: "100 milyon izlenme (örnek)",
        then: `${ex100M.steps} adım, baraj sonrası kademeli`,
        amount: fmtPrimUsd(ex100M.bonusUsd),
        active: result.totalActualViews >= 100_000_000,
      });
    } else {
      rows.push({
        when: `Her ${fmtCompactViews(cfg.viewPoolBonusThresholdViews)} link izlenmesi (baraj sonrası)`,
        then: "Prim havuzuna eklenir",
        amount: `+${fmtPrimUsd(cfg.viewPoolBonusPerStepUsd)}`,
        active: true,
      });
    }
    const minGate = cfg.viewPoolBonusMinViews ?? 0;
    const nextBillableNeeded =
      result.viewPoolBonusSteps > 0
        ? (result.viewPoolBonusSteps + 1) * cfg.viewPoolBonusThresholdViews - result.viewPoolBonusBillableViews
        : Math.max(0, minGate - result.totalActualViews);
    rows.push({
      when: `Bu ay ${fmtCompactViews(result.totalActualViews)} izlenme (${result.viewPoolBonusSteps} adım)`,
      then:
        result.viewPoolBonusSteps > 0
          ? `Baraj sonrası ${fmtCompactViews(result.viewPoolBonusBillableViews)} fatura edildi`
          : minGate > 0
            ? `Baraj için ${fmtCompactViews(nextBillableNeeded)} izlenme daha`
            : "Henüz adım yok",
      amount: fmtPrimUsd(result.poolBonusUsd),
      active: result.poolBonusUsd > 0,
    });
  }

  if (!belowFloor || result.poolBonusUsd > 0) {
    if (cfg.basePrimMode === "fixed" && belowFloor) {
      // fixed mode floor handled above
    } else if (cfg.basePrimMode === "rate" && cfg.basePrimNetBasis === "distributable") {
      rows.push({
        when: `Dağıtılabilir kârın %${pct}'u`,
        then: "Taban prim",
        amount: fmtPrimUsd(result.basePrimUsd),
        active: result.basePrimUsd > 0,
      });
    }

    if (cfg.viewBonusMode === "cpm") {
      rows.push({
        when: "Toplam izlenme marka garantisini geçerse",
        then: `Fazla her 1.000 izlenme için ek prim`,
        amount: `+${fmtPrimUsd(cfg.viewCpmBonusUsd)} / 1K`,
        active: result.viewTriggered,
      });
      if (result.viewTriggered) {
        const over = Math.max(0, result.totalActualViews - result.totalGuaranteedViews);
        rows.push({
          when: `Bu ay +${fmtCompactViews(over)} garanti üstü izlenme`,
          then: "İzlenme bonusu kişilere dağıtılır",
          amount: fmtPrimUsd(result.viewBonusUsd),
          active: result.viewBonusUsd > 0,
        });
      }
    } else if (cfg.viewBonusMode === "multiplier") {
      rows.push({
        when: "İzlenme garantisi aşılınca",
        then: `Taban prim her %10 aşımda +%${Math.round(cfg.viewTriggerStepRate * 100)} artar`,
        amount: `max +%${Math.round(cfg.viewTriggerCap * 100)}`,
        active: result.viewTriggered,
      });
    }

    rows.push({
      when: "1 puan + normal kalite (×1)",
      then: "Havuzdan pay alır",
      amount: fmtPrimUsd(result.perPointUsd),
      active: result.perPointUsd > 0,
    });
    rows.push({
      when: "2 puan + normal kalite (×1)",
      then: "1 puanlı kişinin 2 katını alır",
      amount: fmtPrimUsd(result.perPointUsd * 2),
      active: result.perPointUsd > 0,
    });
    rows.push({
      when: "1 puan + üstün kalite (×1.5)",
      then: "Normal kaliteden %50 fazla alır",
      amount: fmtPrimUsd(result.perPointUsd * 1.5),
      active: result.perPointUsd > 0,
    });
    rows.push({
      when: "1 puan + düşük kalite (×0.75)",
      then: "Normal kaliteden %25 az alır",
      amount: fmtPrimUsd(result.perPointUsd * 0.75),
      active: result.perPointUsd > 0,
    });

    if ((cfg.maxPrimPerPersonUsd ?? 0) > 0) {
      rows.push({
        when: "Bir kişinin primi tavanı aşarsa",
        then: "Kişi başı üst sınır uygulanır",
        amount: fmtPrimUsd(cfg.maxPrimPerPersonUsd),
        active: result.cappedAmountUsd > 1,
      });
    }

    rows.push({
      when: "Bu ayın sonucu",
      then: `${result.recipients.length} kişiye toplam prim`,
      amount: fmtPrimUsd(result.totalPrimUsd),
      active: result.totalPrimUsd > 0,
    });
  } else if (result.poolBonusUsd > 0) {
    rows.push({
      when: "Bu ayın sonucu (kâr tabanı altı)",
      then: "Yalnızca izlenme havuz bonusu dağıtıldı",
      amount: fmtPrimUsd(result.totalPrimUsd),
      active: true,
    });
  }

  return rows;
}

function fmtCompactViews(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString("tr-TR");
}

function pctLabel(rate: number): string {
  return `%${Math.round(rate * 100)}`;
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
  kasaBalanceUsd?: number;
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
    kasaBalanceUsd: base.kasaBalanceUsd,
    config: input.config,
  });
}

export function fmtPrimUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("tr-TR")}`;
}
