import { getRapidApiKey } from "@/lib/env";
import { SOCIAL_PLANS, type SocialPlatform } from "./config";
import type { DetectedPlatform } from "./platform-detect";

export interface FetchedMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  raw?: unknown;
}

class RapidApiError extends Error {
  constructor(
    public platform: SocialPlatform,
    public status: number,
    message: string
  ) {
    super(`[${platform}] ${status}: ${message}`);
    this.name = "RapidApiError";
  }
}

async function rapidGet(platform: SocialPlatform, path: string, search: Record<string, string>) {
  const plan = SOCIAL_PLANS[platform];
  const url = new URL(`https://${plan.apiHost}${path}`);
  for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-rapidapi-host": plan.apiHost,
      "x-rapidapi-key": getRapidApiKey(),
      accept: "application/json",
    },
    // Sandbox / Vercel Edge için kısa timeout — bekleyen istek bloklamasın.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RapidApiError(platform, res.status, text.slice(0, 240) || res.statusText);
  }
  return (await res.json()) as unknown;
}

/** Esnek sayı çıkarımı: API'ler ya `views: 123` ya `play_count: "12.3K"` ya da
 *  derin yuvalanmış alanlar dönebiliyor. */
function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "").toLowerCase();
    const mult = cleaned.endsWith("k") ? 1_000 : cleaned.endsWith("m") ? 1_000_000 : cleaned.endsWith("b") ? 1_000_000_000 : 1;
    const num = parseFloat(cleaned);
    if (Number.isFinite(num)) return Math.floor(num * mult);
  }
  return null;
}

/** Verilen obje içinde önceliği yüksek anahtarlardan ilk bulunan sayıyı döner. */
function pickFirstNumber(obj: unknown, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    const n = toNumber(v);
    if (n != null) return n;
    // Tek seviye nested (örn. statistics.viewCount)
    if (v && typeof v === "object") {
      for (const sub of Object.values(v as Record<string, unknown>)) {
        const sn = toNumber(sub);
        if (sn != null) return sn;
      }
    }
  }
  return null;
}

// ───────────────────────── YouTube ──────────────────────────────────────────
async function fetchYouTube(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.kind !== "video") {
    // Kanal istatistiği — youtube138 channel/details endpoint
    const raw = await rapidGet("youtube", "/channel/details/", { id: detected.externalRef });
    const stats = (raw as { stats?: unknown })?.stats ?? raw;
    return {
      views: pickFirstNumber(stats, ["viewCount", "views"]),
      likes: null,
      comments: null,
      shares: pickFirstNumber(stats, ["subscriberCount", "subscribers"]),
      raw,
    };
  }
  const raw = await rapidGet("youtube", "/video/details/", { id: detected.externalRef });
  const stats =
    (raw as { stats?: unknown })?.stats ??
    (raw as { statistics?: unknown })?.statistics ??
    raw;
  return {
    views: pickFirstNumber(stats, ["views", "viewCount", "viewCountText"]),
    likes: pickFirstNumber(stats, ["likes", "likeCount"]),
    comments: pickFirstNumber(stats, ["comments", "commentCount"]),
    shares: null,
    raw,
  };
}

// ───────────────────────── Instagram ────────────────────────────────────────
async function fetchInstagramProfile(username: string): Promise<unknown> {
  try {
    return await rapidGet("instagram", "/profile", { username });
  } catch {
    return rapidGet("instagram", "/user_info_by_username", { username });
  }
}

