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
  }
  return undefined;
}

function pickIgUserId(profileRaw: unknown): string | undefined {
  const root = profileRaw as Record<string, unknown>;
  const data =
    (root.data as Record<string, unknown> | undefined) ??
    (root.user as Record<string, unknown> | undefined) ??
    root;
  return (
    pickFirstString(data, ["pk", "id", "pk_id", "user_id"]) ??
    pickFirstString(root, ["pk", "id"])
  );
}

function parseInstagramMediaList(raw: unknown, kind: "feed" | "reels"): ProfilePostItem[] {
  const root = raw as Record<string, unknown>;
  const list =
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray((root.data as { items?: unknown[] } | undefined)?.items) &&
      (root.data as { items: unknown[] }).items) ||
    [];
  const out: ProfilePostItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const code =
      pickFirstString(o, ["code", "shortcode"]) ??
      pickFirstString(o.media as Record<string, unknown> | undefined, ["code", "shortcode"]);
    if (!code) continue;
    const url =
      pickFirstString(o, ["url", "link"]) ??
      (kind === "reels"
        ? `https://www.instagram.com/reel/${code}/`
        : `https://www.instagram.com/p/${code}/`);
    const publishedAt = pickPublishedAtIso(o) ?? pickPublishedAtIso(o.media);
    out.push({
      url,
      platform: "instagram",
      contentType: kind === "reels" ? "reels" : detectContentTypeFromUrl(url, "instagram"),
      externalRef: code,
      publishedAt,
      title: pickFirstString(o, ["caption", "title"]),
    });
  }
  return out;
}

function parseYouTubeChannelVideos(raw: unknown): ProfilePostItem[] {
  const root = raw as Record<string, unknown>;
  const list =
    (Array.isArray(root.videos) && root.videos) ||
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray((root.data as { videos?: unknown[] } | undefined)?.videos) &&
      (root.data as { videos: unknown[] }).videos) ||
    [];
  const out: ProfilePostItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const videoId =
      pickFirstString(o, ["videoId", "video_id", "id"]) ??
      pickFirstString(o, ["video_id"]);
    if (!videoId || videoId.length < 6) continue;
    const url =
      pickFirstString(o, ["url", "link"]) ??
      `https://www.youtube.com/watch?v=${videoId}`;
    const publishedAt = pickPublishedAtIso(o);
    const isShort =
      url.toLowerCase().includes("/shorts/") ||
      Boolean(o.isShort) ||
      Boolean(o.is_short);
    out.push({
      url,
      platform: "youtube",
      contentType: isShort ? "reels" : "video",
      externalRef: videoId,
      publishedAt,
      title: pickFirstString(o, ["title", "name"]),
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

/** Yayıncı kişisel hesabından son gönderileri RapidAPI ile çeker. */
export async function fetchProfilePostsForAccount(opts: {
  platform: string;
  handle: string;
  url: string;
  maxItems?: number;
}): Promise<ProfilePostItem[]> {
  const detected = accountToDetection(opts.platform, opts.handle, opts.url);
  if (!detected || detected.kind !== "user") return [];

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
    const raw = await rapidApiGet("youtube", "/channel/videos/", {
      id: detected.externalRef,
      filter: "videos_latest",
    });
    items = parseYouTubeChannelVideos(raw);
  } else if (detected.platform === "instagram") {
    const username = detected.externalRef.replace(/^@/, "");
    const profileRaw = await fetchInstagramProfile(username);
    const userId = pickIgUserId(profileRaw);
    if (!userId) return [];
    const [feedRaw, reelsRaw] = await Promise.all([
      rapidApiGet("instagram", "/feed", { user_id: userId }).catch(() => null),
      rapidApiGet("instagram", "/reels", { user_id: userId }).catch(() => null),
    ]);
    const merged = [
      ...(feedRaw ? parseInstagramMediaList(feedRaw, "feed") : []),
      ...(reelsRaw ? parseInstagramMediaList(reelsRaw, "reels") : []),
    ];
    const byUrl = new Map<string, ProfilePostItem>();
    for (const p of merged) byUrl.set(p.url.toLowerCase(), p);
    items = [...byUrl.values()];
  }

  return items.slice(0, max).map((p) => ({
    ...p,
    platform: p.platform,
  }));
}

export function profilePostPlatformLabel(p: ProfilePostItem): string {
  return normalizePlatformLabel(p.platform);
}
