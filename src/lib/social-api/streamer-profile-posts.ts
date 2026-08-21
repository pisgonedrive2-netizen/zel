import { rapidApiGet } from "./clients";
import type { SocialPlatform } from "./config";
import { pickPublishedAtIso } from "./published-at";
import { resolveLinkDetection } from "./platform-detect";

async function fetchInstagramProfile(username: string): Promise<unknown> {
  return rapidApiGet("instagram", "/profile", { username });
}

export type ProfilePostItem = {
  url: string;
  platform: SocialPlatform;
  contentType: string;
  externalRef: string;
  publishedAt?: string;
  views?: number | null;
  title?: string;
};

function normalizePlatformLabel(p: SocialPlatform): string {
  if (p === "youtube") return "YouTube";
  if (p === "instagram") return "Instagram";
  return "TikTok";
}

function detectContentTypeFromUrl(url: string, platform: SocialPlatform): string {
  const u = url.toLowerCase();
  if (u.includes("/stories/") || u.includes("/story/")) return "story";
  if (u.includes("/reel") || u.includes("/shorts/")) return "reels";
  if (u.includes("/p/")) return "post";
  if (platform === "tiktok") return "reels";
  if (platform === "youtube" && u.includes("watch")) return "video";
  return "reels";
}

function pickFirstString(obj: unknown, keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  }
  return undefined;
}

/** Instagram pk çoğu yanıtta number; /feed user_id yalnızca rakam kabul eder. */
function pickNumericId(obj: unknown, keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(Math.trunc(v));
    if (typeof v === "string") {
      const s = v.trim();
      if (/^\d{5,}$/.test(s)) return s;
    }
  }
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

export function pickIgUserId(profileRaw: unknown): string | undefined {
  if (!profileRaw || typeof profileRaw !== "object") return undefined;
  const root = profileRaw as Record<string, unknown>;
  const nested = [
    root,
    asRecord(root.data),
    asRecord(root.user),
    asRecord(asRecord(root.data)?.user),
    asRecord(asRecord(root.data)?.data),
  ].filter(Boolean) as Record<string, unknown>[];
  const keys = ["pk", "pk_id", "user_id", "id"];
  for (const node of nested) {
    const id = pickNumericId(node, keys);
    if (id) return id;
  }
  return undefined;
}

function collectMediaList(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  const data = asRecord(root.data);
  const candidates = [root.items, data?.items, root.data, root.reels, data?.reels];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

function igCaption(o: Record<string, unknown>): string | undefined {
  return (
    pickFirstString(o, ["caption_text", "title"]) ??
    pickFirstString(asRecord(o.caption), ["text"]) ??
    (typeof o.caption === "string" ? o.caption : undefined)
  );
}

export function parseInstagramMediaList(raw: unknown, kind: "feed" | "reels"): ProfilePostItem[] {
  const list = collectMediaList(raw);
  const out: ProfilePostItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const media = asRecord(o.media) ?? o;
    const code = pickFirstString(media, ["code", "shortcode"]) ?? pickFirstString(o, ["code", "shortcode"]);
    if (!code) continue;
    const mediaType = media.media_type ?? o.media_type;
    const product = String(media.product_type ?? o.product_type ?? "").toLowerCase();
    const isReel =
      kind === "reels" ||
      product === "clips" ||
      mediaType === 2 ||
      mediaType === "2";
    const url =
      pickFirstString(media, ["url", "link"]) ??
      pickFirstString(o, ["url", "link"]) ??
      (isReel ? `https://www.instagram.com/reel/${code}/` : `https://www.instagram.com/p/${code}/`);
    const publishedAt = pickPublishedAtIso(media) ?? pickPublishedAtIso(o);
    out.push({
      url,
      platform: "instagram",
      contentType: isReel ? "reels" : detectContentTypeFromUrl(url, "instagram"),
      externalRef: code,
      publishedAt,
      title: igCaption(media) ?? igCaption(o),
    });
  }
  return out;
}

