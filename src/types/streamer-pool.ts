/**
 * Yayıncı Havuzu + Teklif (B2B Faz G) — UI yardımcıları.
 *
 * Kanonik tipler (`StreamerPoolProfile`, `BrandOffer`, `BrandOfferDeliverable`,
 * `BrandOfferMessage`) `@/store/store`'da tanımlıdır ve buradan re-export edilir.
 * Form/dropdown sabitleri ve sıkı tipli API body/response arayüzleri bu dosyada
 * tutulur.
 *
 * Backend tabloları: `public.streamer_pool_profiles`, `public.brand_offers`,
 * `public.brand_offer_messages`.
 * Spec: docs/B2B_ROADMAP.md → Faz G
 */

export type {
  StreamerPoolProfile,
  BrandOffer,
  BrandOfferDeliverable,
  BrandOfferMessage,
} from "@/store/store";

// ─── Havuz profili (yayıncı) ─────────────────────────────────────────────────

export type StreamerPoolStatus = "draft" | "published" | "paused" | "closed";
export type StreamerPoolVisibility = "public" | "brand_only" | "invite_only";

export const STREAMER_POOL_STATUS_LABELS: Record<StreamerPoolStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  paused: "Duraklatıldı",
  closed: "Kapalı",
};

export const STREAMER_POOL_VISIBILITY_LABELS: Record<StreamerPoolVisibility, string> = {
  public: "Herkese açık",
  brand_only: "Sadece markalar",
  invite_only: "Yalnız davetli",
};

/** Yayıncının `PUT /api/streamer-pool/me` gövdesi. */
export interface StreamerPoolProfileUpsertBody {
  displayName: string;
  headline?: string;
  bio?: string;
  categories?: string[];
  languages?: string[];
  countries?: string[];
  rateMinUsd?: number | null;
  rateMaxUsd?: number | null;
  rateCurrency?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  status?: StreamerPoolStatus;
  visibility?: StreamerPoolVisibility;
}

/** Havuz filtreleri — `GET /api/streamer-pool?…` query parametreleri. */
export interface StreamerPoolFilters {
  search?: string;
  category?: string;
  language?: string;
  country?: string;
  minRate?: number;
  maxRate?: number;
  minFollowers?: number;
  maxFollowers?: number;
  status?: StreamerPoolStatus;
}

// ─── Teklif (brand_offers) ───────────────────────────────────────────────────

export type BrandOfferType = "campaign" | "single_post" | "long_term" | "affiliate";
export type BrandOfferStatus =
  | "pending"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";
export type BrandOfferInitiator = "brand" | "streamer";

export const BRAND_OFFER_TYPE_LABELS: Record<BrandOfferType, string> = {
  campaign: "Kampanya",
  single_post: "Tek post",
  long_term: "Uzun dönem",
  affiliate: "Affiliate",
};

export const BRAND_OFFER_STATUS_LABELS: Record<BrandOfferStatus, string> = {
  pending: "Bekliyor",
  negotiating: "Görüşülüyor",
  accepted: "Kabul edildi",
  rejected: "Reddedildi",
  withdrawn: "Geri çekildi",
  expired: "Süresi doldu",
};

export const BRAND_OFFER_STATUS_BADGE_CLS: Record<BrandOfferStatus, string> = {
  pending:
    "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
  negotiating:
    "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40",
  accepted:
    "text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40",
  rejected:
    "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
  withdrawn:
    "text-muted-foreground border-border bg-muted/40",
  expired:
    "text-muted-foreground border-border bg-muted/40",
};

export type OfferDeliverableType =
  | "post"
  | "reel"
  | "story"
  | "vlog"
  | "stream"
  | "vod"
  | "tweet"
  | "other";

export const OFFER_DELIVERABLE_LABELS: Record<OfferDeliverableType, string> = {
  post: "Gönderi",
  reel: "Reel",
  story: "Hikâye",
  vlog: "Vlog",
  stream: "Yayın",
  vod: "VOD",
  tweet: "Tweet",
  other: "Diğer",
};

export type OfferPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "kick"
  | "twitter"
  | "telegram"
  | "other";

export const OFFER_PLATFORM_LABELS: Record<OfferPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  kick: "Kick",
  twitter: "Twitter / X",
  telegram: "Telegram",
  other: "Diğer",
};

/** `POST /api/brand-offers` body. */
export interface CreateBrandOfferBody {
  brandId: string;
  employeeId: string;
  initiator: BrandOfferInitiator;
  title: string;
  description?: string;
  offerType: BrandOfferType;
  budgetUsd?: number;
  deliverables: Array<{
    type: OfferDeliverableType | string;
    count: number;
    platform?: OfferPlatform | string;
    notes?: string;
  }>;
  startDate?: string;
  endDate?: string;
  notes?: string;
  expiresAt?: string;
}

/** `POST /api/brand-offers/[id]/respond` body. */
export interface BrandOfferRespondBody {
  action: "accept" | "reject" | "counter";
  counterBudgetUsd?: number;
  message?: string;
}

/** `POST /api/brand-offers/[id]/messages` body. */
export interface BrandOfferMessageBody {
  body: string;
  counterBudgetUsd?: number;
}

/** Detay endpoint yanıt zarfı. */
export interface BrandOfferDetailResponse {
  offer: import("@/store/store").BrandOffer;
  messages: import("@/store/store").BrandOfferMessage[];
}
