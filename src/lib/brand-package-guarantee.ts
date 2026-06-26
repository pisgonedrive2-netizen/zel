/** Foxstream içerik paketleri — MARKA-PAKETLERI-2026-07 ile uyumlu. */
export type BrandContentPackageId = "starter" | "standard" | "premium" | "elite" | "multi";

export type BrandContentPackage = {
  id: BrandContentPackageId;
  name: string;
  /** Garantili aylık izlenme hedefi */
  guaranteedViews: number;
  priceUsd: number;
  cpmHint: string;
};

export const BRAND_CONTENT_PACKAGES: BrandContentPackage[] = [
  { id: "starter", name: "Starter", guaranteedViews: 500_000, priceUsd: 5_500, cpmHint: "≈ $11,0" },
  { id: "standard", name: "Standard", guaranteedViews: 1_000_000, priceUsd: 10_000, cpmHint: "≈ $10,0" },
  { id: "premium", name: "Premium", guaranteedViews: 1_700_000, priceUsd: 16_500, cpmHint: "≈ $9,7" },
  { id: "elite", name: "Elite", guaranteedViews: 2_700_000, priceUsd: 25_000, cpmHint: "≈ $9,3" },
  { id: "multi", name: "Multi-marka", guaranteedViews: 5_000_000, priceUsd: 0, cpmHint: "≈ $8,0" },
];

export function packageById(id: BrandContentPackageId): BrandContentPackage {
  return BRAND_CONTENT_PACKAGES.find((p) => p.id === id) ?? BRAND_CONTENT_PACKAGES[1];
}

export function packageGuaranteeStatus(actualViews: number, guaranteed: number) {
  if (guaranteed <= 0) return { pct: 0, met: false, shortfall: 0, bonus: 0 };
  const pct = Math.round((actualViews / guaranteed) * 100);
  const met = actualViews >= guaranteed;
  const shortfall = met ? 0 : guaranteed - actualViews;
  const bonus = met ? actualViews - guaranteed : 0;
  return { pct, met, shortfall, bonus };
}
