import { rapidApiGet } from "./clients";
import type { SocialPlatform } from "./config";
import type { DetectedPlatform } from "./platform-detect";
import type { RichLinkDetails } from "./clients";

export interface CommentPreview {
  author?: string;
  text: string;
  likes?: number;
}

export interface RelatedVideoPreview {
  title: string;
  views?: number | null;
  videoId?: string;
}

export interface RecentPostPreview {
  title?: string;
  url?: string;
  views?: number | null;
  publishedAt?: string;
}

export interface MusicInfo {
  title?: string;
  author?: string;
  videoCount?: number | null;
}

export interface ChallengeInfo {
  name?: string;
  viewCount?: number | null;
  userCount?: number | null;
}

export interface PremiumEnrichment {
  engagementRate?: number | null;
  verifiedCommentCount?: number | null;
  recentComments?: CommentPreview[];
  relatedVideos?: RelatedVideoPreview[];
  recentPosts?: RecentPostPreview[];
  musicInfo?: MusicInfo;
  challengeInfo?: ChallengeInfo;
  /** Ek kota tüketilen istek sayısı */
  extraApiCalls: number;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "").toLowerCase();
    const mult = cleaned.endsWith("k") ? 1_000 : cleaned.endsWith("m") ? 1_000_000 : 1;
    const num = parseFloat(cleaned);
    if (Number.isFinite(num)) return Math.floor(num * mult);
  }
  return null;
}

function pickFirstString(obj: unknown, keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function calcEngagementRate(
  views: number | null | undefined,
  likes: number | null | undefined,
  comments: number | null | undefined,
  shares: number | null | undefined
): number | null {
  if (views == null || views <= 0) return null;
  const interactions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0);
  if (interactions <= 0) return null;
  return Math.round((interactions / views) * 10_000) / 100;
}

function parseYoutubeComments(raw: unknown): { total?: number; items: CommentPreview[] } {
  const o = raw as Record<string, unknown>;
  const total = toNumber(o.totalCommentsCount);
  const contents =
    (o.contents as unknown[]) ??
    ((o.data as { comments?: unknown[] } | undefined)?.comments) ??
    [];
  const items: CommentPreview[] = [];
  for (const c of contents) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;
    const text = pickFirstString(row, ["text", "content", "commentText"]);
    if (!text) continue;
    const author =
      pickFirstString(row, ["author", "authorName"]) ??
      pickFirstString((row.author as Record<string, unknown>) ?? {}, ["name", "title"]);
    items.push({
      author,
      text: text.slice(0, 280),
      likes: toNumber(row.likeCount ?? row.likes) ?? undefined,
    });
    if (items.length >= 5) break;
  }
  return { total: total ?? undefined, items };
}

function parseYoutubeRelated(raw: unknown): RelatedVideoPreview[] {
  const contents = (raw as { contents?: unknown[] })?.contents ?? [];
  const out: RelatedVideoPreview[] = [];
  for (const item of contents) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = pickFirstString(o, ["title", "videoTitle"]);
    if (!title) continue;
    out.push({
      title: title.slice(0, 100),
      views: toNumber(o.viewCount ?? o.views),
      videoId: pickFirstString(o, ["videoId", "id"]),
    });
    if (out.length >= 6) break;
  }
  return out;
}

function parseInstagramComments(raw: unknown): { total?: number; items: CommentPreview[] } {
  const root = raw as Record<string, unknown>;
  const list =
    (Array.isArray(root.comments) && root.comments) ||
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray((root.data as { comments?: unknown[] } | undefined)?.comments) &&
      (root.data as { comments: unknown[] }).comments) ||
    [];
  const items: CommentPreview[] = [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;
    const text =
      pickFirstString(row, ["text", "comment"]) ??
      pickFirstString((row.text as Record<string, unknown>) ?? {}, ["text"]);
    if (!text) continue;
    const author =
      pickFirstString(row, ["username"]) ??
      pickFirstString((row.user as Record<string, unknown>) ?? {}, ["username", "full_name"]);
    items.push({ author, text: text.slice(0, 280), likes: toNumber(row.like_count) ?? undefined });
    if (items.length >= 5) break;
  }
  return { total: toNumber(root.comment_count) ?? undefined, items };
}

function parseTikTokComments(raw: unknown): { total?: number; items: CommentPreview[] } {
  const data = (raw as { data?: Record<string, unknown> })?.data ?? raw;
  const list = (data as { comments?: unknown[] })?.comments ?? [];
  const total = toNumber((data as { total?: unknown }).total ?? (data as { comment_count?: unknown }).comment_count);
  const items: CommentPreview[] = [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;
    const text = pickFirstString(row, ["text", "comment"]);
    if (!text) continue;
    const author =
      pickFirstString((row.user as Record<string, unknown>) ?? {}, ["nickname", "unique_id"]) ??
      pickFirstString(row, ["nickname"]);
    items.push({
      author,
      text: text.slice(0, 280),
      likes: toNumber(row.digg_count ?? row.likes) ?? undefined,
    });
    if (items.length >= 5) break;
  }
  return { total: total ?? undefined, items };
}

