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
/** Temel prim nasıl belirlenir: orana göre, sabit tutar veya kasa payı. */
export type PrimBaseMode = "rate" | "fixed" | "kasa_share";
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
  /** İzlenme havuz bonusu açık mı? (eşik geçilince havuza ek para). */
  viewPoolBonusEnabled?: boolean;
  /** Bu kadar toplam izlenme tamamlandıkça havuza para eklenir. */
  viewPoolBonusThresholdViews?: number;
  /** Her eşik adımı için havuza eklenen tutar (USD). */
  viewPoolBonusPerStepUsd?: number;
  /** Bu sayfada elle eklenen ek giderler (reklam vb.) — net havuzdan düşülür. */
  manualExpenses?: PrimManualExpense[];
};

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
  basePrimRate: 0.12,
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
  fixed: "Bu ay dağıtılacak tutarı kendim yazarım (önerilen)",
  rate: "Net kârın yüzdesi (otomatik)",
  kasa_share: "Kasa bakiyesinin yüzdesi",
};

export const PRIM_VIEW_BONUS_LABELS: Record<PrimViewBonusMode, string> = {
  multiplier: "Garanti aşıldıkça primi yüzdeyle büyüt",
  cpm: "1000 izlenme başına $ ekle",
  off: "Kapalı",
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
  /** Elle eklenen ek giderlerin (reklam vb.) toplamı. */
  manualExpenseUsd: number;
  /** İzlenme eşiği geçilince havuza eklenen ek para. */
  viewPoolBonusUsd: number;
  /** İzlenme havuz bonusunun kaç eşik adımı tetiklendiği. */
  viewPoolBonusSteps: number;
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
    viewPoolBonusThresholdViews: c.viewPoolBonusThresholdViews ?? 1_000_000,
    viewPoolBonusPerStepUsd: c.viewPoolBonusPerStepUsd ?? 1_000,
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

  const totalGuaranteedViews = brandRows.reduce((s, r) => s + r.guaranteedViews, 0);
  const totalActualViews = brandRows.reduce((s, r) => s + r.actualViews, 0);
  const totalViewsOver = Math.max(0, totalActualViews - totalGuaranteedViews);
  const totalOverPct =
    totalGuaranteedViews > 0 ? totalViewsOver / totalGuaranteedViews : 0;
  const blendedCpmUsd = totalActualViews > 0 ? (totalRevenueUsd / totalActualViews) * 1000 : 0;

  // İzlenme havuz bonusu — toplam izlenme eşiği geçildikçe havuza ek para eklenir.
  let viewPoolBonusSteps = 0;
  let viewPoolBonusUsd = 0;
  if (
    config.viewPoolBonusEnabled &&
    config.viewPoolBonusThresholdViews > 0 &&
    config.viewPoolBonusPerStepUsd > 0
  ) {
    viewPoolBonusSteps = Math.floor(totalActualViews / config.viewPoolBonusThresholdViews);
    viewPoolBonusUsd = viewPoolBonusSteps * config.viewPoolBonusPerStepUsd;
  }

  // Rezerv — gelecek aylar / kuru aylar / sürpriz giderler için dağıtımdan önce ayrılır.
  const reserveUsd = Math.min(
    positiveNet,
    config.monthlyReserveUsd + positiveNet * config.reserveRate
  );
  // Dağıtılabilir havuz = (net − rezerv) + izlenme havuz bonusu.
  const distributablePoolUsd = Math.max(0, positiveNet - reserveUsd) + viewPoolBonusUsd;

  // Net havuz tabanı kontrolü — yalnızca net bazlı modellerde geçerli.
  const belowFloor = config.model !== "revenue_share" && netPoolUsd < config.minNetFloorUsd;

  // Temel prim — sabit tutar, kasa payı veya orana göre, modele bağlı.
  let rawBasePrimUsd = 0;
  if (!belowFloor) {
    if (config.basePrimMode === "fixed") {
      // Önce belirlenen sabit tutar — dağıtılabilir havuzu aşamaz (gider bağımsız model hariç).
      const cap = config.model === "revenue_share" ? Number.POSITIVE_INFINITY : distributablePoolUsd;
      rawBasePrimUsd = Math.min(config.fixedPrimUsd, cap);
    } else if (config.basePrimMode === "kasa_share") {
      const kasaBal = Math.max(0, input.kasaBalanceUsd ?? 0);
      const cap = config.model === "revenue_share" ? Number.POSITIVE_INFINITY : distributablePoolUsd;
      rawBasePrimUsd = Math.min(kasaBal * config.basePrimRate, cap);
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

  // Dağıtım — puan bazlı. Her kişinin puanı (yoksa eski ağırlık) dağıtımı belirler.
  const pointOf = (r: { points?: number; weight: number }) =>
    Math.max(0, r.points ?? r.weight);
  const distInput = input.recipients.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    weight: pointOf(r),
  }));
  const shares = distributionShares(distInput, config.distributionMode);
  const totalPoints = input.recipients.reduce((s, r) => s + pointOf(r), 0);
  const perPointUsd = totalPoints > 0 ? basePrimUsd / totalPoints : 0;

  const recipients: PrimRecipientRow[] = input.recipients
    .filter((r) => pointOf(r) > 0)
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
        nickname: r.nickname,
        kind: r.kind,
        weight: r.weight,
        points: pointOf(r),
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
    manualExpenseUsd,
    viewPoolBonusUsd,
    viewPoolBonusSteps,
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
      "Bu ayın gerçek tahsilat, operasyon gideri ve izlenme rakamları. Prim = kasa bakiyesinin belirlenen yüzdesi (üst sınır: dağıtılabilir havuz) + varsa izlenme bonusu.",
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
  }[];
  /** Aktif kasaların toplam bakiyesi — senaryoda net havuzla ölçeklenir. */
  kasaBalanceUsd?: number;
  config?: PrimPoolConfig;
};

/** Prim sayfasında bir kişiye dair özelleştirme (takma ad, puan, custom kişi). */
export type PrimRecipientMeta = {
  name?: string;
  nickname?: string;
  /** Prim dağıtımından çıkarıldı mı? (bordroyu etkilemez, sadece prim listesi). */
  excluded?: boolean;
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
    return e.kind === "moderator" ? 1 : 2;
  };

  const employeeRecipients = input.employees
    .filter((e) => e.kind !== "coordinator" && isPayrollActive(e, input.monthYm))
    .filter((e) => !input.recipientMeta?.[e.id]?.excluded)
    .map((e) => {
      const meta = input.recipientMeta?.[e.id];
      const points = pointsFor(e);
      return {
        id: e.id,
        name: meta?.name?.trim() || e.name,
        nickname: meta?.nickname?.trim() || undefined,
        kind: e.kind,
        weight: points,
        points,
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
    return `Sabit ${fmtPrimUsd(cfg.fixedPrimUsd)}`;
  }
  if (cfg.model === "revenue_share") {
    return `Gelir ${pctLabel(cfg.revenueShareRate)}`;
  }
  return `Dağıtılabilir havuz ${pctLabel(cfg.basePrimRate)}`;
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
