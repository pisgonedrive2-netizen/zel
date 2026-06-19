import { rapidApiGet } from "./clients";
import type { SocialPlatform } from "./config";

export type DiscoveryType =
  | "trending"
  | "search"
  | "hashtag"
  | "hashtag_discover"
  | "user_search"
  | "user_profile"
  | "user_feed"
  | "user_reels"
  | "user_posts"
  | "user_followers"
  | "user_stories"
  | "related_videos"
  | "channel_videos"
  | "channel_details"
  | "video_details"
  | "post_lookup"
  | "resolve_share"
  | "video_lookup"
  | "music_detail"
  | "challenge_info"
  | "challenge_videos";

export type DiscoveryItemKind = "video" | "user" | "hashtag" | "channel";

export interface DiscoveryResultItem {
  title: string;
  subtitle?: string;
  views?: number | null;
  likes?: number | null;
  url?: string;
  imageUrl?: string;
  kind: DiscoveryItemKind;
  platform: SocialPlatform;
}

export interface DiscoveryRequest {
  platform: SocialPlatform;
  type: DiscoveryType;
  query?: string;
  gl?: string;
  hl?: string;
  count?: string;
  searchType?: string;
  igSection?: string;
  ttRegion?: string;
  ttSortType?: string;
  ttPublishTime?: string;
  ttFollowerCount?: string;
  ttProfileType?: string;
  ttOtherPref?: string;
  ytChannelFilter?: string;
}

export interface DiscoveryResponse {
  items: DiscoveryResultItem[];
  apiCalls: number;
  endpoints: string[];
}

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

function pickFirstString(obj: unknown, keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function ttRegionFromCountry(code: string): string {
  return code.trim().toLowerCase() || "us";
}

function parseYouTubeTrending(raw: unknown): DiscoveryResultItem[] {
  const list = (raw as { list?: unknown[] })?.list ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const videoId = pickFirstString(o, ["videoId", "video_id", "id"]);
    const title = pickFirstString(o, ["title"]);
    if (!title && !videoId) continue;
    out.push({
      platform: "youtube",
      kind: "video",
      title: (title ?? videoId ?? "Video").slice(0, 140),
      subtitle: pickFirstString(o, ["author", "channelTitle"]),
      views: toNumber(o.viewCount ?? o.views),
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
      imageUrl: pickFirstString(o.videoThumbnails as unknown, ["url"]) ?? pickFirstString(
        Array.isArray(o.videoThumbnails) ? (o.videoThumbnails[0] as Record<string, unknown>) : undefined,
        ["url"],
      ),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseYouTubeSearch(raw: unknown, searchType = "video"): DiscoveryResultItem[] {
  const contents = (raw as { contents?: unknown[] })?.contents ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const item of contents) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const video = (row.video ?? row) as Record<string, unknown>;
    const channel = (row.channel ?? row) as Record<string, unknown>;
    const isChannel = searchType === "channel" || row.type === "channel" || (!row.video && row.channel);

    if (isChannel) {
      const channelId = pickFirstString(channel, ["channelId", "channel_id", "id", "browseId"]);
      const title = pickFirstString(channel, ["title", "name", "channelTitle"]);
      if (!title && !channelId) continue;
      out.push({
        platform: "youtube",
        kind: "channel",
        title: (title ?? channelId ?? "Kanal").slice(0, 140),
        subtitle: pickFirstString(channel, ["subscriberCountText", "videoCountText"]),
        views: toNumber(channel.subscriberCount ?? channel.subscribers),
        url: channelId ? `https://www.youtube.com/channel/${channelId}` : undefined,
        imageUrl: pickFirstString(channel, ["avatar", "thumbnail"]),
      });
    } else {
      const videoId = pickFirstString(video, ["videoId", "video_id", "id"]);
      const title = pickFirstString(video, ["title", "videoTitle"]);
      if (!title && !videoId) continue;
      const stats = (video.stats ?? video) as Record<string, unknown>;
      const author = (video.author ?? {}) as Record<string, unknown>;
      out.push({
        platform: "youtube",
        kind: "video",
        title: (title ?? videoId ?? "Video").slice(0, 140),
        subtitle: pickFirstString(author, ["name", "title", "channelTitle"]),
        views: toNumber(stats.views ?? stats.viewCount ?? video.viewCount),
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
      });
    }
    if (out.length >= 30) break;
  }
  return out;
}

function parseYouTubeVideoDetails(raw: unknown, videoId: string): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const title = pickFirstString(data, ["title", "videoTitle"]) ?? videoId;
  return [
    {
      platform: "youtube",
      kind: "video",
      title: title.slice(0, 140),
      subtitle: pickFirstString(data, ["author", "channelTitle", "channelName"]),
      views: toNumber(data.viewCount ?? data.views),
      likes: toNumber(data.likeCount ?? data.likes),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      imageUrl: pickFirstString(data, ["thumbnail", "image"]),
    },
  ];
}

function parseYouTubeChannelDetails(raw: unknown, channelId: string): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root.meta ?? root) as Record<string, unknown>;
  const title = pickFirstString(data, ["title", "name", "channelTitle"]) ?? channelId;
  return [
    {
      platform: "youtube",
      kind: "channel",
      title: title.slice(0, 140),
      subtitle: pickFirstString(data, ["description", "country"]),
      views: toNumber(data.subscriberCount ?? data.subscribers),
      likes: toNumber(data.videoCount ?? data.videos),
      url: `https://www.youtube.com/channel/${channelId}`,
      imageUrl: pickFirstString(data, ["avatar", "thumbnail", "image"]),
    },
  ];
}