function parseChannelVideos(raw: unknown): RecentPostPreview[] {
  const contents = (raw as { contents?: unknown[] })?.contents ?? [];
  const out: RecentPostPreview[] = [];
  for (const item of contents) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const videoId = pickFirstString(o, ["videoId", "id"]);
    const title = pickFirstString(o, ["title", "videoTitle"]);
    if (!title && !videoId) continue;
    out.push({
      title: (title ?? videoId ?? "Video").slice(0, 100),
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
      views: toNumber(o.viewCount ?? o.views),
    });
    if (out.length >= 6) break;
  }
  return out;
}

function pickIgMediaId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const data = (o.data ?? o.media ?? o.post ?? o) as Record<string, unknown>;
  return pickFirstString(data, ["pk", "id", "media_id", "pk_id"]);
}

function pickIgUserId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const data = (o.data ?? o.user ?? o) as Record<string, unknown>;
  return pickFirstString(data, ["pk", "id", "pk_id", "user_id"]);
}

function parseIgFeed(raw: unknown): RecentPostPreview[] {
  const root = raw as Record<string, unknown>;
  const list =
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.data) && root.data) ||
    [];
  const out: RecentPostPreview[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const code = pickFirstString(o, ["code", "shortcode"]);
    const caption =
      pickFirstString(o, ["caption_text", "caption"]) ??
      pickFirstString((o.caption as Record<string, unknown>) ?? {}, ["text"]);
    out.push({
      title: caption?.slice(0, 80),
      url: code ? `https://www.instagram.com/p/${code}/` : undefined,
      views: toNumber(o.play_count ?? o.view_count ?? o.like_count),
    });
    if (out.length >= 6) break;
  }
  return out;
}

function pickMusicUrlFromTikTokRaw(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const music = (o.music ?? (o.data as Record<string, unknown> | undefined)?.music) as
    | Record<string, unknown>
    | undefined;
  if (!music) return undefined;
  const id = pickFirstString(music, ["id", "mid", "music_id"]);
  const title = pickFirstString(music, ["title", "music_name"]);
  if (id) return `https://www.tiktok.com/music/${title ?? "sound"}-${id}`;
  return undefined;
}

