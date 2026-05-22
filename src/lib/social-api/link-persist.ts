import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FetchedMetrics } from "./clients";

/**
 * Snapshot kaydı — `targetDate` belirtilmezse bugünün tarihiyle yazılır.
 * Aynı linkin aynı günkü kaydı varsa engagement metriklerini de günceller.
 */
export async function recordLinkSnapshot(
  linkId: string,
  views: number,
  engagement?: { likes?: number | null; comments?: number | null; shares?: number | null },
  targetDate?: string,
): Promise<string> {
  const date = targetDate ?? new Date().toISOString().slice(0, 10);
  const id = `s-auto-${linkId.slice(0, 8)}-${date.replace(/-/g, "")}`;
  const { error } = await getSupabaseAdmin().from("link_snapshots").upsert(
    {
      id,
      link_id: linkId,
      date,
      views,
      notes: "auto",
      likes: engagement?.likes ?? null,
      comments: engagement?.comments ?? null,
      shares: engagement?.shares ?? null,
      refreshed_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`link_snapshots: ${error.message}`);
  return id;
}

export interface PersistedLinkMetrics {
  linkId: string;
  snapshotId?: string;
  snapshotDate?: string;
  lastViews?: number;
  lastLikes?: number | null;
  lastComments?: number | null;
  lastShares?: number | null;
  lastCheckedAt: string;
  externalRef: string;
  delta?: number;
}

/**
 * brand_links günceller; izlenme varsa engagement ile birlikte link_snapshots oluşturur.
 *
 * `targetDate` parametresi geçmiş ay yenilemesi için verilir (varsayılan: bugün).
 */
export async function persistLinkMetricsUpdate(opts: {
  linkId: string;
  metrics: FetchedMetrics;
  externalRef: string;
  previousViews?: number | null;
  checkCount?: number | null;
  refreshCountTotal?: number | null;
  /** Snapshot için hedef tarih (YYYY-MM-DD). Belirtilmezse bugün. */
  targetDate?: string;
}): Promise<PersistedLinkMetrics> {
  const snapshotDate = opts.targetDate ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    last_checked_at: now,
    check_count: (opts.checkCount ?? 0) + 1,
    last_check_error: null,
    external_ref: opts.externalRef,
    last_refresh_status: "ok",
    refresh_count_total: (opts.refreshCountTotal ?? 0) + 1,
  };

  let delta: number | undefined;
  let snapshotId: string | undefined;

  if (opts.metrics.views != null) {
    updates.last_views = opts.metrics.views;
    updates.last_snapshot_date = snapshotDate;
    const prev = opts.previousViews ?? 0;
    delta = prev === 0 ? undefined : opts.metrics.views - prev;
    snapshotId = await recordLinkSnapshot(
      opts.linkId,
      opts.metrics.views,
      {
        likes: opts.metrics.likes,
        comments: opts.metrics.comments,
        shares: opts.metrics.shares,
      },
      snapshotDate,
    );
  }
  if (opts.metrics.likes != null) updates.last_likes = opts.metrics.likes;
  if (opts.metrics.comments != null) updates.last_comments = opts.metrics.comments;
  if (opts.metrics.shares != null) updates.last_shares = opts.metrics.shares;

  const { error } = await getSupabaseAdmin()
    .from("brand_links")
    .update(updates)
    .eq("id", opts.linkId);
  if (error) throw new Error(`brand_links update: ${error.message}`);

  return {
    linkId: opts.linkId,
    snapshotId,
    snapshotDate: opts.metrics.views != null ? snapshotDate : undefined,
    lastViews: opts.metrics.views ?? undefined,
    lastLikes: opts.metrics.likes,
    lastComments: opts.metrics.comments,
    lastShares: opts.metrics.shares,
    lastCheckedAt: now,
    externalRef: opts.externalRef,
    delta,
  };
}
