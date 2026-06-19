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

/** Silinmiş markalara ait link / snapshot / viewership kayıtlarını ayıklar. */
export function filterViewershipByBrandIds(
  payload: Omit<ViewershipCachePayload, "savedAt">,
  validBrandIds: Set<string>
): Omit<ViewershipCachePayload, "savedAt"> {
  if (validBrandIds.size === 0) {
    return { brandLinks: [], linkSnapshots: [], brandViewership: [] };
  }
  const brandLinks = payload.brandLinks.filter(
    (l) => l.brandId && validBrandIds.has(l.brandId)
  );
  const linkIds = new Set(brandLinks.map((l) => l.id));
  return {
    brandLinks,
    linkSnapshots: payload.linkSnapshots.filter((s) => linkIds.has(s.linkId)),
    brandViewership: payload.brandViewership.filter(
      (v) => v.brandId && validBrandIds.has(v.brandId)
    ),
  };
}

export function purgeViewershipCacheForBrands(removedBrandIds: string[]): void {
  if (typeof window === "undefined" || removedBrandIds.length === 0) return;
  const cache = readViewershipCache();
  if (!cache) return;
  const remove = new Set(removedBrandIds);
  const keepIds = new Set(
    cache.brandLinks
      .map((l) => l.brandId)
      .filter((id): id is string => Boolean(id) && !remove.has(id))
  );
  const filtered = filterViewershipByBrandIds(cache, keepIds);
  if (filtered.brandLinks.length === 0 && filtered.linkSnapshots.length === 0) {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  writeViewershipCache(filtered);
}

/** Sunucu/bootstrap boş veya zayıfsa son iyi yerel kopyayı kullan. */
export function preferRicherViewership(
  fromServer: Omit<ViewershipCachePayload, "savedAt">,
  fromCache: ViewershipCachePayload | null,
  validBrandIds?: Set<string>
): Omit<ViewershipCachePayload, "savedAt"> {
  const filter = (p: Omit<ViewershipCachePayload, "savedAt">) =>
    validBrandIds ? filterViewershipByBrandIds(p, validBrandIds) : p;

  const server = filter(fromServer);
  if (!fromCache) return server;

  const cache = filter({
    brandLinks: fromCache.brandLinks,
    linkSnapshots: fromCache.linkSnapshots,
    brandViewership: fromCache.brandViewership,
  });

  const serverScore = linkDataScore(server.brandLinks) + server.linkSnapshots.length * 2;
  const cacheScore = linkDataScore(cache.brandLinks) + cache.linkSnapshots.length * 2;
  if (cacheScore > serverScore) return cache;
  return server;
}
