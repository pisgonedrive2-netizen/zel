/** videoyolla.com — public clip yüzü; veri aynı Foxstream / clip API'ye düşer. */

export const CLIP_PUBLIC_HOSTS = new Set(["videoyolla.com", "www.videoyolla.com"]);

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function isClipPublicHost(host: string | null | undefined): boolean {
  return CLIP_PUBLIC_HOSTS.has(normalizeHost(host));
}

export function clipPublicPaths(host?: string | null): {
  home: string;
  durum: string;
  statusUrl: (key: string) => string;
} {
  const onClip = isClipPublicHost(host);
  if (onClip) {
    return {
      home: "/",
      durum: "/durum",
      statusUrl: (key) => `/durum?k=${encodeURIComponent(key)}`,
    };
  }
  return {
    home: "/video-yolla",
    durum: "/video-yolla/durum",
    statusUrl: (key) => `/video-yolla/durum?k=${encodeURIComponent(key)}`,
  };
}

/** Tarayıcı pathname — clip host'ta / ve /durum da açık sayfa. */
export function isClipOpenPathname(pathname: string, host?: string | null): boolean {
  if (pathname === "/video-yolla" || pathname.startsWith("/video-yolla/")) return true;
  if (!isClipPublicHost(host)) return false;
  return pathname === "/" || pathname === "/durum" || pathname.startsWith("/durum/");
}

const CLIP_COOKIE = "__clip_host";

/** Middleware'in videoyolla.com yanıtında set ettiği çerez. */
export function hasClipHostCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${CLIP_COOKIE}=1`));
}

export function resolveClipHostHint(): string | null {
  if (typeof window !== "undefined" && isClipPublicHost(window.location.hostname)) {
    return window.location.hostname;
  }
  if (hasClipHostCookie()) return "www.videoyolla.com";
  return null;
}