function youtubeVideoId(o: Record<string, unknown>): string | undefined {
  const nested = asRecord(o.video) ?? asRecord(o.richItemRenderer) ?? o;
  const id =
    pickFirstString(nested, ["videoId", "video_id"]) ??
    pickFirstString(o, ["videoId", "video_id"]);
  if (id && /^[\w-]{11}$/.test(id) && !id.startsWith("UC")) return id;
  const generic = pickFirstString(nested, ["id"]) ?? pickFirstString(o, ["id"]);
  if (generic && /^[\w-]{11}$/.test(generic)) return generic;
  return undefined;
}

export function parseYouTubeChannelVideos(raw: unknown, preferShorts = false): ProfilePostItem[] {
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data);
  const list =
    (Array.isArray(root.contents) && root.contents) ||
    (Array.isArray(root.videos) && root.videos) ||
    (Array.isArray(data?.contents) && data.contents) ||
    (Array.isArray(data?.videos) && data.videos) ||
    [];
  const out: ProfilePostItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const videoId = youtubeVideoId(o);
    if (!videoId) continue;
    const url =
      pickFirstString(o, ["url", "link"]) ??
      (preferShorts
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}`);
    const publishedAt = pickPublishedAtIso(o) ?? pickPublishedAtIso(asRecord(o.video));
    const isShort =
      preferShorts ||
      url.toLowerCase().includes("/shorts/") ||
      Boolean(o.isShort) ||
      Boolean(o.is_short);
    out.push({
      url,
      platform: "youtube",
      contentType: isShort ? "reels" : "video",
      externalRef: videoId,
      publishedAt,
      title: pickFirstString(o, ["title", "name", "videoTitle"]) ?? pickFirstString(asRecord(o.video), ["title"]),
    });
  }
  return out;
}

function parseTikTokUserPosts(raw: unknown): ProfilePostItem[] {
  const root = raw as Record<string, unknown>;
  const list =
    (root.data as { videos?: unknown[] } | undefined)?.videos ??
    (Array.isArray(root.itemList) ? root.itemList : null) ??
    (Array.isArray(root.videos) ? root.videos : []) ??
    [];
  const out: ProfilePostItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const struct =
      (o.itemInfo as { itemStruct?: Record<string, unknown> } | undefined)?.itemStruct ?? o;
    const videoId = pickFirstString(struct, ["id", "video_id", "aweme_id"]);
    const authorId =
      pickFirstString(struct, ["author", "unique_id"]) ??
      pickFirstString((struct.author as Record<string, unknown> | undefined) ?? {}, [
        "uniqueId",
        "unique_id",
      ]);
    const url =
      pickFirstString(struct, ["share_url", "url"]) ??
      (authorId && videoId
        ? `https://www.tiktok.com/@${authorId.replace(/^@/, "")}/video/${videoId}`
        : videoId
          ? `https://www.tiktok.com/video/${videoId}`
          : undefined);
    if (!url) continue;
    out.push({
      url,
      platform: "tiktok",
      contentType: "reels",
      externalRef: videoId ?? url,
      publishedAt: pickPublishedAtIso(struct) ?? pickPublishedAtIso(o),
      title: pickFirstString(struct, ["desc", "title", "description"]),
    });
  }
  return out;
}

function accountToDetection(
  platform: string,
  handle: string,
  url: string
): ReturnType<typeof resolveLinkDetection> {
  const profileUrl =
    url?.trim() ||
    (platform.toLowerCase().includes("instagram")
      ? `https://www.instagram.com/${handle.replace(/^@/, "")}/`
      : platform.toLowerCase().includes("tiktok")
        ? `https://www.tiktok.com/@${handle.replace(/^@/, "")}`
        : platform.toLowerCase().includes("youtube")
          ? handle.startsWith("UC")
            ? `https://www.youtube.com/channel/${handle}`
            : `https://www.youtube.com/@${handle.replace(/^@/, "")}`
          : "");
  if (!profileUrl) return null;
  return resolveLinkDetection({
    url: profileUrl,
    platform,
    handle,
  });
}

function isYoutubeChannelId(id: string): boolean {
  return /^UC[\w-]{20,}$/.test(id);
}

