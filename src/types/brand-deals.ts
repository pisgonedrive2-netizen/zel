/**
 * Marka Anlaşmaları + İçerik Post Takibi (B2B Faz H) — UI yardımcıları.
 *
 * Kanonik tipler (`BrandDeal`, `BrandDealDeliverable`, `BrandPost`)
 * `@/store/store`'da tanımlıdır ve buradan re-export edilir.
 * Form/dropdown sabitleri ve sıkı tipli API body/response arayüzleri
 * bu dosyada tutulur.
 *
 * Backend tabloları: `public.brand_deals`, `public.brand_posts`.
 * Spec: docs/B2B_ROADMAP.md → Faz H
 */

export type {
  BrandDeal,
  BrandDealDeliverable,
  BrandPost,
} from "@/store/store";

import type { BrandDeal, BrandPost } from "@/store/store";

// ─── Anlaşma (brand_deals) ───────────────────────────────────────────────────

export type BrandDealStatus = BrandDeal["status"];
export type BrandDealType = BrandDeal["dealType"];

export const BRAND_DEAL_STATUS_LABELS: Record<BrandDealStatus, string> = {
  active: "Aktif",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  disputed: "İhtilaflı",
};

export const BRAND_DEAL_STATUS_BADGE_CLS: Record<BrandDealStatus, string> = {
  active:
    "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/45 dark:bg-emerald-950/40",
  completed:
    "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40",
  cancelled:
    "text-muted-foreground border-border bg-muted/40",
  disputed:
    "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
};

export const BRAND_DEAL_TYPE_LABELS: Record<BrandDealType, string> = {
  campaign: "Kampanya",
  single_post: "Tek post",
  long_term: "Uzun dönem",
  affiliate: "Affiliate",
};

/** `PATCH /api/brand-deals/[id]` gövdesi. */
export interface BrandDealUpdateBody {
  status?: BrandDealStatus;
  budgetUsd?: number;
  paidUsd?: number;
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string;
  contractUrl?: string | null;
}

// ─── Post (brand_posts) ──────────────────────────────────────────────────────

export type BrandPostPlatform = BrandPost["platform"];
export type BrandPostType = BrandPost["postType"];
export type BrandPostStatus = BrandPost["status"];

export const BRAND_POST_PLATFORM_LABELS: Record<BrandPostPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  kick: "Kick",
  twitter: "Twitter / X",
  telegram: "Telegram",
  other: "Diğer",
};

export const BRAND_POST_TYPE_LABELS: Record<BrandPostType, string> = {
  post: "Gönderi",
  reel: "Reel",
  story: "Hikâye",
  vlog: "Vlog",
  stream: "Yayın",
  vod: "VOD",
  tweet: "Tweet",
  other: "Diğer",
};

export const BRAND_POST_STATUS_LABELS: Record<BrandPostStatus, string> = {
  draft: "Taslak",
  live: "Yayında",
  removed: "Kaldırıldı",
  expired: "Süresi dolmuş",
};

export const BRAND_POST_STATUS_BADGE_CLS: Record<BrandPostStatus, string> = {
  draft:
    "text-muted-foreground border-border bg-muted/40",
  live:
    "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/45 dark:bg-emerald-950/40",
  removed:
    "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
  expired:
    "text-muted-foreground border-border bg-muted/40",
};

/** `POST /api/brand-posts` gövdesi. */
export interface CreateBrandPostBody {
  brandId: string;
  employeeId?: string;
  dealId?: string;
  url: string;
  platform: BrandPostPlatform;
  postType?: BrandPostType;
  caption?: string;
  postedAt?: string;
  screenshotUrl?: string;
  views?: number;
  likes?: number;
  comments?: number;
}

/** `PATCH /api/brand-posts/[id]` gövdesi. */
export interface UpdateBrandPostBody {
  status?: BrandPostStatus;
  caption?: string;
  postType?: BrandPostType;
  views?: number;
  likes?: number;
  comments?: number;
  screenshotUrl?: string | null;
}
