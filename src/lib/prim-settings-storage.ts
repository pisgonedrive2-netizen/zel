import {
  DEFAULT_BRAND_FEE_USD,
  DEFAULT_GUARANTEED_VIEWS,
  FAIR_PRIM_CONFIG,
  type PrimPoolConfig,
  type PrimRecipientMeta,
  type PrimCustomRecipient,
} from "@/lib/prim-pool";
import { previousMonthYm } from "@/lib/brand-igaming-metrics";

export const PRIM_STORAGE_KEY = "prim-pool-settings-v2";
const LEGACY_STORAGE_KEY = "prim-pool-settings-v1";

export type PrimBrandMeta = {
  excluded?: boolean;
  autoRepeatFee?: boolean;
  autoRepeatGuarantee?: boolean;
  notes?: string;
};

export type PrimCustomBrand = {
  id: string;
  name: string;
  shortName: string;
};

export type PrimMonthSlice = {
  brandFees: Record<string, number>;
  brandGuarantees: Record<string, number>;
  recipientWeights: Record<string, number>;
  /** Kişi başı performans puanı (ay bazlı). */
  recipientPoints: Record<string, number>;
  config: PrimPoolConfig;
};

export type PrimStoredSettings = {
  version: 2;
  defaults: PrimMonthSlice;
  monthly: Record<string, Partial<PrimMonthSlice>>;
  brandMeta: Record<string, PrimBrandMeta>;
  customBrands: PrimCustomBrand[];
  /** Kişi başı takma ad / isim override (aylar arası kalıcı). */
  recipientMeta: Record<string, PrimRecipientMeta>;
  /** Bordro dışı, elle eklenen kişiler (aylar arası kalıcı). */
  customRecipients: PrimCustomRecipient[];
  autoRepeatToNextMonth: boolean;
};

export type PrimPanelState = PrimMonthSlice & {
  brandMeta: Record<string, PrimBrandMeta>;
  customBrands: PrimCustomBrand[];
  recipientMeta: Record<string, PrimRecipientMeta>;
  customRecipients: PrimCustomRecipient[];
  autoRepeatToNextMonth: boolean;
};

function emptySlice(): PrimMonthSlice {
  return {
    brandFees: {},
    brandGuarantees: {},
    recipientWeights: {},
    recipientPoints: {},
    config: { ...FAIR_PRIM_CONFIG },
  };
}

export function defaultPrimStoredSettings(): PrimStoredSettings {
  return {
    version: 2,
    defaults: emptySlice(),
    monthly: {},
    brandMeta: {},
    customBrands: [],
    recipientMeta: {},
    customRecipients: [],
    autoRepeatToNextMonth: true,
  };
}

function migrateLegacy(raw: unknown): PrimStoredSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const base = defaultPrimStoredSettings();
  base.defaults = {
    brandFees: (o.brandFees as Record<string, number>) ?? {},
    brandGuarantees: (o.brandGuarantees as Record<string, number>) ?? {},
    recipientWeights: (o.recipientWeights as Record<string, number>) ?? {},
    recipientPoints: (o.recipientPoints as Record<string, number>) ?? {},
    config: { ...FAIR_PRIM_CONFIG, ...((o.config as PrimPoolConfig) ?? {}) },
  };
  return base;
}

export function loadPrimStoredSettings(): PrimStoredSettings {
  if (typeof window === "undefined") return defaultPrimStoredSettings();
  try {
    const rawV2 = window.localStorage.getItem(PRIM_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<PrimStoredSettings>;
      if (parsed.version === 2) {
        return {
          ...defaultPrimStoredSettings(),
          ...parsed,
          defaults: {
            ...emptySlice(),
            ...parsed.defaults,
            config: { ...FAIR_PRIM_CONFIG, ...(parsed.defaults?.config ?? {}) },
          },
          monthly: parsed.monthly ?? {},
          brandMeta: parsed.brandMeta ?? {},
          customBrands: parsed.customBrands ?? [],
          recipientMeta: parsed.recipientMeta ?? {},
          customRecipients: parsed.customRecipients ?? [],
        };
      }
    }
    const rawV1 = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawV1) {
      const migrated = migrateLegacy(JSON.parse(rawV1));
      if (migrated) {
        savePrimStoredSettings(migrated);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }
  } catch {
    // bozuk kayıt
  }
  return defaultPrimStoredSettings();
}

export function savePrimStoredSettings(settings: PrimStoredSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRIM_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // kota dolu vb.
  }
}

export function resolveMonthSlice(
  settings: PrimStoredSettings,
  month: string,
): PrimMonthSlice {
  const explicit = settings.monthly[month];
  if (explicit) {
    return {
      brandFees: { ...settings.defaults.brandFees, ...explicit.brandFees },
      brandGuarantees: { ...settings.defaults.brandGuarantees, ...explicit.brandGuarantees },
      recipientWeights: { ...settings.defaults.recipientWeights, ...explicit.recipientWeights },
      recipientPoints: { ...settings.defaults.recipientPoints, ...explicit.recipientPoints },
      config: { ...settings.defaults.config, ...(explicit.config ?? {}) },
    };
  }

  if (settings.autoRepeatToNextMonth) {
    const prev = settings.monthly[previousMonthYm(month)];
    if (prev) {
      return {
        brandFees: { ...settings.defaults.brandFees, ...prev.brandFees },
        brandGuarantees: { ...settings.defaults.brandGuarantees, ...prev.brandGuarantees },
        recipientWeights: { ...settings.defaults.recipientWeights, ...prev.recipientWeights },
        recipientPoints: { ...settings.defaults.recipientPoints, ...prev.recipientPoints },
        config: { ...settings.defaults.config, ...(prev.config ?? {}) },
      };
    }
  }

  return {
    brandFees: { ...settings.defaults.brandFees },
    brandGuarantees: { ...settings.defaults.brandGuarantees },
    recipientWeights: { ...settings.defaults.recipientWeights },
    recipientPoints: { ...settings.defaults.recipientPoints },
    config: { ...settings.defaults.config },
  };
}

export function patchMonthSlice(
  settings: PrimStoredSettings,
  month: string,
  patch: Partial<PrimMonthSlice>,
): PrimStoredSettings {
  const current = resolveMonthSlice(settings, month);
  const nextSlice: PrimMonthSlice = {
    brandFees: patch.brandFees ?? current.brandFees,
    brandGuarantees: patch.brandGuarantees ?? current.brandGuarantees,
    recipientWeights: patch.recipientWeights ?? current.recipientWeights,
    recipientPoints: patch.recipientPoints ?? current.recipientPoints,
    config: patch.config ?? current.config,
  };
  return {
    ...settings,
    monthly: {
      ...settings.monthly,
      [month]: nextSlice,
    },
    defaults: {
      ...settings.defaults,
      config: nextSlice.config,
    },
  };
}

export function brandFeeFor(
  brandId: string,
  slice: PrimMonthSlice,
  meta?: PrimBrandMeta,
): number {
  return slice.brandFees[brandId] ?? DEFAULT_BRAND_FEE_USD;
}

export function brandGuaranteeFor(
  brandId: string,
  slice: PrimMonthSlice,
): number {
  return slice.brandGuarantees[brandId] ?? DEFAULT_GUARANTEED_VIEWS;
}
