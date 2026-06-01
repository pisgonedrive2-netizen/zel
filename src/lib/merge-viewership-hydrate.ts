import { filterBrandLinksWithValidBrands } from "@/lib/brand-links-sync";
import {
  initialBrandLinks,
  initialBrands,
  type Brand,
  type BrandLink,
  type BrandViewership,
  type LinkSnapshot,
} from "@/store/store";

function brandLinkRichness(l: BrandLink): number {
  let s = 0;
  if (l.url?.trim()) s += 4;
  if (l.handle?.trim()) s += 2;
  if (l.ownerId) s += 2;
  if ((l.lastViews ?? 0) > 0) s += 1;
  return s;
}

function mergeBrandLinkPair(a: BrandLink, b: BrandLink): BrandLink {
  const primary = brandLinkRichness(a) >= brandLinkRichness(b) ? a : b;
  const secondary = primary === a ? b : a;
  return {
    ...primary,
    url: primary.url?.trim() ? primary.url : secondary.url,
    handle: primary.handle?.trim() ? primary.handle : secondary.handle,
    ownerId: primary.ownerId ?? secondary.ownerId,
    lastViews: primary.lastViews ?? secondary.lastViews,
    lastSnapshotDate: primary.lastSnapshotDate ?? secondary.lastSnapshotDate,
    lastLikes: primary.lastLikes ?? secondary.lastLikes,
    lastComments: primary.lastComments ?? secondary.lastComments,
    lastShares: primary.lastShares ?? secondary.lastShares,
    externalRef: primary.externalRef ?? secondary.externalRef,
    lastCheckedAt: primary.lastCheckedAt ?? secondary.lastCheckedAt,
    notes: primary.notes || secondary.notes,
    status: primary.status || secondary.status,
    autoTrack: primary.autoTrack ?? secondary.autoTrack,
  };
}

/** Aynı id için daha zengin kaydı korur (boş bootstrap placeholder ezmez). */
export function unionBrandLinks(...lists: BrandLink[][]): BrandLink[] {
  const byId = new Map<string, BrandLink>();
  for (const list of lists) {
    for (const row of list) {
      if (!row?.id) continue;
      const cur = byId.get(row.id);
      byId.set(row.id, cur ? mergeBrandLinkPair(cur, row) : row);
    }
  }
  return Array.from(byId.values());
}

/** Placeholder + kullanıcı linkleri bootstrap/persist ile silinmez. */
export function mergeCanonicalBrandLinks(
  stored: BrandLink[],
  brands: Brand[] = initialBrands
): BrandLink[] {
  const brandIds = new Set(brands.map((b) => b.id));
  const byId = new Map<string, BrandLink>();

  for (const row of stored) {
    if (!row.brandId || !brandIds.has(row.brandId)) continue;
    const cur = byId.get(row.id);
    byId.set(row.id, cur ? mergeBrandLinkPair(cur, row) : row);
  }
  for (const seed of initialBrandLinks) {
    if (!brandIds.has(seed.brandId)) continue;
    const cur = byId.get(seed.id);
    byId.set(seed.id, cur ? mergeBrandLinkPair(cur, seed) : seed);
  }
  for (const row of stored) {
    if (!row.brandId || !brandIds.has(row.brandId)) continue;
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  return filterBrandLinksWithValidBrands(Array.from(byId.values()), brandIds);
}

export function mergeLinkSnapshotsHydrate(
  current: LinkSnapshot[],
  incoming: LinkSnapshot[] | undefined
): LinkSnapshot[] {
  if (!incoming?.length) return current;
  if (!current.length) return incoming;
  const byId = new Map(current.map((s) => [s.id, s]));
  for (const s of incoming) byId.set(s.id, s);
  return Array.from(byId.values());
}

export function mergeBrandViewershipHydrate(
  current: BrandViewership[],
  incoming: BrandViewership[] | undefined
): BrandViewership[] {
  if (!incoming?.length) return current;
  if (!current.length) return incoming;
  const byId = new Map(current.map((v) => [v.id, v]));
  for (const v of incoming) byId.set(v.id, v);
  return Array.from(byId.values());
}
