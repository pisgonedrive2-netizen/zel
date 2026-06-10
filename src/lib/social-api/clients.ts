import { getRapidApiKey } from "@/lib/env";
import { SOCIAL_PLANS, type SocialPlatform } from "./config";
import type { DetectedPlatform } from "./platform-detect";
import { pickPublishedAtIso } from "./published-at";
import {
  enrichRichLinkDetails,
  resolveInstagramShareUrl,
  type PremiumEnrichment,
} from "./premium-enrichment";

export type { PremiumEnrichment } from "./premium-enrichment";

export interface FetchedMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  /** İçerik yayın tarihi (ISO) — achievement takvimi için. */
  publishedAt?: string;
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Aynı RapidAPI host'una yapılan ardışık isteklerin saniye-başına hız limitini
 * (429 "rate limit per second") tetiklememesi için minimum boşluk (ms).
 * Cron batch'i linkleri sırayla işlerken bu boşluk burst'leri yumuşatır.
 * Env ile ayarlanabilir: RAPIDAPI_MIN_REQUEST_GAP_MS (varsayılan 300ms ≈ ≤3 req/sn).
 */
function minRequestGapMs(): number {
  const raw = process.env.RAPIDAPI_MIN_REQUEST_GAP_MS?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 300;
}

/** 429 / 503 sonrası yeniden deneme sayısı. Env: RAPIDAPI_MAX_RETRIES (varsayılan 3). */
function maxRetries(): number {
  const raw = process.env.RAPIDAPI_MAX_RETRIES?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

/** Host bazlı son istek zamanı — instance içi pacing (cron sıralı çalışır). */
const lastRequestAtByHost: Record<string, number> = {};

async function paceHost(host: string): Promise<void> {
  const gap = minRequestGapMs();
  if (gap <= 0) return;
  const last = lastRequestAtByHost[host] ?? 0;
  const wait = last + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAtByHost[host] = Date.now();
}

/** Retry-After başlığı (saniye veya HTTP-date) → ms. */
function retryAfterMs(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 10_000);
  const date = Date.parse(h);
  if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), 10_000));
  return null;
}

/**
 * RapidAPI GET — feature probe ve diğer modüller için dışa açık.
 *
 * Saniye-başına hız limitini (429) absorbe etmek için: istekler host bazında
 * paced edilir ve 429/503 yanıtında üstel backoff ile yeniden denenir. Böylece
 * cron batch'i sırasında oluşan GEÇİCİ throttle hataları kalıcı "link hatası"na
 * dönüşmez.
 */
export async function rapidApiGet(platform: SocialPlatform, path: string, search: Record<string, string>) {
  const plan = SOCIAL_PLANS[platform];
  const url = new URL(`https://${plan.apiHost}${path}`);
  for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);

  const retries = maxRetries();
  let lastStatus = 0;
  let lastText = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    await paceHost(plan.apiHost);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-rapidapi-host": plan.apiHost,
          "x-rapidapi-key": getRapidApiKey(),
          accept: "application/json",
        },
        // Sandbox / Vercel Edge için kısa timeout — bekleyen istek bloklamasın.
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      // Ağ/timeout — birkaç kez yeniden dene, sonra yükselt.
      if (attempt < retries) {
        await sleep(Math.min(600 * 2 ** attempt, 4_000));
        continue;
      }
      throw err;
    }

    if (res.ok) {
      return (await res.json()) as unknown;
    }

    lastStatus = res.status;
    lastText = (await res.text().catch(() => "")) || res.statusText;

    // Yalnızca geçici durumlar (hız limiti / geçici sunucu hatası) yeniden denenir.
    const retriable = res.status === 429 || res.status === 503 || res.status === 502;
    if (retriable && attempt < retries) {
      const backoff = retryAfterMs(res) ?? Math.min(800 * 2 ** attempt, 6_000);
      await sleep(backoff);
      continue;
    }

    throw new RapidApiError(platform, res.status, lastText.slice(0, 240));
  }

  throw new RapidApiError(platform, lastStatus, lastText.slice(0, 240) || "RapidAPI isteği başarısız");
}