function pickChallengeFromTikTokRaw(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const challenges =
    (o.challenges as unknown[]) ??
    ((o.data as { challenges?: unknown[] } | undefined)?.challenges) ??
    [];
  for (const c of challenges) {
    if (!c || typeof c !== "object") continue;
    const name = pickFirstString(c as Record<string, unknown>, ["title", "cha_name", "challenge_name"]);
    if (name) return name.replace(/^#/, "");
  }
  const desc = pickFirstString(o, ["desc", "title", "description"]);
  if (desc) {
    const tag = desc.match(/#([\p{L}\p{N}_]+)/u);
    if (tag) return tag[1];
  }
  return undefined;
}

async function enrichYouTube(
  detected: DetectedPlatform,
  details: RichLinkDetails,
  enrichment: PremiumEnrichment
): Promise<void> {
  if (detected.kind === "video") {
    try {
      const raw = await rapidApiGet("youtube", "/video/comments/", { id: detected.externalRef });
      enrichment.extraApiCalls += 1;
      const parsed = parseYoutubeComments(raw);
      enrichment.verifiedCommentCount = parsed.total ?? details.metrics.comments;
      enrichment.recentComments = parsed.items;
    } catch {
      /* opsiyonel */
    }
    try {
      const raw = await rapidApiGet("youtube", "/video/related-contents/", { id: detected.externalRef });
      enrichment.extraApiCalls += 1;
      enrichment.relatedVideos = parseYoutubeRelated(raw);
    } catch {
      /* opsiyonel */
    }
    return;
  }
  try {
    const raw = await rapidApiGet("youtube", "/channel/videos/", {
      id: detected.externalRef,
      filter: "videos_latest",
    });
    enrichment.extraApiCalls += 1;
    enrichment.recentPosts = parseChannelVideos(raw);
  } catch {
    /* opsiyonel */
  }
}

async function enrichInstagram(
  detected: DetectedPlatform,
  details: RichLinkDetails,
  enrichment: PremiumEnrichment
): Promise<void> {
  if (detected.kind === "video" && details.raw) {
    const mediaId = pickIgMediaId(details.raw);
    if (mediaId) {
      try {
        const raw = await rapidApiGet("instagram", "/comments", { id: mediaId });
        enrichment.extraApiCalls += 1;
        const parsed = parseInstagramComments(raw);
        enrichment.verifiedCommentCount = parsed.total ?? details.metrics.comments;
        enrichment.recentComments = parsed.items;
      } catch {
        /* opsiyonel */
      }
    }
    return;
  }
  if (detected.kind === "user" && details.raw) {
    const userId = pickIgUserId(details.raw);
    if (!userId) return;
    try {
      const raw = await rapidApiGet("instagram", "/feed", { user_id: userId });
      enrichment.extraApiCalls += 1;
      enrichment.recentPosts = parseIgFeed(raw);
    } catch {
      /* opsiyonel */
    }
  }
}

async function enrichTikTok(
  detected: DetectedPlatform,
  details: RichLinkDetails,
  enrichment: PremiumEnrichment
): Promise<void> {
  if (detected.kind === "video") {
    const videoUrl =
      detected.sourceUrl?.trim() ||
      (detected.externalRef.match(/^\d+$/)
        ? `https://www.tiktok.com/video/${detected.externalRef}`
        : "");
    if (videoUrl) {
      try {
        const raw = await rapidApiGet("tiktok", "/comment/list", { url: videoUrl, count: "5" });
        enrichment.extraApiCalls += 1;
        const parsed = parseTikTokComments(raw);
        enrichment.verifiedCommentCount = parsed.total ?? details.metrics.comments;
        enrichment.recentComments = parsed.items;
      } catch {
        /* opsiyonel */
      }
    }
    const musicUrl = pickMusicUrlFromTikTokRaw(details.raw);
    if (musicUrl) {
      try {
        const raw = await rapidApiGet("tiktok", "/music/info", { url: musicUrl });
        enrichment.extraApiCalls += 1;
        const data = (raw as { data?: Record<string, unknown> })?.data ?? raw;
        enrichment.musicInfo = {
          title: pickFirstString(data as Record<string, unknown>, ["title", "music_name"]),
          author: pickFirstString(data as Record<string, unknown>, ["author", "authorName"]),
          videoCount: toNumber((data as Record<string, unknown>).user_count),
        };
      } catch {
        /* opsiyonel */
      }
    }
    const challengeName = pickChallengeFromTikTokRaw(details.raw);
    if (challengeName) {
      try {
        const raw = await rapidApiGet("tiktok", "/challenge/info", { challenge_name: challengeName });
        enrichment.extraApiCalls += 1;
        const data = (raw as { data?: Record<string, unknown> })?.data ?? raw;
        enrichment.challengeInfo = {
          name: pickFirstString(data as Record<string, unknown>, ["cha_name", "challenge_name", "title"]),
          viewCount: toNumber((data as Record<string, unknown>).view_count),
          userCount: toNumber((data as Record<string, unknown>).user_count),
        };
      } catch {
        /* opsiyonel */
      }
    }
    return;
  }
  try {
    const raw = await rapidApiGet("tiktok", "/user/posts", {
      unique_id: `@${detected.externalRef.replace(/^@/, "")}`,
      count: "6",
    });
    enrichment.extraApiCalls += 1;
    const list =
      (raw as { data?: { videos?: unknown[] } })?.data?.videos ??
      (raw as { videos?: unknown[] })?.videos ??
      [];
    const posts: RecentPostPreview[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      posts.push({
        title: pickFirstString(o, ["title", "desc"])?.slice(0, 80),
        views: toNumber(o.play_count ?? o.playCount),
      });
      if (posts.length >= 6) break;
    }
    enrichment.recentPosts = posts;
  } catch {
    /* opsiyonel */
  }
}

/**
 * Link detay modalı için premium API verilerini ekler (yorumlar, ilgili içerik,
 * son gönderiler, müzik/challenge bilgisi). Her alt istek ayrı kota tüketir.
 */
export async function enrichRichLinkDetails(
  detected: DetectedPlatform,
  details: RichLinkDetails
): Promise<PremiumEnrichment> {
  const enrichment: PremiumEnrichment = { extraApiCalls: 0 };
  const m = details.metrics;
  enrichment.engagementRate = calcEngagementRate(m.views, m.likes, m.comments, m.shares);

  if (detected.platform === "youtube") await enrichYouTube(detected, details, enrichment);
  else if (detected.platform === "instagram") await enrichInstagram(detected, details, enrichment);
  else if (detected.platform === "tiktok") await enrichTikTok(detected, details, enrichment);

  return enrichment;
}

/** Instagram paylaşım linkini gerçek gönderi URL'sine çözer (pro /resolve_share). */
export async function resolveInstagramShareUrl(url: string): Promise<string> {
  if (!/\/share\//i.test(url)) return url;
  try {
    const raw = await rapidApiGet("instagram", "/resolve_share", { url });
    const resolved =
      pickFirstString(raw, ["url", "resolved_url", "link"]) ??
      pickFirstString((raw as { data?: Record<string, unknown> }).data ?? {}, ["url", "resolved_url"]);
    return resolved && resolved.includes("instagram.com") ? resolved : url;
  } catch {
    return url;
  }
}

export type { SocialPlatform };
