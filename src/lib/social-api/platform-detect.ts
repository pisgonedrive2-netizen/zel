import type { SocialPlatform } from "./config";

export interface DetectedPlatform {
  platform: SocialPlatform;
  /** External ID — YouTube videoId/handle, IG shortcode/username, TT video id/username. */
  externalRef: string;
  /** "video" | "channel" | "user" — refresh runner hangi API endpoint'i kullanacağına buna göre karar verir. */
  kind: "video" | "channel" | "user";
  /** Tespitte kullanılan / kaynak URL (TikTok video API'si tam URL ister). */
  sourceUrl?: string;
}

function normalizeHandle(handle?: string): string {
  return (handle ?? "").trim().replace(/^@/, "");
}

function slugFromManual(manualPlatform?: string): SocialPlatform | null {
  const m = (manualPlatform ?? "").toLowerCase();
  if (m.includes("youtube")) return "youtube";
  if (m.includes("instagram")) return "instagram";
  if (m.includes("tiktok")) return "tiktok";
  return null;
}

/** Instagram path segment'leri — bunlar kullanıcı adı değildir. */
const IG_RESERVED_SEGMENTS = new Set([
  "explore",
  "accounts",
  "direct",
  "stories",
  "about",
  "legal",
  "privacy",
  "terms",
  "directory",
  "developer",
  "oauth",
  "session",
  "p",
  "reel",
  "reels",
  "tv",
  "share",
  "channel",
  "tags",
  "locations",
  "nametag",
]);

function isInstagramHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.endsWith("instagram.com") || h === "instagr.am";
}

function isValidIgUsername(segment: string): boolean {
  return /^[A-Za-z0-9._]{1,30}$/.test(segment);
}

/**
 * instagram.com path → platform tespiti.
 * Profil alt yolları (/user/reels/, /user/tagged/) ve gömülü reel (/user/reel/CODE) desteklenir.
 */
