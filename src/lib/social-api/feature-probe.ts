import { rapidApiGet } from "./clients";
import type { SocialPlatform } from "./config";
import { getPlatformFeature } from "./platform-capabilities";

export interface FeatureProbeResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  message: string;
  preview?: string;
  featureId: string;
  endpoint: string;
}

/** Örnek probe parametreleri — gerçek API çağrısı (1 kota). */
function probeParams(platform: SocialPlatform, featureId: string): Record<string, string> | null {
  switch (platform) {
    case "youtube":
      if (featureId === "video_details" || featureId === "video_details_v2") {
        return featureId === "video_details_v2"
          ? { video_id: "dQw4w9WgXcQ" }
          : { id: "dQw4w9WgXcQ" };
      }
      if (featureId === "channel_details" || featureId === "channel_details_v2") {
        return featureId === "channel_details_v2"
          ? { channel_id: "UC_x5XG1OV2P6uZZ5k3v1Mw" }
          : { id: "UC_x5XG1OV2P6uZZ5k3v1Mw" };
      }
      if (featureId === "channel_videos") {
        return { id: "UC_x5XG1OV2P6uZZ5k3v1Mw", filter: "videos_latest" };
      }
      if (featureId === "video_comments") return { id: "dQw4w9WgXcQ" };
      if (featureId === "video_related") return { id: "dQw4w9WgXcQ" };
      if (featureId === "search") return { query: "foxstream", type: "video" };
      if (featureId === "trending") return { geo: "TR" };
      break;
    case "instagram":
      if (featureId === "profile") return { username: "instagram" };
      if (featureId === "post") return { shortcode: "DLUWkieNc0f" };
      if (featureId === "resolve_share") {
        return { url: "https://www.instagram.com/p/DLUWkieNc0f/" };
      }
      if (featureId === "user_feed" || featureId === "user_reels" || featureId === "user_stories") {
        return { user_id: "25025320" };
      }
      if (featureId === "post_comments") return { id: "3560707543640477806" };
      if (featureId === "media_likers") return { media_id: "3557083637646459808" };
      if (featureId === "hashtag_search") return { query: "reels" };
      if (featureId === "user_followers") return { user_id: "25025320" };
      break;
    case "tiktok":
      if (featureId === "user_info") return { unique_id: "@tiktok" };
      if (featureId === "video_url" || featureId === "video_comments") {
        return {
          url: "https://www.tiktok.com/@tiktok/video/7233463396124052782",
          ...(featureId === "video_url" ? { hd: "1" } : { count: "5" }),
        };
      }
      if (featureId === "user_posts") {
        return { unique_id: "@tiktok", count: "5" };
      }
      if (featureId === "user_followers") {
        return { unique_id: "@tiktok", count: "5" };
      }
      if (featureId === "search_user") return { keywords: "tiktok", count: "5" };
      if (featureId === "trending_videos") return { country_code: "TR", count: "5" };
      if (featureId === "music_detail") return { music_id: "7148334302027676418" };
      if (featureId === "challenge_detail") return { challenge_name: "fyp" };
      break;
  }
  return null;
}

function previewFromResponse(raw: unknown): string {
  if (raw == null) return "Boş yanıt";
  if (Array.isArray(raw)) return `${raw.length} kayıt döndü`;
  if (typeof raw !== "object") return String(raw).slice(0, 80);

  const o = raw as Record<string, unknown>;
  const arrays: Array<{ key: string; len: number }> = [];
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) arrays.push({ key: k, len: v.length });
  }
  if (arrays.length > 0) {
    const top = arrays.sort((a, b) => b.len - a.len)[0];
    return `${top.key}: ${top.len} öğe`;
  }

  const title =
    (typeof o.title === "string" && o.title) ||
    (typeof o.message === "string" && o.message) ||
    (o.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? previewFromResponse(o.data)
      : null);
  if (title && title !== "Boş yanıt") return title.slice(0, 100);

  const keys = Object.keys(o).slice(0, 6).join(", ");
  return keys ? `Alanlar: ${keys}` : "JSON yanıt alındı";
}

export async function probePlatformFeature(
  platform: SocialPlatform,
  featureId: string
): Promise<FeatureProbeResult> {
  const feature = getPlatformFeature(platform, featureId);
  if (!feature) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      message: "Bilinmeyen özellik",
      featureId,
      endpoint: "",
    };
  }

  const params = probeParams(platform, featureId);
  if (!params) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      message: "Probe parametresi tanımlı değil",
      featureId,
      endpoint: feature.endpoint,
    };
  }

  const start = Date.now();
  try {
    const raw = await rapidApiGet(platform, feature.endpoint, params);
    const latencyMs = Date.now() - start;
    return {
      ok: true,
      status: 200,
      latencyMs,
      message: "OK",
      preview: previewFromResponse(raw),
      featureId,
      endpoint: feature.endpoint,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : "?";
    const statusMatch = msg.match(/\[(\w+)\]\s+(\d+):/);
    const status = statusMatch ? Number(statusMatch[2]) : 0;
    return {
      ok: false,
      status,
      latencyMs,
      message: msg.slice(0, 240),
      featureId,
      endpoint: feature.endpoint,
    };
  }
}
