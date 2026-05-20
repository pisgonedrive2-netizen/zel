import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FetchedMetrics } from "./clients";

/** Otomatik/manuel API çekiminden sonra link + günlük snapshot kaydı. */
export async function recordLinkSnapshot(linkId: string, views: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const id = `s-auto-${linkId.slice(0, 8)}-${today.replace(/-/g, "")}`;
  const { error } = await getSupabaseAdmin().from("link_snapshots").upsert(
    {
      id,
      link_id: linkId,
      date: today,
      views,
      notes: "auto",
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

/** brand_links günceller; izlenme varsa link_snapshots oluşturur. */
export async function persistLinkMetricsUpdate(opts: {
  linkId: string;
  metrics: FetchedMetrics;
  externalRef: string;
  previousViews?: number | null;
  checkCount?: number | null;
}): Promise<PersistedLinkMetrics> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    last_checked_at: now,
    check_count: (opts.checkCount ?? 0) + 1,
    last_check_error: null,
    external_ref: opts.externalRef,
  };

  let delta: number | undefined;
  let snapshotId: string | undefined;

  if (opts.metrics.views != null) {
    updates.last_views = opts.metrics.views;
    updates.last_snapshot_date = today;
    const prev = opts.previousViews ?? 0;
    delta = prev === 0 ? undefined : opts.metrics.views - prev;
    snapshotId = await recordLinkSnapshot(opts.linkId, opts.metrics.views);
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
    snapshotDate: opts.metrics.views != null ? today : undefined,
    lastViews: opts.metrics.views ?? undefined,
    lastLikes: opts.metrics.likes,
    lastComments: opts.metrics.comments,
    lastShares: opts.metrics.shares,
    lastCheckedAt: now,
    externalRef: opts.externalRef,
    delta,
  };
}
