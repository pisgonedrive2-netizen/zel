import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isoToLocalDateOnly, weekStartFromDateIso } from "@/lib/data";
import type { FetchedMetrics } from "./clients";
import { resolveLinkDetection } from "./platform-detect";
import { pickPublishedAtIso } from "./published-at";

export interface BrandLinkAchievementRow {
  id: string;
  brand_id: string;
  platform: string;
  url: string;
  handle: string;
  owner_id: string | null;
  external_ref: string | null;
  last_snapshot_date: string | null;
  last_views?: number | null;
  check_count?: number | null;
  refresh_count_total?: number | null;
  status?: string;
}

function detectContentType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("/stories/") || u.includes("/story/")) return "story";
  if (u.includes("/reel") || u.includes("/shorts/")) return "reels";
  if (u.includes("/p/") || u.includes("/post")) return "post";
  if (u.includes("tiktok.com")) return "reels";
  if (u.includes("youtu") && u.includes("watch")) return "video";
  return "reels";
}

function stableReelId(linkId: string): string {
  return `wr-bl-${linkId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

/**
 * İçerik (reel/post/video) marka linkinden `week_brand_reels` üretir veya günceller.
 * Achievement takvimi + marka linkleri sayfası aynı kaynağı kullanır.
 */
export async function ensureWeekBrandReelFromBrandLink(opts: {
  link: BrandLinkAchievementRow;
  metrics: FetchedMetrics;
  externalRef: string;
  publishedAt?: string | null;
  targetDate?: string;
}): Promise<{ reelId: string; created: boolean } | null> {
  const { link, metrics, externalRef } = opts;
  if (!link.owner_id?.trim()) return null;

  const detected = resolveLinkDetection({
    url: link.url,
    platform: link.platform,
    handle: link.handle,
    externalRef,
  });
  if (!detected || detected.kind !== "video") return null;

  const publishedIso =
    opts.publishedAt?.trim() ||
    metrics.publishedAt?.trim() ||
    pickPublishedAtIso(metrics.raw) ||
    (link.last_snapshot_date
      ? `${link.last_snapshot_date.slice(0, 10)}T12:00:00.000Z`
      : opts.targetDate
        ? `${opts.targetDate}T12:00:00.000Z`
        : undefined);

  const localDate = isoToLocalDateOnly(publishedIso);
  const weekStart = weekStartFromDateIso(localDate);
  if (!localDate || !weekStart) return null;

  const db = getSupabaseAdmin();
  const reelId = stableReelId(link.id);
  const now = new Date().toISOString();

  const { data: byLink } = await db
    .from("week_brand_reels")
    .select("id, published_at")
    .eq("brand_link_id", link.id)
    .maybeSingle();
  const { data: byId } = byLink
    ? { data: byLink }
    : await db
        .from("week_brand_reels")
        .select("id, published_at")
        .eq("id", reelId)
        .maybeSingle();
  const existing = byId;

  const finalId = existing?.id ? String(existing.id) : reelId;
  const row: Record<string, unknown> = {
    id: finalId,
    employee_id: link.owner_id,
    week_start: weekStart,
    brand_id: link.brand_id,
    content_url: link.url.trim(),
    platform: link.platform,
    content_type: detectContentType(link.url),
    brand_link_id: link.id,
    published_at: publishedIso ?? null,
    external_ref: externalRef,
    notes: "Marka linki · API",
    last_views: metrics.views ?? null,
    last_likes: metrics.likes ?? null,
    last_comments: metrics.comments ?? null,
    last_shares: metrics.shares ?? null,
    last_checked_at: now,
    last_check_error: null,
    updated_at: now,
  };

  const { error } = await db.from("week_brand_reels").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`week_brand_reels upsert: ${error.message}`);

  return { reelId: finalId, created: !existing?.id };
}

export async function fetchBrandLinkForAchievement(
  linkId: string
): Promise<BrandLinkAchievementRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_links")
    .select(
      "id, brand_id, platform, url, handle, owner_id, external_ref, last_snapshot_date"
    )
    .eq("id", linkId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BrandLinkAchievementRow;
}
