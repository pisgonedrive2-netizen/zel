export type ClipCurrency = "TRY" | "USD";
export type ClipCampaignStatus = "active" | "paused" | "ended";
export type ClipCreatorStatus = "pending" | "approved" | "blocked";
export type ClipSubmissionStatus = "pending" | "approved" | "rejected";
export type ClipPlatform = "instagram" | "tiktok" | "youtube";

export const CLIP_PLATFORMS: ClipPlatform[] = ["instagram", "tiktok", "youtube"];

export interface ClipCampaign {
  id: string;
  title: string;
  description: string;
  status: ClipCampaignStatus;
  currency: ClipCurrency;
  ratePer1kViews: number;
  ratePerLike: number;
  ratePerComment: number;
  ratePerShare: number;
  minViews: number;
  maxPerVideo: number | null;
  maxPerCreatorMonth: number | null;
  platforms: ClipPlatform[];
  rules: string;
  startsOn: string | null;
  endsOn: string | null;
  createdAt: string;
}

export interface ClipAccount {
  platform: ClipPlatform;
  handle: string;
}

export interface ClipCreator {
  id: string;
  name: string;
  contact: string;
  email: string;
  payoutMethod: string;
  payoutDetails: string;
  accounts: ClipAccount[];
  status: ClipCreatorStatus;
  notes: string;
  createdAt: string;
  contactNorm?: string;
  lastSubmitIp?: string;
  lastSubmitAt?: string | null;
  submitCount?: number;
}

export interface ClipMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface ClipSubmission {
  id: string;
  campaignId: string;
  creatorId: string;
  url: string;
  mediaKey: string;
  platform: ClipPlatform;
  accountHandle: string;
  status: ClipSubmissionStatus;
  source: "creator" | "admin";
  rejectReason: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  publishedAt: string | null;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
  reviewedAt: string | null;
  createdAt: string;
  submitIp?: string;
}

export interface ClipSnapshot extends ClipMetrics {
  submissionId: string;
  date: string;
}

export interface ClipPayout {
  id: string;
  creatorId: string;
  monthYm: string;
  currency: ClipCurrency;
  amount: number;
  note: string;
  paidAt: string;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
const str = (v: unknown): string => (v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

export function campaignFromRow(r: Row): ClipCampaign {
  return {
    id: str(r.id),
    title: str(r.title),
    description: str(r.description),
    status: (str(r.status) || "active") as ClipCampaignStatus,
    currency: (str(r.currency) || "TRY") as ClipCurrency,
    ratePer1kViews: num(r.rate_per_1k_views) ?? 0,
    ratePerLike: num(r.rate_per_like) ?? 0,
    ratePerComment: num(r.rate_per_comment) ?? 0,
    ratePerShare: num(r.rate_per_share) ?? 0,
    minViews: num(r.min_views) ?? 0,
    maxPerVideo: num(r.max_per_video),
    maxPerCreatorMonth: num(r.max_per_creator_month),
    platforms: (Array.isArray(r.platforms) ? r.platforms : CLIP_PLATFORMS) as ClipPlatform[],
    rules: str(r.rules),
    startsOn: strOrNull(r.starts_on),
    endsOn: strOrNull(r.ends_on),
    createdAt: str(r.created_at),
  };
}

export function campaignToRow(c: ClipCampaign): Row {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status,
    currency: c.currency,
    rate_per_1k_views: c.ratePer1kViews,
    rate_per_like: c.ratePerLike,
    rate_per_comment: c.ratePerComment,
    rate_per_share: c.ratePerShare,
    min_views: Math.max(0, Math.round(c.minViews)),
    max_per_video: c.maxPerVideo,
    max_per_creator_month: c.maxPerCreatorMonth,
    platforms: c.platforms,
    rules: c.rules,
    starts_on: c.startsOn || null,
    ends_on: c.endsOn || null,
    updated_at: new Date().toISOString(),
  };
}

export function creatorFromRow(r: Row): ClipCreator {
  return {
    id: str(r.id),
    name: str(r.name),
    contact: str(r.contact),
    email: str(r.email),
    payoutMethod: str(r.payout_method),
    payoutDetails: str(r.payout_details),
    accounts: (Array.isArray(r.accounts) ? r.accounts : []) as ClipAccount[],
    status: (str(r.status) || "pending") as ClipCreatorStatus,
    notes: str(r.notes),
    createdAt: str(r.created_at),
    contactNorm: str(r.contact_norm) || undefined,
    lastSubmitIp: str(r.last_submit_ip) || undefined,
    lastSubmitAt: strOrNull(r.last_submit_at),
    submitCount: num(r.submit_count) ?? 0,
  };
}

export function submissionFromRow(r: Row): ClipSubmission {
  return {
    id: str(r.id),
    campaignId: str(r.campaign_id),
    creatorId: str(r.creator_id),
    url: str(r.url),
    mediaKey: str(r.media_key),
    platform: str(r.platform) as ClipPlatform,
    accountHandle: str(r.account_handle),
    status: (str(r.status) || "pending") as ClipSubmissionStatus,
    source: str(r.source) === "admin" ? "admin" : "creator",
    rejectReason: str(r.reject_reason),
    views: num(r.views),
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    publishedAt: strOrNull(r.published_at),
    lastCheckedAt: strOrNull(r.last_checked_at),
    lastCheckError: strOrNull(r.last_check_error),
    reviewedAt: strOrNull(r.reviewed_at),
    createdAt: str(r.created_at),
    submitIp: str(r.submit_ip) || undefined,
  };
}

export function snapshotFromRow(r: Row): ClipSnapshot {
  return {
    submissionId: str(r.submission_id),
    date: str(r.date),
    views: num(r.views) ?? 0,
    likes: num(r.likes) ?? 0,
    comments: num(r.comments) ?? 0,
    shares: num(r.shares) ?? 0,
  };
}

export function payoutFromRow(r: Row): ClipPayout {
  return {
    id: str(r.id),
    creatorId: str(r.creator_id),
    monthYm: str(r.month_ym),
    currency: (str(r.currency) || "TRY") as ClipCurrency,
    amount: num(r.amount) ?? 0,
    note: str(r.note),
    paidAt: str(r.paid_at),
  };
}

export function fmtClipMoney(amount: number, currency: ClipCurrency): string {
  const v = Number.isFinite(amount) ? amount : 0;
  const s = v.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: v < 100 ? 2 : 0 });
  return currency === "USD" ? `$${s}` : `${s} ₺`;
}

export const PLATFORM_LABEL: Record<ClipPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};