async function fetchInstagram(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.kind === "user") {
    const raw = await fetchInstagramProfile(detected.externalRef);
    const data =
      (raw as { data?: unknown })?.data ??
      (raw as { user?: unknown })?.user ??
      raw;
    return {
      views: null,
      likes: null,
      comments: null,
      shares: pickFirstNumber(data, [
        "follower_count",
        "edge_followed_by",
        "followers",
      ]),
      raw,
    };
  }
  const raw = await rapidGet("instagram", "/post", {
    shortcode: detected.externalRef,
  });
  const data =
    (raw as { data?: unknown })?.data ??
    (raw as { media?: unknown })?.media ??
    raw;
  return {
    views: pickFirstNumber(data, [
      "play_count",
      "video_view_count",
      "view_count",
      "videoViewCount",
    ]),
    likes: pickFirstNumber(data, ["like_count", "edge_liked_by", "likes"]),
    comments: pickFirstNumber(data, ["comment_count", "edge_media_to_comment"]),
    shares: pickFirstNumber(data, ["share_count", "shares"]),
    raw,
  };
}

// ───────────────────────── TikTok ───────────────────────────────────────────
async function fetchTikTok(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.kind === "user") {
    const raw = await rapidGet("tiktok", "/user/info", {
      unique_id: `@${detected.externalRef.replace(/^@/, "")}`,
    });
    const data = (raw as { data?: unknown })?.data ?? raw;
    return {
      views: null,
      likes: pickFirstNumber(data, ["heartCount", "diggCount", "totalHearts"]),
      comments: null,
      shares: pickFirstNumber(data, ["followerCount", "followers"]),
      raw,
    };
  }
  const videoUrl =
    detected.sourceUrl?.trim() ||
    (detected.externalRef.match(/^\d+$/)
      ? `https://www.tiktok.com/video/${detected.externalRef}`
      : "");
  if (!videoUrl) {
    throw new RapidApiError("tiktok", 0, "TikTok video URL gerekli");
  }
  const raw = await rapidGet("tiktok", "/", { url: videoUrl, hd: "1" });
  const data = (raw as { data?: unknown })?.data ?? raw;
  return {
    views: pickFirstNumber(data, ["play_count", "playCount", "views"]),
    likes: pickFirstNumber(data, ["digg_count", "diggCount", "likes"]),
    comments: pickFirstNumber(data, ["comment_count", "commentCount"]),
    shares: pickFirstNumber(data, ["share_count", "shareCount"]),
    raw,
  };
}

/** Tek giriş noktası — platforma göre uygun fetcher'a dispatch eder. */
export async function fetchMetricsForLink(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.platform === "youtube") return fetchYouTube(detected);
  if (detected.platform === "instagram") return fetchInstagram(detected);
  if (detected.platform === "tiktok") return fetchTikTok(detected);
  throw new RapidApiError(detected.platform, 0, "Bilinmeyen platform");
}

/* ============================================================================
 *  ZENGİN DETAY FETCHER
 * ----------------------------------------------------------------------------
 *  Manuel "detay göster" akışında çağrılır. Sadece sayıları değil, başlık,
 *  açıklama, yayın tarihi, kapak görseli, süre, etiketler gibi tüm alınabilir
 *  veriyi tek bir normalize edilmiş yapıya dönüştürür.
 * ==========================================================================*/

export interface RichLinkDetails {
  platform: SocialPlatform;
  kind: DetectedPlatform["kind"];
  externalRef: string;
  fetchedAt: string;
  // Metrikler
  metrics: FetchedMetrics;
  // İçerik metadata'sı (varsa)
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  durationSeconds?: number;
  author?: { name?: string; username?: string; avatarUrl?: string; verified?: boolean; followerCount?: number };
  hashtags?: string[];
  /** Platforma özgü ek metrikler (ör. subscribers, beğeni oranı vs.) */
  extras?: Record<string, number | string | null | undefined>;
  /** Ham API cevabı — debug için saklanır. */
  raw?: unknown;
}

function strOrUndef(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v;
  return undefined;
}

function pickFirstString(obj: unknown, keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
    if (v && typeof v === "object") {
      for (const sub of Object.values(v as Record<string, unknown>)) {
        if (typeof sub === "string" && sub.trim().length > 0) return sub;
      }
    }
  }
  return undefined;
}

