import type { SocialPlatform } from "./config";

export interface DetectedPlatform {
  platform: SocialPlatform;
  /** External ID — YouTube videoId/handle, IG shortcode/username, TT video id/username. */
  externalRef: string;
  /** "video" | "channel" | "user" — refresh runner hangi API endpoint'i kullanacağına buna göre karar verir. */
  kind: "video" | "channel" | "user";
}

/**
 * URL'den platform + tip tespiti.
 *
 * Manuel `BrandLink.platform` alanı kullanıcı dropdown'undan gelir (Türkçe
 * etiket: "Instagram" | "YouTube" | "TikTok" gibi). Bu helper'da iki bilgiyi
 * birleştirip otomatik refresh için kanonik bir slug + external ref döneriz.
 *
 * Desteklenmeyen tipler (kanal feedi, story, Twitch, vb.) `null` döner —
 * refresh runner bunları atlar.
 */
export function detectPlatform(
  url: string,
  manualPlatform?: string
): DetectedPlatform | null {
  if (!url || typeof url !== "string") return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  const manual = (manualPlatform ?? "").toLowerCase();

  // ---- YouTube ----------------------------------------------------------
  if (host.endsWith("youtube.com") || host === "youtu.be" || manual.includes("youtube")) {
    if (host === "youtu.be") {
      const id = path.slice(1).split("/")[0];
      if (id) return { platform: "youtube", externalRef: id, kind: "video" };
    }
    if (path === "/watch" || path === "/embed") {
      const v = u.searchParams.get("v") ?? "";
      if (v) return { platform: "youtube", externalRef: v, kind: "video" };
    }
    const shortsMatch = path.match(/^\/shorts\/([^/?#]+)/);
    if (shortsMatch) {
      return { platform: "youtube", externalRef: shortsMatch[1], kind: "video" };
    }
    const channelMatch = path.match(/^\/(channel|c|user)\/([^/?#]+)/);
    if (channelMatch) {
      return { platform: "youtube", externalRef: channelMatch[2], kind: "channel" };
    }
    const handleMatch = path.match(/^\/@([^/?#]+)/);
    if (handleMatch) {
      return { platform: "youtube", externalRef: `@${handleMatch[1]}`, kind: "channel" };
    }
    return null;
  }

  // ---- Instagram --------------------------------------------------------
  if (host.endsWith("instagram.com") || manual.includes("instagram")) {
    // /p/{shortcode}, /reel/{shortcode}, /tv/{shortcode}
    const mediaMatch = path.match(/^\/(p|reel|reels|tv)\/([^/?#]+)/);
    if (mediaMatch) {
      return { platform: "instagram", externalRef: mediaMatch[2], kind: "video" };
    }
    // /{username}/
    const userMatch = path.match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (userMatch) {
      return { platform: "instagram", externalRef: userMatch[1], kind: "user" };
    }
    return null;
  }

  // ---- TikTok -----------------------------------------------------------
  if (host.endsWith("tiktok.com") || manual.includes("tiktok")) {
    // /@{username}/video/{id}
    const videoMatch = path.match(/^\/@([^/]+)\/video\/(\d+)/);
    if (videoMatch) {
      return { platform: "tiktok", externalRef: videoMatch[2], kind: "video" };
    }
    // /v/{id}  veya  /share/video/{id}
    const altMatch = path.match(/\/(v|share\/video)\/(\d+)/);
    if (altMatch) {
      return { platform: "tiktok", externalRef: altMatch[2], kind: "video" };
    }
    // /@{username}
    const userMatch = path.match(/^\/@([^/?#]+)/);
    if (userMatch) {
      return { platform: "tiktok", externalRef: userMatch[1], kind: "user" };
    }
    return null;
  }

  return null;
}

/**
 * Tahmini metric kaydı — bir BrandLink için takip edilebilir mi?
 */
export function isAutoTrackable(url: string, manualPlatform?: string): boolean {
  return detectPlatform(url, manualPlatform) != null;
}
