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
async function fetchInstagram(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.kind === "user") {
    const raw = await rapidGet("instagram", "/user_info_by_username", {
      username: detected.externalRef,
    });
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
  const raw = await rapidGet("instagram", "/media_info_by_shortcode", {
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
  const raw = await rapidGet("tiktok", "/video/info", { video_id: detected.externalRef });
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
