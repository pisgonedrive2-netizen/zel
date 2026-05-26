import { resolveLinkDetection } from "@/lib/social-api/platform-detect";
import type { BrandLink } from "@/store/store";

/** Kotasız önizleme — yalnızca bilinen statik URL kalıpları. */
export function inferStaticLinkThumbnail(link: BrandLink): string | null {
  const detected = resolveLinkDetection({
    url: link.url,
    platform: link.platform,
    handle: link.handle,
    externalRef: link.externalRef,
  });
  if (!detected) return null;
  if (detected.platform === "youtube" && detected.kind === "video") {
    return `https://img.youtube.com/vi/${detected.externalRef}/mqdefault.jpg`;
  }
  return null;
}

export function faviconForUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
  } catch {
    return null;
  }
}
