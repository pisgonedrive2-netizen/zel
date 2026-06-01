import type { BrandMonthlyStats } from "@/store/store";
import {
  deriveBrandMonthlyStats,
  deriveLiveDemoUsage,
  type BrandStatsCurrency,
} from "@/lib/brand-monthly-stats";
import { shiftCalendarMonthYm } from "@/lib/data";

/** iGaming operasyon metrikleri için Türkçe etiketler ve kısa açıklamalar. */
export const IGAMING_LABELS = {
  netDeposit: "Net Yatırım (GGR göstergesi)",
  totalDeposit: "Toplam Yatırım",
  totalWithdrawal: "Toplam Çekim",
  withdrawalRatio: "Çekim / Yatırım oranı",
  ftd: "FTD (ilk yatırım)",
  ftdConversion: "FTD dönüşümü",
  depositingMembers: "Yatırım yapan üye",
  newRegistrations: "Yeni kayıt",
  registrationToDeposit: "Kayıt → Yatırım dönüşümü",
  arpu: "ARPU (üye başı yatırım)",
  depositsPerMember: "Ort. yatırım adedi / üye",
  monthExpense: "Pazarlama / içerik harcaması",
  marketingEfficiency: "Pazarlama verimliliği",
} as const;

export const IGAMING_HINTS = {
  netDeposit: "Toplam yatırım − toplam çekim",
  withdrawalRatio: "Çekimin yatırıma oranı — düşük olması olumlu",
  ftdConversion: "İlk yatırım / yeni kayıt",
  registrationToDeposit: "Yatırım yapan üye / yeni kayıt",
  arpu: "Yatırım tutarı / yatırım yapan üye",
  depositsPerMember: "Yatırım işlem adedi / yatırım yapan üye",
  marketingEfficiency: "Net yatırımın içerik harcamasına oranı (kat)",
} as const;

export interface IgamingMetrics {
  currency: BrandStatsCurrency;
  netDeposit: number;
  totalDeposit: number;
  totalWithdrawal: number;
  /** Çekim / yatırım (%) — yatırım 0 ise null. */
  withdrawalRatioPct: number | null;
  ftd: number;
  /** FTD / yeni kayıt (%) — kayıt 0 ise null. */
  ftdConversionPct: number | null;
  depositingMembers: number;
  newRegistrations: number;
  /** Yatırım yapan üye / yeni kayıt (%) — kayıt 0 ise null. */
  registrationToDepositPct: number | null;
  /** Üye başı ortalama yatırım tutarı (ARPU). */
  arpu: number | null;
  /** Üye başı ortalama yatırım işlem adedi. */
  depositsPerMember: number | null;
  /** Bu markaya yazılan içerik/pazarlama harcaması (USD pay). */
  monthExpense: number;
  /** Net yatırım / harcama (kat) — harcama 0 ise null. */
  marketingEfficiency: number | null;
}

/**
 * Seçili ayın operatör verisinden iGaming KPI seti türetir.
 * `monthExpense` markaya düşen içerik harcaması payıdır (USD).
 */
export function deriveIgamingMetrics(
  s: BrandMonthlyStats,
  monthExpense: number
): IgamingMetrics {
  const base = deriveBrandMonthlyStats(s);
  const withdrawalRatioPct =
    s.depositAmount > 0
      ? (s.withdrawalAmount / s.depositAmount) * 100
      : null;
  const ftdConversionPct =
    s.newRegistrations > 0
      ? Math.min(100, (s.firstTimeDepositors / s.newRegistrations) * 100)
      : null;
  const depositsPerMember =
    s.depositingMembers > 0 ? s.depositCount / s.depositingMembers : null;
  const marketingEfficiency =
    monthExpense > 0 ? base.netDeposit / monthExpense : null;

  return {
    currency: base.currency,
    netDeposit: base.netDeposit,
    totalDeposit: s.depositAmount,
    totalWithdrawal: s.withdrawalAmount,
    withdrawalRatioPct,
    ftd: s.firstTimeDepositors,
    ftdConversionPct,
    depositingMembers: s.depositingMembers,
    newRegistrations: s.newRegistrations,
    registrationToDepositPct: base.registrationToDepositPct,
    arpu: base.avgDepositPerMember,
    depositsPerMember,
    monthExpense,
    marketingEfficiency,
  };
}

/** Bir önceki ayın YYYY-MM değeri. */
export function previousMonthYm(monthYm: string): string {
  return shiftCalendarMonthYm(monthYm, -1);
}