/**
 * TikTok kısa/paylaşım linklerini (vt.tiktok.com/CODE, vm.tiktok.com/CODE,
 * tiktok.com/t/CODE) yönlendirmeyi takip ederek kanonik
 * `https://www.tiktok.com/@user/video/<id>` URL'sine çözer. Böylece her link
 * KENDİ videosunun izlenmesini alır (aksi halde bazı sağlayıcılar kısa linki
 * çözemeyip profil/varsayılan değer döndürür → hep aynı "4M" sorunu).
 * Çözülemezse orijinal URL döner (RapidAPI yine de deneyebilir).
 */
async function resolveTikTokShortUrl(url: string): Promise<string> {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const isShort =
      host === "vm.tiktok.com" || host === "vt.tiktok.com" || /^\/t\//.test(u.pathname);
    if (!isShort) return url;
    const res = await fetch(u.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    const finalUrl = res.url || url;
    return finalUrl.includes("tiktok.com") && /\/video\/\d+/.test(finalUrl) ? finalUrl : url;
  } catch {
    return url;
  }
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

/** Obje veya { count: N } / { value: N } gibi sarmalayıcılardan sayı çıkarır. */
function unwrapMetricValue(v: unknown): number | null {
  const direct = toNumber(v);
  if (direct != null) return direct;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  for (const k of ["count", "value", "total", "play_count", "view_count"]) {
    const n = toNumber(o[k]);
    if (n != null) return n;
  }
  return null;
}

/** Verilen obje içinde önceliği yüksek anahtarlardan ilk bulunan sayıyı döner. */
function pickFirstNumber(obj: unknown, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const n = unwrapMetricValue(o[k]);
    if (n != null) return n;
  }
  return null;
}

/** İç içe objelerde (metrics, stats, statistics) anahtar arar — IG/TikTok yanıtları için. */
function pickMetricDeep(root: unknown, keys: string[], maxDepth = 5): number | null {
  const seen = new Set<unknown>();
  const queue: { node: unknown; depth: number }[] = [{ node: root, depth: 0 }];
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    if (!node || typeof node !== "object" || seen.has(node) || depth > maxDepth) continue;
    seen.add(node);
    const direct = pickFirstNumber(node, keys);
    if (direct != null) return direct;
    if (depth >= maxDepth) continue;
    for (const v of Object.values(node as Record<string, unknown>)) {
      if (v && typeof v === "object") queue.push({ node: v, depth: depth + 1 });
    }
  }
  return null;
}

function metricBundle(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [data];
  const o = data as Record<string, unknown>;
  const itemStruct = (o.itemInfo as { itemStruct?: unknown } | undefined)?.itemStruct;
  return [o, o.metrics, o.stats, o.statistics, o.video, o.media, itemStruct].filter(Boolean);
}

function extractMetricsFromBundles(
  bundles: unknown[],
  viewsKeys: string[],
  likesKeys: string[],
  commentsKeys: string[],
  sharesKeys: string[]
): FetchedMetrics {
  let views: number | null = null;
  let likes: number | null = null;
  let comments: number | null = null;
  let shares: number | null = null;
  for (const b of bundles) {
    views ??= pickMetricDeep(b, viewsKeys);
    likes ??= pickMetricDeep(b, likesKeys);
    comments ??= pickMetricDeep(b, commentsKeys);
    shares ??= pickMetricDeep(b, sharesKeys);
  }
  return { views, likes, comments, shares };
}

