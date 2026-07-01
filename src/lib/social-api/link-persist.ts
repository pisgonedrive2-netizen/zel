import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FetchedMetrics } from "./clients";
import { snapshotIdForLinkDate } from "@/lib/link-tracking-mode";
import {
  ensureWeekBrandReelFromBrandLink,
  fetchBrandLinkForAchievement,
} from "./link-achievement-sync";

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
  const id = snapshotIdForLinkDate(linkId, date);
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

/**
 * `brand_link_id` bu linke işaret eden haftalık reel/gönderi kayıtlarını,
 * linkin son metrikleriyle günceller. Açelya gibi haftalık panodan eklenen
 * içeriklerin izlenmeleri marka linki yenilendiğinde otomatik yansır.
 */
async function syncLinkedWeekReels(
  linkId: string,
  metrics: FetchedMetrics,
  externalRef: string,
  now: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_checked_at: now,
    last_check_error: null,
    external_ref: externalRef,
  };
  if (metrics.views != null) patch.last_views = metrics.views;
  if (metrics.likes != null) patch.last_likes = metrics.likes;
  if (metrics.comments != null) patch.last_comments = metrics.comments;
  if (metrics.shares != null) patch.last_shares = metrics.shares;
  await getSupabaseAdmin().from("week_brand_reels").update(patch).eq("brand_link_id", linkId);
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
  /** API'den gelen yayın tarihi (achievement günü). */
  publishedAt?: string | null;
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

  // Bu linke bağlı haftalık reel/gönderi kayıtlarını da senkronla (varsa).
  // Best-effort: hata olsa bile link refresh'i başarılı sayılır.
  await syncLinkedWeekReels(opts.linkId, opts.metrics, opts.externalRef, now).catch(
    () => undefined
  );

  const linkRow = await fetchBrandLinkForAchievement(opts.linkId).catch(() => null);
  if (linkRow) {
    await ensureWeekBrandReelFromBrandLink({
      link: linkRow,
      metrics: opts.metrics,
      externalRef: opts.externalRef,
      publishedAt: opts.publishedAt ?? opts.metrics.publishedAt,
      targetDate: opts.targetDate,
    }).catch(() => undefined);
  }

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