function detectInstagramFromPath(
  path: string,
  effectiveUrl: string,
  manualPlatform?: string,
  handle?: string,
  externalRef?: string
): DetectedPlatform | null {
  const clean = path.replace(/\/+$/, "") || "/";

  // Gönderi / reel — kök veya profil altında
  const rootMedia = clean.match(/^\/(p|reel|reels|tv)\/([^/?#]+)/i);
  if (rootMedia) {
    return {
      platform: "instagram",
      externalRef: rootMedia[2],
      kind: "video",
      sourceUrl: effectiveUrl,
    };
  }
  const nestedMedia = clean.match(/^\/[A-Za-z0-9._]+\/(p|reel|reels|tv)\/([^/?#]+)/i);
  if (nestedMedia) {
    return {
      platform: "instagram",
      externalRef: nestedMedia[2],
      kind: "video",
      sourceUrl: effectiveUrl,
    };
  }

  // Paylaşım linki — shortcode olarak dene (/post API)
  const shareMatch = clean.match(/^\/share\/([^/?#]+)/i);
  if (shareMatch) {
    return {
      platform: "instagram",
      externalRef: shareMatch[1],
      kind: "video",
      sourceUrl: effectiveUrl,
    };
  }

  const segments = clean.split("/").filter(Boolean);
  if (segments.length >= 1) {
    const first = segments[0];
    const lower = first.toLowerCase();
    // Profil: tek segment veya /username/reels|tagged|channel|...
    if (!IG_RESERVED_SEGMENTS.has(lower) && isValidIgUsername(first)) {
      const profileSubpaths = new Set(["reels", "tagged", "channel", "guides", "feed"]);
      if (
        segments.length === 1 ||
        (segments.length === 2 && profileSubpaths.has(segments[1].toLowerCase()))
      ) {
        return {
          platform: "instagram",
          externalRef: first,
          kind: "user",
          sourceUrl: effectiveUrl,
        };
      }
    }
  }

  const stored = detectFromStoredRef(manualPlatform, externalRef, effectiveUrl);
  if (stored?.platform === "instagram") return stored;

  const h = normalizeHandle(handle);
  if (h && slugFromManual(manualPlatform) === "instagram") {
    return {
      platform: "instagram",
      externalRef: h,
      kind: "user",
      sourceUrl: buildUrlFromHandle(manualPlatform, handle) || effectiveUrl,
    };
  }

  return null;
}

/** Boş veya placeholder URL (örn. https://tiktok.com/@). */
export function isPlaceholderUrl(url: string, manualPlatform?: string): boolean {
  const raw = url.trim();
  if (!raw) return true;
  let u: URL;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return true;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const m = (manualPlatform ?? "").toLowerCase();

  if (m.includes("instagram") && host.endsWith("instagram.com") && (path === "/" || path === "")) {
    return true;
  }
  if (m.includes("tiktok") && host.endsWith("tiktok.com") && (path === "/" || path === "/@" || path === "/@/")) {
    return true;
  }
  if (m.includes("youtube") && (host.endsWith("youtube.com") || host === "youtu.be")) {
    if (path === "/" || path === "/@" || path === "/watch") return true;
  }
  return false;
}

/** Handle'dan tam profil / kanal URL'si üretir. */
export function buildUrlFromHandle(manualPlatform?: string, handle?: string): string {
  const user = normalizeHandle(handle);
  if (!user) return "";
  const m = (manualPlatform ?? "").toLowerCase();
  if (m.includes("tiktok")) return `https://www.tiktok.com/@${user}`;
  if (m.includes("instagram")) return `https://www.instagram.com/${user}/`;
  if (m.includes("youtube")) return `https://www.youtube.com/@${user}`;
  return "";
}

function inferKind(
  platform: SocialPlatform,
  externalRef: string,
  sourceUrl?: string
): DetectedPlatform["kind"] {
  const ref = externalRef.trim();
  const url = sourceUrl ?? "";

  if (platform === "youtube") {
    if (ref.startsWith("@") || ref.startsWith("UC") || ref.startsWith("HC")) return "channel";
    if (/^[\w-]{11}$/.test(ref)) return "video";
    return "channel";
  }
  if (platform === "instagram") {
    if (/\/(p|reel|reels|tv)\//i.test(url)) return "video";
    return "user";
  }
  if (platform === "tiktok") {
    if (/\/video\/\d+/i.test(url) || /^\d{10,}$/.test(ref)) return "video";
    return "user";
  }
  return "user";
}

/** Kayıtlı external_ref + platform ile URL olmadan da tespit (mevcut linkleri korur). */
function detectFromStoredRef(
  manualPlatform: string | undefined,
  externalRef: string | undefined,
  sourceUrl?: string
): DetectedPlatform | null {
  const platform = slugFromManual(manualPlatform);
  const ref = (externalRef ?? "").trim();
  if (!platform || !ref) return null;
  return {
    platform,
    externalRef: ref,
    kind: inferKind(platform, ref, sourceUrl),
    sourceUrl,
  };
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
  manualPlatform?: string,
  handle?: string,
  externalRef?: string
): DetectedPlatform | null {
  let effectiveUrl = (url ?? "").trim();
  if (!effectiveUrl || isPlaceholderUrl(effectiveUrl, manualPlatform)) {
    const built = buildUrlFromHandle(manualPlatform, handle);
    if (built) effectiveUrl = built;
  }
  if (!effectiveUrl) {
    return detectFromStoredRef(manualPlatform, externalRef);
  }

  let u: URL;
  try {
    effectiveUrl = effectiveUrl.startsWith("http") ? effectiveUrl : `https://${effectiveUrl}`;
    u = new URL(effectiveUrl);
  } catch {
    return detectFromStoredRef(manualPlatform, externalRef, effectiveUrl);
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const manual = (manualPlatform ?? "").toLowerCase();

  // ---- YouTube ----------------------------------------------------------
  if (host.endsWith("youtube.com") || host === "youtu.be" || manual.includes("youtube")) {
    if (host === "youtu.be") {
      const id = path.slice(1).split("/")[0];
      if (id) {
        return { platform: "youtube", externalRef: id, kind: "video", sourceUrl: effectiveUrl };
      }
    }
    if (path === "/watch" || path === "/embed") {
      const v = u.searchParams.get("v") ?? "";
      if (v) {
        return { platform: "youtube", externalRef: v, kind: "video", sourceUrl: effectiveUrl };
      }
    }
    const shortsMatch = path.match(/^\/shorts\/([^/?#]+)/);
    if (shortsMatch) {
      return {
        platform: "youtube",
        externalRef: shortsMatch[1],
        kind: "video",
        sourceUrl: effectiveUrl,
      };
    }
    const channelMatch = path.match(/^\/(channel|c|user)\/([^/?#]+)/);
    if (channelMatch) {
      return {
        platform: "youtube",
        externalRef: channelMatch[2],
        kind: "channel",
        sourceUrl: effectiveUrl,
      };
    }
    const handleMatch = path.match(/^\/@([^/?#]+)/);
    if (handleMatch) {
      return {
        platform: "youtube",
        externalRef: `@${handleMatch[1]}`,
        kind: "channel",
        sourceUrl: effectiveUrl,
      };
    }
    const stored = detectFromStoredRef(manualPlatform, externalRef, effectiveUrl);
    if (stored?.platform === "youtube") return stored;
    return null;
  }

  // ---- Instagram --------------------------------------------------------
  if (isInstagramHost(host) || manual.includes("instagram")) {
    return detectInstagramFromPath(path, effectiveUrl, manualPlatform, handle, externalRef);
  }

  // ---- TikTok -----------------------------------------------------------
  if (host.endsWith("tiktok.com") || host === "vm.tiktok.com" || host === "vt.tiktok.com" || manual.includes("tiktok")) {
    const videoMatch = path.match(/^\/@([^/]+)\/video\/(\d+)/);
    if (videoMatch) {
      return {
        platform: "tiktok",
        externalRef: videoMatch[2],
        kind: "video",
        sourceUrl: effectiveUrl,
      };
    }
    const altMatch = path.match(/\/(v|share\/video)\/(\d+)/);
    if (altMatch) {
      return {
        platform: "tiktok",
        externalRef: altMatch[2],
        kind: "video",
        sourceUrl: effectiveUrl,
      };
    }
    const bareVideo = path.match(/^\/video\/(\d+)/);
    if (bareVideo) {
      return {
        platform: "tiktok",
        externalRef: bareVideo[1],
        kind: "video",
        sourceUrl: effectiveUrl,
      };
    }
    const userMatch = path.match(/^\/@([^/?#]+)/);
    if (userMatch) {
      return {
        platform: "tiktok",
        externalRef: userMatch[1],
        kind: "user",
        sourceUrl: effectiveUrl,
      };
    }
    // vm.tiktok.com kısa link — external_ref veya handle ile devam
    const stored = detectFromStoredRef(manualPlatform, externalRef, effectiveUrl);
    if (stored?.platform === "tiktok") return stored;
    const h = normalizeHandle(handle);
    if (h && manual.includes("tiktok")) {
      return {
        platform: "tiktok",
        externalRef: h,
        kind: "user",
        sourceUrl: buildUrlFromHandle(manualPlatform, handle),
      };
    }
    return null;
  }

  // Host tanınmadı ama platform seçilmiş + handle var
  const builtSlug = slugFromManual(manualPlatform);
  const h = normalizeHandle(handle);
  if (builtSlug && h) {
    const built = buildUrlFromHandle(manualPlatform, handle);
    return {
      platform: builtSlug,
      externalRef: h,
      kind: "user",
      sourceUrl: built || effectiveUrl,
    };
  }

  return detectFromStoredRef(manualPlatform, externalRef, effectiveUrl);
}

/**
 * Tek giriş: url + platform + handle + önceki external_ref.
 */
export function resolveLinkDetection(opts: {
  url: string;
  platform?: string;
  handle?: string;
  externalRef?: string;
}): DetectedPlatform | null {
  return detectPlatform(
    opts.url,
    opts.platform,
    opts.handle,
    opts.externalRef
  );
}

/**
 * Tahmini metric kaydı — bir BrandLink için takip edilebilir mi?
 */
export function isAutoTrackable(
  url: string,
  manualPlatform?: string,
  handle?: string,
  externalRef?: string
): boolean {
  return resolveLinkDetection({ url, platform: manualPlatform, handle, externalRef }) != null;
}
