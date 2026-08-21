import { resolveLinkDetection } from "./platform-detect";
import type { SocialPlatform } from "./config";

const MAX_BYTES = 48 * 1024 * 1024;

const VIDEO_URL_KEYS = [
  "hdplay",
  "play",
  "nwm_video_url",
  "nwm_video_url_HQ",
  "playAddr",
  "downloadAddr",
  "video_url",
  "videoUrl",
  "download_url",
  "downloadUrl",
  "wmplay",
];

function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v.trim());
}

function looksLikeVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes("mime=video") || u.includes("video/mp4") || u.includes(".mp4")) return true;
  if (u.includes("googlevideo.com")) return true;
  if (u.includes("tiktokcdn") || u.includes("muscdn") || u.includes("byteicdn")) return true;
  if (u.includes("cdninstagram") || u.includes("fbcdn.net")) return true;
  return false;
}

/** RapidAPI ham cevabından doğrudan mp4/HTTP video URL'si. */
export function extractDirectVideoUrl(raw: unknown, depth = 0): string | null {
  if (raw == null || depth > 8) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (isHttpUrl(s) && looksLikeVideoUrl(s)) return s;
    return null;
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const found = extractDirectVideoUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  for (const key of VIDEO_URL_KEYS) {
    const v = o[key];
    if (typeof v === "string" && isHttpUrl(v)) return v.trim();
  }

  const formats = o.formats;
  if (Array.isArray(formats)) {
    const picked = pickYoutubeProgressiveMp4(formats);
    if (picked) return picked;
  }

  for (const v of Object.values(o)) {
    const found = extractDirectVideoUrl(v, depth + 1);
    if (found) return found;
  }
  return null;
}

type YtFormat = {
  itag?: number;
  mimeType?: string;
  url?: string;
  contentLength?: string | number;
  audioQuality?: string;
  qualityLabel?: string;
};

function formatSize(f: YtFormat): number {
  const n = Number(f.contentLength);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export function pickYoutubeProgressiveMp4(formats: unknown[]): string | null {
  const list = formats.filter((x): x is YtFormat => {
    if (!x || typeof x !== "object") return false;
    const f = x as YtFormat;
    return typeof f.url === "string" && isHttpUrl(f.url);
  });
  if (list.length === 0) return null;

  const itag18 = list.find((f) => f.itag === 18);
  if (itag18?.url && formatSize(itag18) <= MAX_BYTES) return itag18.url;

  const progressive = list
    .filter((f) => {
      const mime = (f.mimeType ?? "").toLowerCase();
      if (!mime.includes("video/mp4")) return false;
      if (mime.includes("audio=") || f.audioQuality) return true;
      // Progressive mp4 typically has both codecs in mimeType.
      return /avc1|mp4a/.test(mime) && mime.includes("mp4a");
    })
    .filter((f) => formatSize(f) <= MAX_BYTES)
    .sort((a, b) => formatSize(a) - formatSize(b));

  return progressive[0]?.url ?? list.find((f) => formatSize(f) <= MAX_BYTES)?.url ?? null;
}

export function platformFromContentUrl(url: string, hint?: string): SocialPlatform | null {
  const d = resolveLinkDetection({ url, platform: hint });
  return d?.platform ?? null;
}

export { MAX_BYTES as TELEGRAM_VIDEO_MAX_BYTES };