export type DeltaDirection = "up" | "down" | "flat";

export interface MetricDelta {
  direction: DeltaDirection;
  /** Yüzde değişim — önceki değer 0/yok ise null. */
  pct: number | null;
  /** Mutlak fark. */
  diff: number;
}

/**
 * İki dönem arası değişim. Önceki değer yoksa null → "—" gösterilir.
 * Yüzde, önceki değerin mutlak değerine göre hesaplanır (negatif net yatırım için doğru yön).
 */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined
): MetricDelta | null {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  const direction: DeltaDirection =
    diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : null;
  return { direction, pct, diff };
}

export type InsightTone = "positive" | "warning" | "neutral";

export interface OperationInsight {
  tone: InsightTone;
  text: string;
}

/**
 * Saf sezgisel (heuristic) operasyon içgörüleri. Veriden Türkçe uyarı/öneri üretir.
 * Eşikler iGaming için makul varsayılanlardır; tamamen mevcut metriklere dayanır.
 */
export function generateOperationInsights(
  m: IgamingMetrics,
  prev: IgamingMetrics | null,
  liveDemo: ReturnType<typeof deriveLiveDemoUsage>
): OperationInsight[] {
  const out: OperationInsight[] = [];

  // Net yatırım trendi
  if (prev) {
    const d = computeDelta(m.netDeposit, prev.netDeposit);
    if (d && d.pct != null && Math.abs(d.pct) >= 5) {
      out.push({
        tone: d.direction === "up" ? "positive" : "warning",
        text:
          d.direction === "up"
            ? `Net yatırım geçen aya göre %${Math.abs(d.pct).toFixed(0)} arttı.`
            : `Net yatırım geçen aya göre %${Math.abs(d.pct).toFixed(0)} azaldı.`,
      });
    }
  }

  // Çekim / yatırım oranı
  if (m.withdrawalRatioPct != null) {
    if (m.withdrawalRatioPct >= 80) {
      out.push({
        tone: "warning",
        text: `Çekim oranı yüksek (%${m.withdrawalRatioPct.toFixed(0)}); net yatırım baskı altında.`,
      });
    } else if (m.withdrawalRatioPct <= 50 && m.totalDeposit > 0) {
      out.push({
        tone: "positive",
        text: `Çekim oranı sağlıklı (%${m.withdrawalRatioPct.toFixed(0)}).`,
      });
    }
  }

  // FTD dönüşümü
  if (m.ftdConversionPct != null) {
    if (m.ftdConversionPct < 10) {
      out.push({
        tone: "warning",
        text: `FTD dönüşümü düşük (%${m.ftdConversionPct.toFixed(1)}); kayıt sonrası ilk yatırım akışı zayıf.`,
      });
    } else if (m.ftdConversionPct >= 25) {
      out.push({
        tone: "positive",
        text: `FTD dönüşümü güçlü (%${m.ftdConversionPct.toFixed(1)}).`,
      });
    }
  }

  // Kayıt → yatırım dönüşümü
  if (m.registrationToDepositPct != null && m.registrationToDepositPct < 15) {
    out.push({
      tone: "warning",
      text: `Kayıt → yatırım dönüşümü düşük (%${m.registrationToDepositPct.toFixed(1)}).`,
    });
  }

  // Demo bakiyesi
  if (liveDemo.low) {
    out.push({
      tone: "warning",
      text: "Demo bakiyesi azalıyor (%20 altı); yeni tahsis gerekebilir.",
    });
  }

  // Pazarlama verimliliği
  if (m.marketingEfficiency != null) {
    if (m.marketingEfficiency >= 3) {
      out.push({
        tone: "positive",
        text: `Pazarlama verimliliği yüksek: harcamanın ${m.marketingEfficiency.toFixed(1)} katı net yatırım.`,
      });
    } else if (m.marketingEfficiency < 1) {
      out.push({
        tone: "warning",
        text: `Pazarlama verimliliği düşük: net yatırım harcamanın altında (${m.marketingEfficiency.toFixed(1)}x).`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      tone: "neutral",
      text: "Metrikler dengeli görünüyor; dikkat gerektiren belirgin bir sapma yok.",
    });
  }

  return out;
}

/** Yüzde gösterimi (null → "—"). */
export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `%${value.toFixed(digits)}`;
}

/** Kat (x) gösterimi (null → "—"). */
export function fmtMultiplier(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}x`;
}