// ───────────────────────── YouTube ──────────────────────────────────────────
async function fetchYouTube(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.kind !== "video") {
    try {
      const rawV2 = await rapidApiGet("youtube", "/v2/channel-details", {
        channel_id: detected.externalRef,
      });
      const stats = (rawV2 as { stats?: unknown })?.stats ?? rawV2;
      return {
        views: pickFirstNumber(stats, ["viewCount", "views", "totalViews"]),
        likes: null,
        comments: null,
        shares: pickFirstNumber(stats, ["subscriberCount", "subscribers"]),
        raw: rawV2,
      };
    } catch {
      /* v2 yoksa klasik endpoint */
    }
    const raw = await rapidApiGet("youtube", "/channel/details/", { id: detected.externalRef });
    const stats = (raw as { stats?: unknown })?.stats ?? raw;
    return {
      views: pickFirstNumber(stats, ["viewCount", "views"]),
      likes: null,
      comments: null,
      shares: pickFirstNumber(stats, ["subscriberCount", "subscribers"]),
      raw,
    };
  }
  let raw: unknown;
  try {
    raw = await rapidApiGet("youtube", "/v2/video-details", { video_id: detected.externalRef });
  } catch {
    raw = await rapidApiGet("youtube", "/video/details/", { id: detected.externalRef });
  }
  const stats =
    (raw as { stats?: unknown })?.stats ??
    (raw as { statistics?: unknown })?.statistics ??
    raw;
  const bundles = metricBundle(stats);
  bundles.unshift(raw);
  const metrics = extractMetricsFromBundles(
    bundles,
    ["views", "viewCount", "viewCountText"],
    ["likes", "likeCount"],
    ["comments", "commentCount"],
    []
  );
  const publishedAt = pickPublishedAtIso(raw) ?? pickPublishedAtIso(stats);
  return { ...metrics, shares: null, publishedAt, raw };
}

// ───────────────────────── Instagram ────────────────────────────────────────
async function fetchInstagramProfile(username: string): Promise<unknown> {
  // NOT: Eski `/user_info_by_username` fallback'i kaldırıldı — mevcut host
  // (instagram-api-fast-reliable-data-scraper) bu endpoint'i desteklemiyor ve
  // 404 "Endpoint does not exist" dönerek gerçek /profile hatasını maskeliyordu.
  return rapidApiGet("instagram", "/profile", { username });
}

/** Gönderi / reel — önce shortcode; olmazsa tam URL (paylaşım linkleri). */
async function fetchInstagramPost(shortcode: string, sourceUrl?: string): Promise<unknown> {
  let url = sourceUrl?.trim();
  if (url && /\/share\//i.test(url)) {
    url = await resolveInstagramShareUrl(url);
  }
  try {
    return await rapidApiGet("instagram", "/post", { shortcode });
  } catch (err) {
    if (!url) throw err;
    try {
      return await rapidApiGet("instagram", "/post", { url });
    } catch {
      if (/\/share\//i.test(sourceUrl ?? "")) {
        const resolved = await resolveInstagramShareUrl(sourceUrl!);
        if (resolved !== sourceUrl) {
          return await rapidApiGet("instagram", "/post", { url: resolved });
        }
      }
      throw err;
    }
  }
}

async function fetchInstagram(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.kind === "user") {
    const raw = await fetchInstagramProfile(detected.externalRef);
    const data =
      (raw as { data?: unknown })?.data ??
      (raw as { user?: unknown })?.user ??
      raw;
    // Profil için "views" yerine takipçi sayısını izlenme metriği olarak yaz —
    // böylece IG profil linkleri "ölçüldü" olarak kaydedilir ve stale listesinden
    // çıkar. Takipçi sayısı dashboardda profile büyümesi olarak görünür.
    const followers = pickFirstNumber(data, [
      "follower_count",
      "edge_followed_by",
      "followers",
      "followers_count",
    ]);
    return {
      views: followers,
      likes: null,
      comments: null,
      shares: followers,
      raw,
    };
  }
  const raw = await fetchInstagramPost(detected.externalRef, detected.sourceUrl);
  const data =
    (raw as { data?: unknown })?.data ??
    (raw as { media?: unknown })?.media ??
    (raw as { post?: unknown })?.post ??
    raw;
  const metrics = extractMetricsFromBundles(metricBundle(data), [
    "play_count",
    "video_view_count",
    "view_count",
    "videoViewCount",
    "ig_play_count",
    "playCount",
  ], ["like_count", "edge_liked_by", "likes", "digg_count", "diggCount"], [
    "comment_count",
    "edge_media_to_comment",
    "edge_media_to_parent_comment",
    "comments",
    "commentCount",
  ], ["share_count", "shares", "shareCount", "repost_count"]);
  const publishedAt = pickPublishedAtIso(data) ?? pickPublishedAtIso(raw);
  return { ...metrics, publishedAt, raw };
}

