export type MediaPlatform = "youtube" | "instagram" | "tiktok";

export interface MediaRef {
  platform: MediaPlatform;
  /** YouTube video id, Instagram shortcode veya TikTok video id. Kısa TikTok linkinde kod. */
  id: string;
  /** vt.tiktok.com / vm.tiktok.com kısa link — id sunucuda çözülür. */
  shortLink: boolean;
  portrait: boolean;
}

function safeUrl(raw: string): URL | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  try {
    return new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
}

/** Tekil video / reel / gönderi linki. Profil ve kanal linkleri null döner. */
export function parseMediaRef(raw: string): MediaRef | null {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname;

  if (host === "youtu.be") {
    const id = path.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? { platform: "youtube", id, shortLink: false, portrait: false } : null;
  }
  if (host.endsWith("youtube.com")) {
    const shorts = path.match(/^\/shorts\/([\w-]{11})/);
    if (shorts) return { platform: "youtube", id: shorts[1], shortLink: false, portrait: true };
    const embed = path.match(/^\/(?:embed|live)\/([\w-]{11})/);
    if (embed) return { platform: "youtube", id: embed[1], shortLink: false, portrait: false };
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return { platform: "youtube", id: v, shortLink: false, portrait: false };
    return null;
  }
  if (host.endsWith("instagram.com")) {
    const m = path.match(/^\/(?:[A-Za-z0-9._]+\/)?(reel|reels|p|tv)\/([^/?#]+)/i);
    if (!m) return null;
    const kind = m[1].toLowerCase();
    return { platform: "instagram", id: m[2], shortLink: false, portrait: kind !== "p" };
  }
  if (host === "vt.tiktok.com" || host === "vm.tiktok.com") {
    const code = path.split("/").filter(Boolean)[0];
    return code ? { platform: "tiktok", id: code, shortLink: true, portrait: true } : null;
  }
  if (host.endsWith("tiktok.com")) {
    const v = path.match(/\/video\/(\d+)/);
    if (v) return { platform: "tiktok", id: v[1], shortLink: false, portrait: true };
    const t = path.match(/^\/t\/([A-Za-z0-9]+)/);
    if (t) return { platform: "tiktok", id: t[1], shortLink: true, portrait: true };
    return null;
  }
  return null;
}

export function mediaKeyFromUrl(raw: string): string {
  const ref = parseMediaRef(raw);
  if (ref) return `${ref.platform}:${ref.shortLink ? "s:" : ""}${ref.id.toLowerCase()}`;
  return raw.split("?")[0].replace(/\/+$/, "").toLowerCase();
}

export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Sitede oynatılabilir gömme adresi. Kısa TikTok linkinde id bilinmediği için null. */
export function mediaEmbedUrl(ref: MediaRef, resolvedTikTokId?: string): string | null {
  if (ref.platform === "youtube") return `https://www.youtube.com/embed/${ref.id}?autoplay=1&rel=0`;
  if (ref.platform === "instagram") return `https://www.instagram.com/reel/${ref.id}/embed/`;
  const id = ref.shortLink ? resolvedTikTokId : ref.id;
  return id && /^\d+$/.test(id) ? `https://www.tiktok.com/embed/v2/${id}` : null;
}
