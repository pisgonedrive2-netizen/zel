/**
 * Marka kayıt başvurusu (B2B Faz A) — UI yardımcıları.
 *
 * Kanonik `BrandRegistrationRequest` tipi `@/store/store`'de tanımlıdır ve
 * buradan re-export edilir. Form/dropdown sabitleri ve sıkı tipli body/response
 * arayüzleri bu dosyada tutulur.
 *
 * Backend tablosu: `public.brand_registration_requests`
 * Spec: docs/B2B_ROADMAP.md → Faz A
 */

export type { BrandRegistrationRequest } from "@/store/store";

/** Başvurunun yaşam döngüsü. */
export type BrandRegistrationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "duplicate";

/** Marka kategorisi (form dropdown). */
export type BrandRegistrationCategory =
  | "Bahis"
  | "Casino"
  | "Forex"
  | "Diğer";

/** Aylık hacim aralığı (form dropdown). */
export type BrandRegistrationVolume = "<1M" | "1M-5M" | "5M-20M" | "20M+";

/** Form body — `POST /api/brand-registrations` */
export interface BrandRegistrationCreateBody {
  brandName: string;
  shortName?: string;
  category: BrandRegistrationCategory;
  website?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  telegram?: string;
  monthlyVolume?: BrandRegistrationVolume;
  preferredUsername?: string;
  notes?: string;
}

/** Onay/red API yanıtları. */
export interface BrandRegistrationApproveBody {
  usernameOverride?: string;
  customPin?: string;
}

export interface BrandRegistrationApproveResponse {
  ok: true;
  brand: { id: string; name: string; shortName: string };
  user: { id: string; username: string; name: string };
  plainPin: string;
}

export interface BrandRegistrationRejectBody {
  reason: string;
}

/** Sabit listeler — UI dropdown'ları. */
export const BRAND_REGISTRATION_CATEGORIES: ReadonlyArray<BrandRegistrationCategory> = [
  "Bahis",
  "Casino",
  "Forex",
  "Diğer",
];

export const BRAND_REGISTRATION_VOLUMES: ReadonlyArray<BrandRegistrationVolume> = [
  "<1M",
  "1M-5M",
  "5M-20M",
  "20M+",
];

export const BRAND_REGISTRATION_STATUS_LABELS: Record<BrandRegistrationStatus, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  duplicate: "Yinelenmiş",
};
