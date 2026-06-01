import type { BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";

const CACHE_KEY = "fox-viewership-cache-v1";

export type ViewershipCachePayload = {
  savedAt: string;
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
};

function linkDataScore(links: BrandLink[]): number {
  return links.reduce((s, l) => {
    let n = 0;
    if (l.url?.trim()) n += 4;
    if (l.handle?.trim()) n += 2;
    if (l.ownerId) n += 1;
    if ((l.lastViews ?? 0) > 0) n += 2;
    return s + n;
  }, 0);
}

export function readViewershipCache(): ViewershipCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewershipCachePayload;
    if (!Array.isArray(parsed.brandLinks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeViewershipCache(payload: Omit<ViewershipCachePayload, "savedAt">) {
  if (typeof window === "undefined") return;
  const score = linkDataScore(payload.brandLinks);
  if (score < 4 && payload.linkSnapshots.length === 0) return;
  try {
    const body: ViewershipCachePayload = { ...payload, savedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(body));
  } catch {
    /* quota */
  }
}

/** Sunucu/bootstrap boş veya zayıfsa son iyi yerel kopyayı kullan. */
export function preferRicherViewership(
  fromServer: Omit<ViewershipCachePayload, "savedAt">,
  fromCache: ViewershipCachePayload | null
): Omit<ViewershipCachePayload, "savedAt"> {
  if (!fromCache) return fromServer;
  const serverScore =
    linkDataScore(fromServer.brandLinks) + fromServer.linkSnapshots.length * 2;
  const cacheScore =
    linkDataScore(fromCache.brandLinks) + fromCache.linkSnapshots.length * 2;
  if (cacheScore > serverScore) {
    return {
      brandLinks: fromCache.brandLinks,
      linkSnapshots: fromCache.linkSnapshots,
      brandViewership: fromCache.brandViewership,
    };
  }
  return fromServer;
}
