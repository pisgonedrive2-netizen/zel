import type { BrandLink } from "@/store/store";

/** YouTube / Instagram / TikTok — RapidAPI otomatik yenileme kapsamı. */
export function isSupportedApiPlatform(platform: string): boolean {
  const p = (platform ?? "").toLowerCase();
  return (
    p.includes("youtube") ||
    p.includes("instagram") ||
    p.includes("tiktok")
  );
}

export function splitActiveLinksByApiSupport(links: BrandLink[]): {
  apiLinks: BrandLink[];
  otherLinks: BrandLink[];
} {
  const apiLinks: BrandLink[] = [];
  const otherLinks: BrandLink[] = [];
  for (const l of links) {
    if (l.status !== "active") continue;
    if (isSupportedApiPlatform(l.platform)) apiLinks.push(l);
    else otherLinks.push(l);
  }
  return { apiLinks, otherLinks };
}
