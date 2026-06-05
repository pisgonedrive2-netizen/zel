import type { BrandMonthlyStats } from "@/store/store";

export type BrandStatsCurrency = BrandMonthlyStats["currency"];

const EMPTY: Omit<BrandMonthlyStats, "id" | "brandId" | "month"> = {
  newRegistrations: 0,
  depositingMembers: 0,
  firstTimeDepositors: 0,
  depositCount: 0,
  depositAmount: 0,
  withdrawalAmount: 0,
  ggr: 0,
  ngr: 0,
  activePlayers: 0,
  bonusCost: 0,
  commissionTotal: 0,
  // USD platformun ana metriği; markalar genel olarak USD bazlı rapor veriyor.
  // Brand kullanıcısı isterse TRY/EUR seçebilir; PDF/CSV ve KPI'lar form.currency'ye göre çıkar.
  currency: "USD",
  liveDemoAllocated: 0,
  liveDemoRemaining: 0,
  liveDemoNotes: "",
  notes: "",
};

export function findBrandMonthlyStats(
  rows: BrandMonthlyStats[],
  brandId: string,
  monthYm: string
): BrandMonthlyStats | undefined {
  return rows.find((r) => r.brandId === brandId && r.month === monthYm);
}

/** Kayıt yoksa sıfır değerli taslak (kaydetmeden önce form için). */
export function draftBrandMonthlyStats(
  brandId: string,
  monthYm: string,
  existing?: BrandMonthlyStats
): BrandMonthlyStats {
  if (existing) return { ...existing };
  return {
    id: "",
    brandId,
    month: monthYm,
    ...EMPTY,
  };
}

export function hasBrandMonthlyStatsData(s: BrandMonthlyStats): boolean {
  return (
    s.newRegistrations > 0 ||
    s.depositingMembers > 0 ||
    s.firstTimeDepositors > 0 ||
    s.depositCount > 0 ||
    s.depositAmount > 0 ||
    s.withdrawalAmount > 0 ||
    (s.ggr ?? 0) > 0 ||
    (s.ngr ?? 0) > 0 ||
    (s.activePlayers ?? 0) > 0 ||
    (s.bonusCost ?? 0) > 0 ||
    (s.commissionTotal ?? 0) > 0 ||
    s.liveDemoAllocated > 0 ||
    s.liveDemoRemaining > 0 ||
    Boolean(s.liveDemoNotes.trim()) ||
    Boolean(s.notes.trim())
  );
}

export function deriveLiveDemoUsage(s: BrandMonthlyStats): {
  used: number;
  usedPct: number | null;
  low: boolean;
} {
  const allocated = s.liveDemoAllocated;
  const remaining = s.liveDemoRemaining;
  const used = Math.max(0, allocated - remaining);
  const usedPct = allocated > 0 ? Math.min(100, (used / allocated) * 100) : null;
  const low = allocated > 0 && remaining / allocated < 0.2;
  return { used, usedPct, low };
}

export type BrandMonthlyStatsDerived = {
  netDeposit: number;
  avgDepositPerMember: number | null;
  registrationToDepositPct: number | null;
  currency: BrandStatsCurrency;
};

export function deriveBrandMonthlyStats(s: BrandMonthlyStats): BrandMonthlyStatsDerived {
  const netDeposit = s.depositAmount - s.withdrawalAmount;
  const avgDepositPerMember =
    s.depositingMembers > 0 ? s.depositAmount / s.depositingMembers : null;
  const registrationToDepositPct =
    s.newRegistrations > 0
      ? Math.min(100, (s.depositingMembers / s.newRegistrations) * 100)
      : null;
  return {
    netDeposit,
    avgDepositPerMember,
    registrationToDepositPct,
    currency: s.currency,
  };
}

const currencySymbol: Record<BrandStatsCurrency, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
};

export function fmtBrandMoney(amount: number, currency: BrandStatsCurrency): string {
  const sym = currencySymbol[currency];
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sym}${(amount / 1_000).toFixed(1)}k`;
  return `${sym}${amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
}

export function fmtBrandCount(n: number): string {
  return n.toLocaleString("tr-TR");
}

/** PDF/CSV için düz metin satırları. */
export function brandStatsExportRows(
  s: BrandMonthlyStats,
  derived: BrandMonthlyStatsDerived
): Array<{ label: string; value: string }> {
  const cur = s.currency;
  return [
    { label: "Kayit olan uye", value: fmtBrandCount(s.newRegistrations) },
    { label: "Yatirim yapan uye", value: fmtBrandCount(s.depositingMembers) },
    { label: "Ilk yatirim (FTD)", value: fmtBrandCount(s.firstTimeDepositors) },
    { label: "Yatirim islem adedi", value: fmtBrandCount(s.depositCount) },
    { label: "Toplam yatirim", value: fmtBrandMoney(s.depositAmount, cur) },
    { label: "Toplam cekim", value: fmtBrandMoney(s.withdrawalAmount, cur) },
    { label: "Net yatirim", value: fmtBrandMoney(derived.netDeposit, cur) },
    ...(derived.avgDepositPerMember != null
      ? [{ label: "Ort. yatirim / uye", value: fmtBrandMoney(derived.avgDepositPerMember, cur) }]
      : []),
    ...(derived.registrationToDepositPct != null
      ? [
          {
            label: "Kayit -> yatirim orani",
            value: `${derived.registrationToDepositPct.toFixed(1)}%`,
          },
        ]
      : []),
    ...(s.liveDemoAllocated > 0 || s.liveDemoRemaining > 0
      ? [
          { label: "Canli demo tahsis", value: fmtBrandMoney(s.liveDemoAllocated, cur) },
          { label: "Canli demo kalan", value: fmtBrandMoney(s.liveDemoRemaining, cur) },
          {
            label: "Canli demo kullanim",
            value: fmtBrandMoney(Math.max(0, s.liveDemoAllocated - s.liveDemoRemaining), cur),
          },
        ]
      : []),
    ...(s.liveDemoNotes.trim() ? [{ label: "Canli demo notu", value: s.liveDemoNotes.trim() }] : []),
    ...(s.notes.trim() ? [{ label: "Genel not", value: s.notes.trim() }] : []),
  ];
}