function pickThumbnail(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  // YouTube
  if (Array.isArray(o.thumbnails)) {
    const best = (o.thumbnails as Array<{ url?: string }>).slice(-1)[0];
    if (best?.url) return best.url;
  }
  // Direkt alanlar
  for (const k of ["thumbnail_url", "thumbnailUrl", "thumbnail", "cover", "image_url", "imageUrl", "display_url", "image"]) {
    const v = o[k];
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  // TikTok: video.cover; Instagram: image_versions2.candidates[0].url
  if (o.video && typeof o.video === "object") {
    const v = (o.video as Record<string, unknown>).cover;
    if (typeof v === "string") return v;
  }
  if (o.image_versions2 && typeof o.image_versions2 === "object") {
    const cands = (o.image_versions2 as { candidates?: Array<{ url?: string }> }).candidates;
    if (cands && cands[0]?.url) return cands[0].url;
  }
  return undefined;
}

function extractHashtags(text?: string): string[] {
  if (!text) return [];
  const set = new Set<string>();
  for (const m of text.matchAll(/#([\p{L}\p{N}_]+)/gu)) set.add(m[1]);
  return Array.from(set).slice(0, 24);
}

async function richYouTube(detected: DetectedPlatform): Promise<RichLinkDetails> {
  if (detected.kind !== "video") {
    const raw = await rapidGet("youtube", "/channel/details/", { id: detected.externalRef });
    const r = raw as Record<string, unknown>;
    const stats = (r.stats ?? r) as Record<string, unknown>;
    return {
      platform: "youtube",
      kind: detected.kind,
      externalRef: detected.externalRef,
      fetchedAt: new Date().toISOString(),
      metrics: {
        views: pickFirstNumber(stats, ["viewCount", "views"]),
        likes: null,
        comments: null,
        shares: pickFirstNumber(stats, ["subscriberCount", "subscribers"]),
      },
      title: strOrUndef(r.title),
      description: strOrUndef(r.description),
      thumbnailUrl: pickThumbnail(r),
      author: {
        name: strOrUndef(r.title),
        username: strOrUndef(r.username),
        avatarUrl: pickThumbnail(r),
        followerCount: pickFirstNumber(stats, ["subscriberCount", "subscribers"]) ?? undefined,
      },
      extras: {
        videos: pickFirstNumber(stats, ["videoCount", "videos"]),
        joined: strOrUndef((r as { joined?: unknown }).joined) ?? null,
      },
      raw,
    };
  }
  const raw = await rapidGet("youtube", "/video/details/", { id: detected.externalRef });
  const r = raw as Record<string, unknown>;
  const stats = ((r.stats ?? r.statistics ?? r) as Record<string, unknown>);
  const desc = strOrUndef(r.description);
  return {
    platform: "youtube",
    kind: "video",
    externalRef: detected.externalRef,
    fetchedAt: new Date().toISOString(),
    metrics: {
      views: pickFirstNumber(stats, ["views", "viewCount", "viewCountText"]),
      likes: pickFirstNumber(stats, ["likes", "likeCount"]),
      comments: pickFirstNumber(stats, ["comments", "commentCount"]),
      shares: null,
    },
    title: strOrUndef(r.title),
    description: desc,
    thumbnailUrl: pickThumbnail(r),
    publishedAt: pickFirstString(r, ["publishedDate", "publishDate", "publishedAt", "uploadDate"]),
    durationSeconds: pickFirstNumber(r, ["lengthSeconds", "duration", "durationSeconds"]) ?? undefined,
    author: {
      name: pickFirstString(r, ["author", "channelTitle"]),
      username: pickFirstString(r, ["channelId", "channelHandle"]),
    },
    hashtags: extractHashtags(desc ?? strOrUndef(r.title)),
    extras: {
      category: pickFirstString(r, ["category", "categoryId"]) ?? null,
    },
    raw,
  };
}

async function richInstagram(detected: DetectedPlatform): Promise<RichLinkDetails> {
  if (detected.kind === "user") {
    const raw = await fetchInstagramProfile(detected.externalRef);
    const r = raw as Record<string, unknown>;
    const data = ((r.data ?? r.user ?? r) as Record<string, unknown>);
    return {
      platform: "instagram",
      kind: "user",
      externalRef: detected.externalRef,
      fetchedAt: new Date().toISOString(),
      metrics: {
        views: null,
        likes: null,
        comments: null,
        shares: pickFirstNumber(data, ["follower_count", "edge_followed_by", "followers"]),
      },
      title: pickFirstString(data, ["full_name", "username"]),
      description: pickFirstString(data, ["biography", "bio"]),
      thumbnailUrl: pickFirstString(data, ["profile_pic_url_hd", "profile_pic_url"]),
      author: {
        name: pickFirstString(data, ["full_name"]),
        username: pickFirstString(data, ["username"]),
        avatarUrl: pickFirstString(data, ["profile_pic_url_hd", "profile_pic_url"]),
        verified: data.is_verified === true,
        followerCount: pickFirstNumber(data, ["follower_count", "edge_followed_by"]) ?? undefined,
      },
      extras: {
        following: pickFirstNumber(data, ["following_count", "follows"]) ?? null,
        media: pickFirstNumber(data, ["media_count"]) ?? null,
      },
      raw,
    };
  }
  const raw = await rapidGet("instagram", "/post", { shortcode: detected.externalRef });
  const r = raw as Record<string, unknown>;
  const data = ((r.data ?? r.media ?? r.post ?? r) as Record<string, unknown>);
  const caption =
    pickFirstString(data, ["caption_text", "captionText"]) ??
    pickFirstString((data.caption as Record<string, unknown>) ?? {}, ["text"]);
  const owner = (data.owner ?? data.user ?? {}) as Record<string, unknown>;
  return {
    platform: "instagram",
    kind: detected.kind,
    externalRef: detected.externalRef,
    fetchedAt: new Date().toISOString(),
    metrics: {
      views: pickFirstNumber(data, ["play_count", "video_view_count", "view_count", "videoViewCount"]),
      likes: pickFirstNumber(data, ["like_count", "edge_liked_by", "likes"]),
      comments: pickFirstNumber(data, ["comment_count", "edge_media_to_comment"]),
      shares: pickFirstNumber(data, ["share_count", "shares"]),
    },
    title: caption?.slice(0, 80),
    description: caption,
    thumbnailUrl: pickThumbnail(data),
    publishedAt: pickFirstString(data, ["taken_at", "posted_at", "created_at", "timestamp"]),
    durationSeconds: pickFirstNumber(data, ["video_duration", "duration"]) ?? undefined,
    author: {
      name: pickFirstString(owner, ["full_name", "username"]),
      username: pickFirstString(owner, ["username"]),
      avatarUrl: pickFirstString(owner, ["profile_pic_url", "profile_pic_url_hd"]),
      verified: owner.is_verified === true,
      followerCount: pickFirstNumber(owner, ["follower_count", "edge_followed_by"]) ?? undefined,
    },
    hashtags: extractHashtags(caption),
    raw,
  };
}

async function richTikTok(detected: DetectedPlatform): Promise<RichLinkDetails> {
  if (detected.kind === "user") {
    const raw = await rapidGet("tiktok", "/user/info", {
      unique_id: `@${detected.externalRef.replace(/^@/, "")}`,
    });
    const r = raw as Record<string, unknown>;
    const data = ((r.data ?? r) as Record<string, unknown>);
    const user = ((data.user ?? data) as Record<string, unknown>);
    const stats = ((data.stats ?? data) as Record<string, unknown>);
    return {
      platform: "tiktok",
      kind: "user",
      externalRef: detected.externalRef,
      fetchedAt: new Date().toISOString(),
      metrics: {
        views: pickFirstNumber(stats, ["videoCount", "videos"]),
        likes: pickFirstNumber(stats, ["heartCount", "diggCount", "totalHearts"]),
        comments: null,
        shares: pickFirstNumber(stats, ["followerCount", "followers"]),
      },
      title: pickFirstString(user, ["nickname", "uniqueId"]),
      description: pickFirstString(user, ["signature", "bio"]),
      thumbnailUrl: pickFirstString(user, ["avatarLarger", "avatarMedium", "avatarThumb"]),
      author: {
        name: pickFirstString(user, ["nickname"]),
        username: pickFirstString(user, ["uniqueId"]),
        avatarUrl: pickFirstString(user, ["avatarLarger", "avatarMedium"]),
        verified: user.verified === true,
        followerCount: pickFirstNumber(stats, ["followerCount", "followers"]) ?? undefined,
      },
      extras: {
        following: pickFirstNumber(stats, ["followingCount"]) ?? null,
        videos: pickFirstNumber(stats, ["videoCount"]) ?? null,
        hearts: pickFirstNumber(stats, ["heartCount", "totalHearts"]) ?? null,
      },
      raw,
    };
  }
  const videoUrl =
    detected.sourceUrl?.trim() ||
    (detected.externalRef.match(/^\d+$/)
      ? `https://www.tiktok.com/video/${detected.externalRef}`
      : "");
  if (!videoUrl) {
    throw new RapidApiError("tiktok", 0, "TikTok video URL gerekli");
  }
  const raw = await rapidGet("tiktok", "/", { url: videoUrl, hd: "1" });
  const r = raw as Record<string, unknown>;
  const data = ((r.data ?? r) as Record<string, unknown>);
  const author = ((data.author ?? data.user ?? {}) as Record<string, unknown>);
  const desc = pickFirstString(data, ["title", "desc", "description"]);
  return {
    platform: "tiktok",
    kind: "video",
    externalRef: detected.externalRef,
    fetchedAt: new Date().toISOString(),
    metrics: {
      views: pickFirstNumber(data, ["play_count", "playCount", "views"]),
      likes: pickFirstNumber(data, ["digg_count", "diggCount", "likes"]),
      comments: pickFirstNumber(data, ["comment_count", "commentCount"]),
      shares: pickFirstNumber(data, ["share_count", "shareCount"]),
    },
    title: desc?.slice(0, 80),
    description: desc,
    thumbnailUrl: pickThumbnail(data) ?? pickFirstString(data, ["cover", "origin_cover"]),
    publishedAt: pickFirstString(data, ["create_time", "createTime", "create_time_formatted"]),
    durationSeconds: pickFirstNumber(data, ["duration", "video_duration"]) ?? undefined,
    author: {
      name: pickFirstString(author, ["nickname", "unique_id", "uniqueId"]),
      username: pickFirstString(author, ["unique_id", "uniqueId"]),
      avatarUrl: pickFirstString(author, ["avatar", "avatar_thumb", "avatarThumb"]),
      verified: author.verified === true,
      followerCount: pickFirstNumber(author, ["followerCount", "follower_count"]) ?? undefined,
    },
    hashtags: extractHashtags(desc),
    extras: {
      music: pickFirstString((data.music ?? {}) as Record<string, unknown>, ["title", "music_name"]) ?? null,
      region: pickFirstString(data, ["region"]) ?? null,
    },
    raw,
  };
}

/** Zengin metadata + metrik döner. 1 RapidAPI çağrısı yapar. */
export async function fetchRichDetailsForLink(detected: DetectedPlatform): Promise<RichLinkDetails> {
  if (detected.platform === "youtube") return richYouTube(detected);
  if (detected.platform === "instagram") return richInstagram(detected);
  if (detected.platform === "tiktok") return richTikTok(detected);
  throw new RapidApiError(detected.platform, 0, "Bilinmeyen platform");
}
