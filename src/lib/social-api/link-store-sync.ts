import type { BrandLink, LinkSnapshot } from "@/store/store";

/** API / bulk refresh sonrası store'a güvenli patch — tanımsız alanlar mevcut değeri silmez. */
export type LinkMetricsStoreUpdate = {
  lastViews?: number;
  lastLikes?: number | null;
  lastComments?: number | null;
  lastShares?: number | null;
  lastSnapshotDate?: string;
  lastCheckedAt?: string;
  externalRef?: string;
  lastCheckError?: string | null;
  lastRefreshStatus?: BrandLink["lastRefreshStatus"];
  refreshCountTotal?: number;
  snapshot?: LinkSnapshot;
};

export function buildBrandLinkPatch(
  update: LinkMetricsStoreUpdate | undefined
): Partial<BrandLink> {
  if (!update) return {};
  const patch: Partial<BrandLink> = {};
  if (update.lastViews !== undefined) patch.lastViews = update.lastViews;
  if (update.lastLikes !== undefined) patch.lastLikes = update.lastLikes ?? undefined;
  if (update.lastComments !== undefined) patch.lastComments = update.lastComments ?? undefined;
  if (update.lastShares !== undefined) patch.lastShares = update.lastShares ?? undefined;
  if (update.lastSnapshotDate !== undefined) patch.lastSnapshotDate = update.lastSnapshotDate;
  if (update.lastCheckedAt !== undefined) patch.lastCheckedAt = update.lastCheckedAt;
  if (update.externalRef !== undefined) patch.externalRef = update.externalRef;
  if (update.lastCheckError !== undefined) {
    patch.lastCheckError = update.lastCheckError ?? undefined;
  }
  if (update.lastRefreshStatus !== undefined) patch.lastRefreshStatus = update.lastRefreshStatus;
  if (update.refreshCountTotal !== undefined) patch.refreshCountTotal = update.refreshCountTotal;
  return patch;
}

export function linkUpdateFromPersisted(
  linkId: string,
  persisted: {
    lastViews?: number;
    lastLikes?: number | null;
    lastComments?: number | null;
    lastShares?: number | null;
    snapshotDate?: string;
    lastCheckedAt: string;
    externalRef: string;
    snapshotId?: string;
  }
): LinkMetricsStoreUpdate {
  return {
    lastViews: persisted.lastViews,
    lastLikes: persisted.lastLikes,
    lastComments: persisted.lastComments,
    lastShares: persisted.lastShares,
    lastSnapshotDate: persisted.snapshotDate,
    lastCheckedAt: persisted.lastCheckedAt,
    externalRef: persisted.externalRef,
    lastCheckError: null,
    lastRefreshStatus: "ok",
    snapshot:
      persisted.snapshotId && persisted.snapshotDate && persisted.lastViews != null
        ? {
            id: persisted.snapshotId,
            linkId,
            date: persisted.snapshotDate,
            views: persisted.lastViews,
            notes: "auto",
            likes: persisted.lastLikes ?? undefined,
            comments: persisted.lastComments ?? undefined,
            shares: persisted.lastShares ?? undefined,
            refreshedAt: persisted.lastCheckedAt,
          }
        : undefined,
  };
}

export function applyLinkMetricsToStore(
  linkId: string,
  update: LinkMetricsStoreUpdate | undefined,
  actions: {
    updateBrandLink: (id: string, patch: Partial<BrandLink>) => void;
    upsertLinkSnapshot: (s: LinkSnapshot) => void;
  }
) {
  const patch = buildBrandLinkPatch(update);
  if (Object.keys(patch).length > 0) {
    actions.updateBrandLink(linkId, patch);
  }
  if (update?.snapshot) {
    actions.upsertLinkSnapshot(update.snapshot);
  }
}