function normalizeUsername(q: string): string {
  return q.trim().replace(/^@/, "");
}

function extractYoutubeVideoId(q: string): string | null {
  const trimmed = q.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const v = u.searchParams.get("v");
    if (v) return v;
    const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/);
    if (shorts) return shorts[1];
  } catch {
    /* not a url */
  }
  return null;
}

function pickIgUserId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const data = (o.data ?? o.user ?? o) as Record<string, unknown>;
  return pickFirstString(data, ["pk", "id", "pk_id", "user_id"]);
}

function parseInstagramMediaList(raw: unknown, kind: "feed" | "reels"): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const list =
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray((root.data as { items?: unknown[] } | undefined)?.items) &&
      (root.data as { items: unknown[] }).items) ||
    [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const code =
      pickFirstString(o, ["code", "shortcode"]) ??
      pickFirstString(o.media as Record<string, unknown> | undefined, ["code", "shortcode"]);
    if (!code) continue;
    const caption =
      pickFirstString(o, ["caption_text", "caption"]) ??
      pickFirstString((o.caption as Record<string, unknown> | undefined) ?? {}, ["text"]);
    const user = (o.user ?? o.owner) as Record<string, unknown> | undefined;
    const username = pickFirstString(user, ["username"]);
    const isReel = kind === "reels" || toNumber(o.media_type) === 2;
    out.push({
      platform: "instagram",
      kind: "video",
      title: (caption || (isReel ? "Reel" : "Gönderi")).slice(0, 140),
      subtitle: username ? `@${username}` : undefined,
      views: toNumber(o.play_count ?? o.view_count ?? o.like_count),
      likes: toNumber(o.like_count),
      url: isReel
        ? `https://www.instagram.com/reel/${code}/`
        : `https://www.instagram.com/p/${code}/`,
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseInstagramProfile(raw: unknown, username: string): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root.user ?? root) as Record<string, unknown>;
  const handle = pickFirstString(data, ["username"]) ?? username;
  const followers = toNumber(data.follower_count ?? data.edge_followed_by);
  const media = toNumber(data.media_count);
  return [
    {
      platform: "instagram",
      kind: "user",
      title: pickFirstString(data, ["full_name", "name"]) ?? handle,
      subtitle: `@${handle}`,
      views: followers,
      likes: media,
      url: `https://www.instagram.com/${handle}/`,
      imageUrl: pickFirstString(data, ["profile_pic_url_hd", "profile_pic_url"]),
    },
  ];
}

function parseTikTokProfile(raw: unknown, username: string): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root.user ?? root) as Record<string, unknown>;
  const user = (data.user ?? data) as Record<string, unknown>;
  const stats = (data.stats ?? user.stats ?? {}) as Record<string, unknown>;
  const uniqueId =
    pickFirstString(user, ["unique_id", "uniqueId"]) ?? normalizeUsername(username);
  return [
    {
      platform: "tiktok",
      kind: "user",
      title: pickFirstString(user, ["nickname", "name"]) ?? uniqueId,
      subtitle: `@${uniqueId}`,
      views: toNumber(stats.followerCount ?? stats.follower_count),
      likes: toNumber(stats.heartCount ?? stats.heart ?? stats.digg_count),
      url: `https://www.tiktok.com/@${uniqueId}`,
      imageUrl: pickFirstString(user, ["avatarThumb", "avatar_thumb", "avatar"]),
    },
  ];
}