// ───────────────────────── TikTok ───────────────────────────────────────────
/** TikTok profil — son gönderilerin izlenme toplamı (pro /user/posts). */
async function sumTikTokUserPostViews(uniqueId: string): Promise<number | null> {
  try {
    const raw = await rapidApiGet("tiktok", "/user/posts", {
      unique_id: `@${uniqueId.replace(/^@/, "")}`,
      count: "30",
    });
    const list =
      (raw as { data?: { videos?: unknown[] } })?.data?.videos ??
      (raw as { itemList?: unknown[] })?.itemList ??
      (raw as { videos?: unknown[] })?.videos ??
      [];
    if (!Array.isArray(list) || list.length === 0) return null;
    let sum = 0;
    let any = false;
    for (const item of list) {
      const n = pickMetricDeep(item, [
        "play_count",
        "playCount",
        "views",
        "view_count",
      ]);
      if (n != null) {
        sum += n;
        any = true;
      }
    }
    return any ? sum : null;
  } catch {
    return null;
  }
}

async function fetchTikTok(detected: DetectedPlatform): Promise<FetchedMetrics> {
  if (detected.kind === "user") {
    const uid = detected.externalRef.replace(/^@/, "");
    const raw = await rapidApiGet("tiktok", "/user/info", {
      unique_id: `@${uid}`,
    });
    const data = (raw as { data?: unknown })?.data ?? raw;
    const postViews = await sumTikTokUserPostViews(uid);
    const profileViews =
      pickFirstNumber(data, ["totalViews", "viewCount"]) ??
      pickMetricDeep(data, ["play_count", "playCount"]);
    return {
      views: postViews ?? profileViews,
      likes: pickFirstNumber(data, ["heartCount", "diggCount", "totalHearts"]),
      comments: null,
      shares: pickFirstNumber(data, ["followerCount", "followers"]),
      raw,
    };
  }
  const rawUrl =
    detected.sourceUrl?.trim() ||
    (detected.externalRef.match(/^\d+$/)
      ? `https://www.tiktok.com/video/${detected.externalRef}`
      : "");
  if (!rawUrl) {
    throw new RapidApiError("tiktok", 0, "TikTok video URL gerekli");
  }
  const videoUrl = await resolveTikTokShortUrl(rawUrl);
  const raw = await rapidApiGet("tiktok", "/", { url: videoUrl, hd: "1" });
  const data = (raw as { data?: unknown })?.data ?? raw;
  const item = (data as { itemInfo?: { itemStruct?: unknown } })?.itemInfo?.itemStruct;
  const bundles = metricBundle(item ?? data);
  const stats = (data as { stats?: unknown })?.stats;
  if (stats) bundles.unshift(stats);
  const metrics = extractMetricsFromBundles(bundles, [
    "play_count",
    "playCount",
    "views",
    "view_count",
  ], ["digg_count", "diggCount", "likes", "heartCount"], [
    "comment_count",
    "commentCount",
    "comments",
  ], ["share_count", "shareCount", "shares", "repost_count"]);
  const publishedAt = pickPublishedAtIso(item ?? data) ?? pickPublishedAtIso(raw);
  return { ...metrics, publishedAt, raw };
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
  /** Premium API zenginleştirmesi (yorumlar, ilgili içerik, müzik/challenge). */
  premium?: PremiumEnrichment;
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
    const raw = await rapidApiGet("youtube", "/channel/details/", { id: detected.externalRef });
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
  let raw: unknown;
  try {
    raw = await rapidApiGet("youtube", "/v2/video-details", { video_id: detected.externalRef });
  } catch {
    raw = await rapidApiGet("youtube", "/video/details/", { id: detected.externalRef });
  }
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
  const raw = await fetchInstagramPost(detected.externalRef, detected.sourceUrl);
  const r = raw as Record<string, unknown>;
  const data = ((r.data ?? r.media ?? r.post ?? r) as Record<string, unknown>);
  const igMetrics = extractMetricsFromBundles(metricBundle(data), [
    "play_count",
    "video_view_count",
    "view_count",
    "videoViewCount",
    "ig_play_count",
    "playCount",
  ], ["like_count", "edge_liked_by", "likes"], [
    "comment_count",
    "edge_media_to_comment",
    "edge_media_to_parent_comment",
    "comments",
  ], ["share_count", "shares"]);
  const caption =
    pickFirstString(data, ["caption_text", "captionText"]) ??
    pickFirstString((data.caption as Record<string, unknown>) ?? {}, ["text"]);
  const owner = (data.owner ?? data.user ?? {}) as Record<string, unknown>;
  return {
    platform: "instagram",
    kind: detected.kind,
    externalRef: detected.externalRef,
    fetchedAt: new Date().toISOString(),
    metrics: igMetrics,
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
    const raw = await rapidApiGet("tiktok", "/user/info", {
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
  const rawUrl =
    detected.sourceUrl?.trim() ||
    (detected.externalRef.match(/^\d+$/)
      ? `https://www.tiktok.com/video/${detected.externalRef}`
      : "");
  if (!rawUrl) {
    throw new RapidApiError("tiktok", 0, "TikTok video URL gerekli");
  }
  const videoUrl = await resolveTikTokShortUrl(rawUrl);
  const raw = await rapidApiGet("tiktok", "/", { url: videoUrl, hd: "1" });
  const r = raw as Record<string, unknown>;
  const data = ((r.data ?? r) as Record<string, unknown>);
  const item = (data.itemInfo as { itemStruct?: unknown } | undefined)?.itemStruct;
  const ttBundles = metricBundle(item ?? data);
  const stats = data.stats;
  if (stats) ttBundles.unshift(stats);
  const ttMetrics = extractMetricsFromBundles(ttBundles, [
    "play_count",
    "playCount",
    "views",
    "view_count",
  ], ["digg_count", "diggCount", "likes"], ["comment_count", "commentCount", "comments"], [
    "share_count",
    "shareCount",
    "shares",
  ]);
  const author = ((data.author ?? data.user ?? {}) as Record<string, unknown>);
  const desc = pickFirstString(data, ["title", "desc", "description"]);
  return {
    platform: "tiktok",
    kind: "video",
    externalRef: detected.externalRef,
    fetchedAt: new Date().toISOString(),
    metrics: ttMetrics,
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

export interface FetchRichDetailsOptions {
  /** Yorumlar, ilgili içerik, son gönderiler vb. (ek kota tüketir). */
  includePremium?: boolean;
}

/** Zengin metadata + metrik döner. Varsayılan 1 RapidAPI çağrısı; premium ile ek istekler. */
export async function fetchRichDetailsForLink(
  detected: DetectedPlatform,
  options?: FetchRichDetailsOptions
): Promise<RichLinkDetails> {
  let details: RichLinkDetails;
  if (detected.platform === "youtube") details = await richYouTube(detected);
  else if (detected.platform === "instagram") details = await richInstagram(detected);
  else if (detected.platform === "tiktok") details = await richTikTok(detected);
  else throw new RapidApiError(detected.platform, 0, "Bilinmeyen platform");

  if (options?.includePremium !== false) {
    details.premium = await enrichRichLinkDetails(detected, details);
  }
  return details;
}