async function resolveYoutubeChannelId(ref: string, sourceUrl?: string): Promise<string> {
  const trimmed = ref.trim();
  if (isYoutubeChannelId(trimmed)) return trimmed;
  const lookup =
    sourceUrl?.trim() ||
    (trimmed.startsWith("http")
      ? trimmed
      : trimmed.startsWith("@")
        ? `https://www.youtube.com/${trimmed}`
        : `https://www.youtube.com/@${trimmed.replace(/^@/, "")}`);
  const raw = await rapidApiGet("youtube", "/channel/details/", { id: lookup });
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data);
  const channelId =
    pickFirstString(root, ["channelId", "channel_id"]) ??
    pickFirstString(data, ["channelId", "channel_id"]) ??
    pickFirstString(asRecord(root.meta), ["channelId", "channel_id"]);
  if (channelId && isYoutubeChannelId(channelId)) return channelId;
  return trimmed;
}

function mergePosts(items: ProfilePostItem[]): ProfilePostItem[] {
  const byRef = new Map<string, ProfilePostItem>();
  for (const p of items) {
    const key = (p.externalRef || p.url).toLowerCase();
    const prev = byRef.get(key);
    if (!prev) {
      byRef.set(key, p);
      continue;
    }
    byRef.set(key, {
      ...prev,
      ...p,
      publishedAt: p.publishedAt || prev.publishedAt,
      title: p.title || prev.title,
    });
  }
  return [...byRef.values()];
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Yayıncı kişisel hesabından son gönderileri RapidAPI ile çeker. */
export async function fetchProfilePostsForAccount(opts: {
  platform: string;
  handle: string;
  url: string;
  maxItems?: number;
}): Promise<ProfilePostItem[]> {
  const detected = accountToDetection(opts.platform, opts.handle, opts.url);
  if (!detected) return [];
  // YouTube kanalları kind=channel; video/reel linki profil taraması değil.
  if (detected.kind === "video") return [];

  const max = opts.maxItems ?? 30;
  let items: ProfilePostItem[] = [];

  if (detected.platform === "tiktok") {
    const uid = detected.externalRef.replace(/^@/, "");
    const raw = await rapidApiGet("tiktok", "/user/posts", {
      unique_id: `@${uid}`,
      count: String(Math.min(max, 30)),
    });
    items = parseTikTokUserPosts(raw);
  } else if (detected.platform === "youtube") {
    const channelId = await resolveYoutubeChannelId(detected.externalRef, detected.sourceUrl);
    const errors: string[] = [];
    const chunks: ProfilePostItem[] = [];
    for (const filter of ["videos_latest", "shorts_latest"] as const) {
      try {
        const raw = await rapidApiGet("youtube", "/channel/videos/", {
          id: channelId,
          filter,
        });
        chunks.push(...parseYouTubeChannelVideos(raw, filter === "shorts_latest"));
      } catch (err) {
        errors.push(`${filter}: ${errMessage(err).slice(0, 80)}`);
      }
    }
    items = mergePosts(chunks);
    if (items.length === 0 && errors.length > 0) {
      throw new Error(`YouTube kanal videoları alınamadı (${errors[0]})`);
    }
  } else if (detected.platform === "instagram") {
    const username = detected.externalRef.replace(/^@/, "");
    const profileRaw = await fetchInstagramProfile(username);
    const userId = pickIgUserId(profileRaw);
    if (!userId) {
      throw new Error(`Instagram kullanıcı id bulunamadı (@${username})`);
    }
    const errors: string[] = [];
    let feedRaw: unknown = null;
    let reelsRaw: unknown = null;
    try {
      feedRaw = await rapidApiGet("instagram", "/feed", { user_id: userId });
    } catch (err) {
      errors.push(`feed: ${errMessage(err).slice(0, 80)}`);
    }
    try {
      reelsRaw = await rapidApiGet("instagram", "/reels", { user_id: userId });
    } catch (err) {
      errors.push(`reels: ${errMessage(err).slice(0, 80)}`);
    }
    const merged = [
      ...(feedRaw ? parseInstagramMediaList(feedRaw, "feed") : []),
      ...(reelsRaw ? parseInstagramMediaList(reelsRaw, "reels") : []),
    ];
    items = mergePosts(merged);
    if (items.length === 0 && errors.length > 0) {
      throw new Error(`Instagram gönderileri alınamadı (${errors[0]})`);
    }
  }

  return items.slice(0, max).map((p) => ({
    ...p,
    platform: p.platform,
  }));
}

export function profilePostPlatformLabel(p: ProfilePostItem): string {
  return normalizePlatformLabel(p.platform);
}