function parseYouTubeRelated(raw: unknown): DiscoveryResultItem[] {
  const contents = (raw as { contents?: unknown[] })?.contents ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const item of contents) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const videoId = pickFirstString(o, ["videoId", "id"]);
    const title = pickFirstString(o, ["title", "videoTitle"]);
    if (!title && !videoId) continue;
    out.push({
      platform: "youtube",
      kind: "video",
      title: (title ?? videoId ?? "Video").slice(0, 140),
      subtitle: pickFirstString(o, ["author", "channelTitle"]),
      views: toNumber(o.viewCount ?? o.views),
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseYouTubeChannelVideos(raw: unknown): DiscoveryResultItem[] {
  const contents = (raw as { contents?: unknown[]; videos?: unknown[] })?.contents
    ?? (raw as { videos?: unknown[] })?.videos
    ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const item of contents) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const videoId = pickFirstString(o, ["videoId", "video_id", "id"]);
    const title = pickFirstString(o, ["title", "videoTitle", "name"]);
    if (!title && !videoId) continue;
    out.push({
      platform: "youtube",
      kind: "video",
      title: (title ?? videoId ?? "Video").slice(0, 140),
      views: toNumber(o.viewCount ?? o.views),
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseInstagramHashtagDiscover(raw: unknown): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const list =
    (root.data as { results?: unknown[] } | undefined)?.results ??
    (Array.isArray(root.results) ? root.results : []) ??
    [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = pickFirstString(o, ["name", "hashtag"]);
    if (!name) continue;
    const tag = name.replace(/^#/, "");
    out.push({
      platform: "instagram",
      kind: "hashtag",
      title: `#${tag}`,
      subtitle: pickFirstString(o, ["search_result_subtitle"]),
      views: toNumber(o.media_count ?? o.formatted_media_count),
      url: `https://www.instagram.com/explore/tags/${tag}/`,
      imageUrl: pickFirstString(o, ["profile_pic_url"]),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseInstagramHashtagPosts(raw: unknown): DiscoveryResultItem[] {
  const sections = (raw as { data?: { sections?: unknown[] } })?.data?.sections ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const medias =
      ((section as { layout_content?: { medias?: unknown[] } }).layout_content?.medias) ?? [];
    for (const entry of medias) {
      if (!entry || typeof entry !== "object") continue;
      const media = ((entry as { media?: Record<string, unknown> }).media ?? entry) as Record<
        string,
        unknown
      >;
      const code = pickFirstString(media, ["code", "shortcode"]);
      if (!code) continue;
      const mediaType = toNumber(media.media_type);
      const isReel = mediaType === 2;
      const caption =
        pickFirstString(media, ["caption_text", "caption"]) ??
        pickFirstString((media.caption as Record<string, unknown> | undefined) ?? {}, ["text"]);
      const user = (media.user ?? media.owner) as Record<string, unknown> | undefined;
      const username = pickFirstString(user, ["username"]);
      out.push({
        platform: "instagram",
        kind: "video",
        title: (caption || (isReel ? "Reel" : "Gönderi")).slice(0, 140),
        subtitle: username ? `@${username}` : undefined,
        views: toNumber(media.play_count ?? media.view_count ?? media.like_count),
        likes: toNumber(media.like_count),
        url: isReel
          ? `https://www.instagram.com/reel/${code}/`
          : `https://www.instagram.com/p/${code}/`,
      });
      if (out.length >= 30) break;
    }
    if (out.length >= 30) break;
  }
  return out;
}

function parseInstagramUserSearch(raw: unknown): DiscoveryResultItem[] {
  const list = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const username = pickFirstString(o, ["username"]);
    if (!username) continue;
    out.push({
      platform: "instagram",
      kind: "user",
      title: pickFirstString(o, ["full_name", "name"]) ?? username,
      subtitle: `@${username}`,
      url: `https://www.instagram.com/${username}/`,
      imageUrl: pickFirstString(o, ["profile_pic_url"]),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseTikTokVideos(raw: unknown, limit = 30): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = root.data;
  const list = Array.isArray(data)
    ? data
    : (data as { videos?: unknown[] } | undefined)?.videos ??
      (Array.isArray(root.videos) ? root.videos : []) ??
      [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const videoId = pickFirstString(o, ["aweme_id", "video_id", "id"]);
    const title =
      pickFirstString(o, ["title"]) ??
      (Array.isArray(o.content_desc) ? (o.content_desc as string[]).join(" ") : undefined) ??
      pickFirstString(o, ["desc", "description"]);
    const author = (o.author ?? o.author_info) as Record<string, unknown> | undefined;
    const stats = (o.stats ?? author?.stats) as Record<string, unknown> | undefined;
    const uniqueId =
      pickFirstString(author, ["unique_id", "uniqueId"]) ?? pickFirstString(o, ["author", "unique_id"]);
    out.push({
      platform: "tiktok",
      kind: "video",
      title: (title || "TikTok video").slice(0, 140),
      subtitle: uniqueId ? `@${uniqueId.replace(/^@/, "")}` : pickFirstString(o, ["region"]),
      views: toNumber(o.play ?? o.play_count ?? o.view_count ?? stats?.playCount ?? stats?.play_count),
      likes: toNumber(o.digg_count ?? stats?.diggCount ?? stats?.heart),
      url:
        pickFirstString(o, ["share_url", "url"]) ??
        (uniqueId && videoId
          ? `https://www.tiktok.com/@${uniqueId.replace(/^@/, "")}/video/${videoId}`
          : undefined),
      imageUrl: pickFirstString(o, ["cover", "origin_cover"]),
    });
    if (out.length >= limit) break;
  }
  return out;
}

function parseTikTokUserSearch(raw: unknown): DiscoveryResultItem[] {
  const list = (raw as { data?: { user_list?: unknown[] } })?.data?.user_list ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const user = (row.user ?? row) as Record<string, unknown>;
    const uniqueId = pickFirstString(user, ["unique_id", "uniqueId", "username"]);
    if (!uniqueId) continue;
    const stats = (row.stats ?? user.stats ?? {}) as Record<string, unknown>;
    out.push({
      platform: "tiktok",
      kind: "user",
      title: pickFirstString(user, ["nickname", "name"]) ?? uniqueId,
      subtitle: `@${uniqueId.replace(/^@/, "")}`,
      views: toNumber(stats.followerCount ?? stats.follower_count ?? user.follower_count),
      likes: toNumber(stats.heartCount ?? stats.heart ?? user.heart_count),
      url: `https://www.tiktok.com/@${uniqueId.replace(/^@/, "")}`,
      imageUrl: pickFirstString(user, ["avatarThumb", "avatar_thumb", "avatar"]),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseInstagramFollowers(raw: unknown): DiscoveryResultItem[] {
  const list =
    (raw as { data?: { users?: unknown[] } })?.data?.users ??
    (Array.isArray((raw as { users?: unknown[] }).users) ? (raw as { users: unknown[] }).users : []) ??
    [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const user = (o.user ?? o) as Record<string, unknown>;
    const username = pickFirstString(user, ["username"]);
    if (!username) continue;
    out.push({
      platform: "instagram",
      kind: "user",
      title: pickFirstString(user, ["full_name", "name"]) ?? username,
      subtitle: `@${username}`,
      url: `https://www.instagram.com/${username}/`,
      imageUrl: pickFirstString(user, ["profile_pic_url"]),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseInstagramStories(raw: unknown, username: string): DiscoveryResultItem[] {
  const list =
    (raw as { data?: { reels?: unknown[] } })?.data?.reels ??
    (Array.isArray((raw as { items?: unknown[] }).items) ? (raw as { items: unknown[] }).items : []) ??
    [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const media = (o.media ?? o) as Record<string, unknown>;
    const code = pickFirstString(media, ["code", "id", "pk"]);
    out.push({
      platform: "instagram",
      kind: "video",
      title: `Story · @${username}`,
      subtitle: pickFirstString(media, ["media_type"]) ? "Hikaye" : undefined,
      url: code ? `https://www.instagram.com/stories/${username}/${code}/` : `https://www.instagram.com/${username}/`,
      imageUrl: pickFirstString(media, ["image_versions2", "thumbnail_url"]),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseInstagramPost(raw: unknown): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const code = pickFirstString(data, ["code", "shortcode"]);
  const caption =
    pickFirstString(data, ["caption_text", "caption"]) ??
    pickFirstString((data.caption as Record<string, unknown> | undefined) ?? {}, ["text"]);
  const user = (data.user ?? data.owner) as Record<string, unknown> | undefined;
  const username = pickFirstString(user, ["username"]);
  const isReel = toNumber(data.media_type) === 2;
  if (!code) return [];
  return [
    {
      platform: "instagram",
      kind: "video",
      title: (caption || (isReel ? "Reel" : "Gönderi")).slice(0, 140),
      subtitle: username ? `@${username}` : undefined,
      views: toNumber(data.play_count ?? data.view_count ?? data.like_count),
      likes: toNumber(data.like_count),
      url: isReel
        ? `https://www.instagram.com/reel/${code}/`
        : `https://www.instagram.com/p/${code}/`,
    },
  ];
}

function parseTikTokFollowers(raw: unknown): DiscoveryResultItem[] {
  const list =
    (raw as { data?: { followers?: unknown[] } })?.data?.followers ??
    (raw as { data?: { user_list?: unknown[] } })?.data?.user_list ??
    [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const user = (row.user ?? row) as Record<string, unknown>;
    const uniqueId = pickFirstString(user, ["unique_id", "uniqueId", "username"]);
    if (!uniqueId) continue;
    out.push({
      platform: "tiktok",
      kind: "user",
      title: pickFirstString(user, ["nickname", "name"]) ?? uniqueId,
      subtitle: `@${uniqueId.replace(/^@/, "")}`,
      url: `https://www.tiktok.com/@${uniqueId.replace(/^@/, "")}`,
      imageUrl: pickFirstString(user, ["avatarThumb", "avatar_thumb", "avatar"]),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function parseTikTokMusicInfo(raw: unknown): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root.music ?? root) as Record<string, unknown>;
  const title = pickFirstString(data, ["title", "music_name", "name"]);
  if (!title) return [];
  const author = pickFirstString(data, ["author", "authorName", "artist"]);
  return [
    {
      platform: "tiktok",
      kind: "hashtag",
      title: title.slice(0, 140),
      subtitle: author ? `Sanatçı: ${author}` : undefined,
      views: toNumber(data.video_count ?? data.user_count),
      url: pickFirstString(data, ["play_url", "share_url"]),
    },
  ];
}

function parseTikTokChallengeInfo(raw: unknown, tag: string): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root.challenge ?? root) as Record<string, unknown>;
  const name = pickFirstString(data, ["cha_name", "challenge_name", "title"]) ?? tag;
  const clean = name.replace(/^#/, "");
  return [
    {
      platform: "tiktok",
      kind: "hashtag",
      title: `#${clean}`,
      subtitle: pickFirstString(data, ["desc", "description"]),
      views: toNumber(data.view_count ?? data.user_count),
      likes: toNumber(data.user_count),
      url: `https://www.tiktok.com/tag/${clean}`,
    },
  ];
}

function parseTikTokVideoLookup(raw: unknown): DiscoveryResultItem[] {
  const items = parseTikTokVideos(raw, 1);
  return items.length > 0 ? items : [];
}

function parseInstagramResolveShare(raw: unknown): DiscoveryResultItem[] {
  const root = raw as Record<string, unknown>;
  const url = pickFirstString(root, ["url", "resolved_url", "permalink"]) ??
    pickFirstString((root.data as Record<string, unknown> | undefined) ?? {}, ["url", "permalink"]);
  if (!url) return [];
  return [
    {
      platform: "instagram",
      kind: "video",
      title: "Çözümlenmiş paylaşım linki",
      subtitle: url.slice(0, 80),
      url,
    },
  ];
}

function parseTikTokChallengeDiscover(raw: unknown): DiscoveryResultItem[] {
  const list = (raw as { data?: { challenge_list?: unknown[] } })?.data?.challenge_list ?? [];
  const out: DiscoveryResultItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = pickFirstString(o, ["cha_name", "challenge_name", "title"]);
    if (!name) continue;
    const tag = name.replace(/^#/, "");
    out.push({
      platform: "tiktok",
      kind: "hashtag",
      title: `#${tag}`,
      subtitle: pickFirstString(o, ["desc", "description"]),
      views: toNumber(o.view_count ?? o.user_count),
      url: `https://www.tiktok.com/tag/${tag}`,
      imageUrl: pickFirstString(o, ["cover"]),
    });
    if (out.length >= 30) break;
  }
  return out;
}

export function parseDiscoveryPayload(
  platform: SocialPlatform,
  type: DiscoveryType,
  raw: unknown,
  opts: { searchType?: string; query?: string } = {},
): DiscoveryResultItem[] {
  if (platform === "youtube") {
    if (type === "trending") return parseYouTubeTrending(raw);
    if (type === "related_videos") return parseYouTubeRelated(raw);
    if (type === "channel_videos") return parseYouTubeChannelVideos(raw);
    if (type === "video_details") {
      const videoId = extractYoutubeVideoId(opts.query ?? "") ?? "video";
      return parseYouTubeVideoDetails(raw, videoId);
    }
    if (type === "channel_details") {
      const channelId = (opts.query ?? "").replace(/^@/, "") || "channel";
      return parseYouTubeChannelDetails(raw, channelId);
    }
    return parseYouTubeSearch(raw, opts.searchType ?? "video");
  }
  if (platform === "instagram") {
    if (type === "hashtag_discover") return parseInstagramHashtagDiscover(raw);
    if (type === "user_search") return parseInstagramUserSearch(raw);
    if (type === "user_profile") return parseInstagramProfile(raw, "");
    if (type === "user_feed") return parseInstagramMediaList(raw, "feed");
    if (type === "user_reels") return parseInstagramMediaList(raw, "reels");
    if (type === "post_lookup") return parseInstagramPost(raw);
    if (type === "resolve_share") return parseInstagramResolveShare(raw);
    if (type === "user_stories") return parseInstagramStories(raw, normalizeUsername(opts.query ?? ""));
    if (type === "user_followers") return parseInstagramFollowers(raw);
    return parseInstagramHashtagPosts(raw);
  }
  if (type === "user_search") return parseTikTokUserSearch(raw);
  if (type === "user_profile") return parseTikTokProfile(raw, "");
  if (type === "user_posts" || type === "video_lookup") return parseTikTokVideoLookup(raw);
  if (type === "user_followers") return parseTikTokFollowers(raw);
  if (type === "music_detail") return parseTikTokMusicInfo(raw);
  if (type === "challenge_info") return parseTikTokChallengeInfo(raw, opts.query ?? "");
  if (type === "hashtag_discover") return parseTikTokChallengeDiscover(raw);
  if (type === "trending" || type === "search" || type === "challenge_videos" || type === "hashtag") {
    return parseTikTokVideos(raw);
  }
  return [];
}

export async function runSocialDiscovery(req: DiscoveryRequest): Promise<DiscoveryResponse> {
  const {
    platform,
    type,
    query = "",
    gl = "TR",
    hl = "tr",
    count = "15",
    searchType = "video",
    igSection = "top",
    ttRegion,
    ttSortType = "0",
    ttPublishTime = "0",
    ttFollowerCount = "0",
    ttProfileType = "0",
    ttOtherPref = "0",
    ytChannelFilter = "videos_latest",
  } = req;

  const q = query.trim().replace(/^#/, "");
  const endpoints: string[] = [];
  let apiCalls = 0;
  let raw: unknown;

  if (platform === "youtube") {
    if (type === "video_details") {
      const videoId = extractYoutubeVideoId(q);
      if (!videoId) throw new Error("Geçerli video ID veya YouTube URL gerekli");
      endpoints.push("/video/details/");
      raw = await rapidApiGet("youtube", "/video/details/", { id: videoId });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw, { query: q }),
        apiCalls,
        endpoints,
      };
    }
    if (type === "channel_details") {
      if (!q) throw new Error("Kanal ID veya @handle gerekli");
      const channelId = q.startsWith("UC") ? q : q.replace(/^@/, "");
      endpoints.push("/channel/details/");
      raw = await rapidApiGet("youtube", "/channel/details/", { id: channelId });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw, { query: channelId }),
        apiCalls,
        endpoints,
      };
    }
    if (type === "related_videos") {
      const videoId = extractYoutubeVideoId(q);
      if (!videoId) throw new Error("Geçerli video ID veya YouTube URL gerekli");
      endpoints.push("/video/related-contents/");
      raw = await rapidApiGet("youtube", "/video/related-contents/", { id: videoId });
      apiCalls += 1;
    } else if (type === "channel_videos") {
      if (!q) throw new Error("Kanal ID veya @handle gerekli");
      const channelId = q.startsWith("UC") ? q : q.replace(/^@/, "");
      endpoints.push("/channel/videos/");
      raw = await rapidApiGet("youtube", "/channel/videos/", {
        id: channelId,
        filter: ytChannelFilter,
      });
      apiCalls += 1;
    } else if (type === "search") {
      if (!q) throw new Error("Arama için anahtar kelime gerekli");
      endpoints.push("/search/");
      raw = await rapidApiGet("youtube", "/search/", { q, gl, hl, type: searchType });
      apiCalls += 1;
    } else {
      endpoints.push("/v2/trending");
      try {
        raw = await rapidApiGet("youtube", "/v2/trending", { geo: gl, hl });
        apiCalls += 1;
      } catch {
        endpoints.push("/search/ (fallback)");
        raw = await rapidApiGet("youtube", "/search/", { q: "trending", gl, hl, type: "video" });
        apiCalls += 1;
      }
    }
  } else if (platform === "instagram") {
    if (type === "user_profile") {
      const username = normalizeUsername(q);
      if (!username) throw new Error("Kullanıcı adı gerekli");
      endpoints.push("/profile");
      raw = await rapidApiGet("instagram", "/profile", { username });
      apiCalls += 1;
      return {
        items: parseInstagramProfile(raw, username),
        apiCalls,
        endpoints,
      };
    }
    if (type === "user_feed" || type === "user_reels" || type === "user_stories" || type === "user_followers") {
      const username = normalizeUsername(q);
      if (!username) throw new Error("Kullanıcı adı gerekli");
      endpoints.push("/profile");
      const profile = await rapidApiGet("instagram", "/profile", { username });
      apiCalls += 1;
      const userId = pickIgUserId(profile);
      if (!userId) throw new Error("Instagram profili bulunamadı");
      if (type === "user_stories") {
        endpoints.push("/stories");
        raw = await rapidApiGet("instagram", "/stories", { user_id: userId });
        apiCalls += 1;
        return {
          items: parseDiscoveryPayload(platform, type, raw, { query: username }),
          apiCalls,
          endpoints,
        };
      }
      if (type === "user_followers") {
        endpoints.push("/followers");
        raw = await rapidApiGet("instagram", "/followers", { user_id: userId });
        apiCalls += 1;
        return {
          items: parseDiscoveryPayload(platform, type, raw),
          apiCalls,
          endpoints,
        };
      }
      const path = type === "user_reels" ? "/reels" : "/feed";
      endpoints.push(path);
      raw = await rapidApiGet("instagram", path, { user_id: userId });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type === "user_reels" ? "user_reels" : "user_feed", raw),
        apiCalls,
        endpoints,
      };
    }
    if (type === "post_lookup") {
      if (!q) throw new Error("Shortcode veya Instagram URL gerekli");
      const shortcode = q.includes("instagram.com")
        ? (q.match(/\/(?:p|reel)\/([^/?#]+)/)?.[1] ?? q)
        : q.replace(/^@/, "");
      endpoints.push("/post");
      raw = await rapidApiGet("instagram", "/post", { shortcode });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw),
        apiCalls,
        endpoints,
      };
    }
    if (type === "resolve_share") {
      if (!q) throw new Error("Paylaşım linki gerekli");
      endpoints.push("/resolve_share");
      raw = await rapidApiGet("instagram", "/resolve_share", { url: q });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw),
        apiCalls,
        endpoints,
      };
    }
    if (type === "user_search") {
      if (!q) throw new Error("Kullanıcı araması için sorgu gerekli");
      endpoints.push("/users_search");
      raw = await rapidApiGet("instagram", "/users_search", { query: q });
      apiCalls += 1;
    } else if (type === "hashtag_discover") {
      if (!q) throw new Error("Hashtag araması için etiket gerekli");
      endpoints.push("/hashtag_search");
      raw = await rapidApiGet("instagram", "/hashtag_search", { hashtag: q });
      apiCalls += 1;
    } else {
      if (!q) throw new Error("Hashtag gönderileri için etiket gerekli");
      endpoints.push("/hashtag_section");
      raw = await rapidApiGet("instagram", "/hashtag_section", { tag: q, section: igSection });
      apiCalls += 1;
    }
  } else {
    const region = ttRegionFromCountry(ttRegion ?? gl);
    if (type === "user_profile") {
      const username = normalizeUsername(q);
      if (!username) throw new Error("Kullanıcı adı gerekli");
      endpoints.push("/user/info");
      raw = await rapidApiGet("tiktok", "/user/info", { unique_id: `@${username}` });
      apiCalls += 1;
      return {
        items: parseTikTokProfile(raw, username),
        apiCalls,
        endpoints,
      };
    }
    if (type === "user_posts") {
      const username = normalizeUsername(q);
      if (!username) throw new Error("Kullanıcı adı gerekli");
      endpoints.push("/user/posts");
      raw = await rapidApiGet("tiktok", "/user/posts", {
        unique_id: `@${username}`,
        count,
      });
      apiCalls += 1;
    } else if (type === "video_lookup") {
      if (!q) throw new Error("TikTok video URL gerekli");
      endpoints.push("/");
      raw = await rapidApiGet("tiktok", "/", { url: q, hd: "1" });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw),
        apiCalls,
        endpoints,
      };
    } else if (type === "music_detail") {
      if (!q) throw new Error("Müzik URL veya adı gerekli");
      endpoints.push("/music/info");
      raw = await rapidApiGet("tiktok", "/music/info", { url: q.includes("http") ? q : `https://www.tiktok.com/music/${q}` });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw),
        apiCalls,
        endpoints,
      };
    } else if (type === "challenge_info") {
      if (!q) throw new Error("Challenge adı gerekli");
      endpoints.push("/challenge/info");
      raw = await rapidApiGet("tiktok", "/challenge/info", { challenge_name: q });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw, { query: q }),
        apiCalls,
        endpoints,
      };
    } else if (type === "user_followers") {
      const username = normalizeUsername(q);
      if (!username) throw new Error("Kullanıcı adı gerekli");
      endpoints.push("/user/followers");
      raw = await rapidApiGet("tiktok", "/user/followers", {
        unique_id: `@${username}`,
        count,
      });
      apiCalls += 1;
      return {
        items: parseDiscoveryPayload(platform, type, raw),
        apiCalls,
        endpoints,
      };
    } else if (type === "trending") {
      endpoints.push("/feed/list");
      raw = await rapidApiGet("tiktok", "/feed/list", { region, count });
      apiCalls += 1;
    } else if (type === "search") {
      if (!q) throw new Error("Video araması için anahtar kelime gerekli");
      endpoints.push("/feed/search");
      raw = await rapidApiGet("tiktok", "/feed/search", {
        keywords: q,
        count,
        region,
        sort_type: ttSortType,
        publish_time: ttPublishTime,
      });
      apiCalls += 1;
    } else if (type === "user_search") {
      if (!q) throw new Error("Kullanıcı araması için sorgu gerekli");
      endpoints.push("/user/search");
      raw = await rapidApiGet("tiktok", "/user/search", {
        keywords: q,
        count,
        follower_count: ttFollowerCount,
        profile_type: ttProfileType,
        other_pref: ttOtherPref,
      });
      apiCalls += 1;
    } else if (type === "hashtag_discover") {
      if (!q) throw new Error("Challenge araması için anahtar kelime gerekli");
      endpoints.push("/challenge/search");
      raw = await rapidApiGet("tiktok", "/challenge/search", { keywords: q, count });
      apiCalls += 1;
    } else {
      if (!q) throw new Error("Challenge videoları için hashtag gerekli");
      endpoints.push("/challenge/info");
      const info = await rapidApiGet("tiktok", "/challenge/info", { challenge_name: q });
      apiCalls += 1;
      const challengeId =
        pickFirstString((info as { data?: Record<string, unknown> }).data, ["id", "cid", "challenge_id"]) ??
        pickFirstString(info as Record<string, unknown>, ["id", "cid", "challenge_id"]);
      if (!challengeId) throw new Error("Challenge bulunamadı");
      endpoints.push("/challenge/posts");
      raw = await rapidApiGet("tiktok", "/challenge/posts", { challenge_id: challengeId, count });
      apiCalls += 1;
    }
  }

  const effectiveType =
    platform === "tiktok" && type === "hashtag" ? "challenge_videos" : type;

  return {
    items: parseDiscoveryPayload(platform, effectiveType, raw, {
      searchType,
      query: q,
    }),
    apiCalls,
    endpoints,
  };
}
