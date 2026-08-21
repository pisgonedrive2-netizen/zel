import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { weekStartFromDateIso } from "@/lib/data";
import { isRapidApiEnabled } from "@/lib/env";
import { findDuplicateBrandLink } from "@/lib/brand-link-url";
import { brandLinkFromRow, brandLinkToRow } from "@/lib/db/mappers";
import { snapshotIdForLinkDate } from "@/lib/link-tracking-mode";
import { resolveLinkDetection } from "./platform-detect";
import { refreshSingleLink } from "./refresh-runner";
import type { BrandLink, LinkSnapshot } from "@/store/store";
import {
  displayPlatformFromUrl,
  handleFromContentUrl,
  parseBrandPostId,
  type AchievementAssignItem,
} from "./assign-achievement-brand-helpers";

export type { AchievementAssignItem };
export { displayPlatformFromUrl, handleFromContentUrl, parseBrandPostId };

export type AchievementAssignResult = {
  assigned: number;
  created: number;
  reused: number;
  refreshed: number;
  links: BrandLink[];
  snapshots: LinkSnapshot[];
  reelPatches: { id: string; brandId: string; brandLinkId: string; views?: number | null }[];
  errors: string[];
};

const IMMEDIATE_REFRESH_CAP = 6;

/**
 * Achievement günündeki paylaşımları marka izlenme (`brand_links`) kaydına bağlar.
 * Snapshot tarihi paylaşım günüdür; cron/RapidAPI izlenmeyi sürdürür.
 */
export async function assignAchievementItemsToBrand(opts: {
  employeeId: string;
  brandId: string;
  date: string;
  items: AchievementAssignItem[];
}): Promise<AchievementAssignResult> {
  const employeeId = opts.employeeId.trim();
  const brandId = opts.brandId.trim();
  const date = opts.date.trim();
  const result: AchievementAssignResult = {
    assigned: 0,
    created: 0,
    reused: 0,
    refreshed: 0,
    links: [],
    snapshots: [],
    reelPatches: [],
    errors: [],
  };

  if (!employeeId || !brandId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    result.errors.push("employeeId, brandId ve date (YYYY-MM-DD) gerekli");
    return result;
  }

  const items = opts.items.filter((it) => it.id && it.url?.trim());
  if (items.length === 0) {
    result.errors.push("Atanacak içerik yok");
    return result;
  }

  const db = getSupabaseAdmin();
  const { data: brandRow, error: brandErr } = await db
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .maybeSingle();
  if (brandErr) throw new Error(brandErr.message);
  if (!brandRow) {
    result.errors.push("Marka bulunamadı");
    return result;
  }

  const { data: existingLinkRows, error: linkErr } = await db
    .from("brand_links")
    .select("*")
    .eq("owner_id", employeeId)
    .eq("brand_id", brandId);
  if (linkErr) throw new Error(linkErr.message);

  const existingLinks = (existingLinkRows ?? []).map((r) =>
    brandLinkFromRow(r as Record<string, unknown>)
  );

  const reelIds = items.map((it) => it.id).filter((id) => !id.startsWith("post-"));
  const postIds = items
    .map((it) => parseBrandPostId(it.id))
    .filter((id): id is string => Boolean(id));

  const reelById = new Map<string, Record<string, unknown>>();
  if (reelIds.length > 0) {
    const { data: reels, error } = await db
      .from("week_brand_reels")
      .select(
        "id, employee_id, content_url, platform, last_views, last_likes, last_comments, last_shares, external_ref, published_at, brand_id, brand_link_id"
      )
      .eq("employee_id", employeeId)
      .in("id", reelIds);
    if (error) throw new Error(error.message);
    for (const row of reels ?? []) {
      reelById.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }

  const postById = new Map<string, Record<string, unknown>>();
  if (postIds.length > 0) {
    const { data: posts, error } = await db
      .from("brand_posts")
      .select("id, employee_id, url, platform, views, brand_id")
      .eq("employee_id", employeeId)
      .in("id", postIds);
    if (error) throw new Error(error.message);
    for (const row of posts ?? []) {
      postById.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }

  const now = new Date().toISOString();
  const weekStart = weekStartFromDateIso(date) || date;
  const linksForDup = [...existingLinks];
  const refreshIds: string[] = [];

  for (const item of items) {
    try {
      const url = item.url.trim();
      const postId = parseBrandPostId(item.id);
      const reel = reelById.get(item.id);
      const post = postId ? postById.get(postId) : undefined;
      const platform = displayPlatformFromUrl(
        url,
        item.platform ||
          (reel?.platform ? String(reel.platform) : undefined) ||
          (post?.platform ? String(post.platform) : undefined)
      );
      const viewsRaw = reel?.last_views ?? post?.views;
      const views =
        viewsRaw != null && Number.isFinite(Number(viewsRaw)) ? Number(viewsRaw) : null;
      const detected = resolveLinkDetection({ url, platform });

      let link = findDuplicateBrandLink(linksForDup, url, undefined, {
        brandId,
        ownerId: employeeId,
      });

      if (!link) {
        const id = `bl-ach-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        link = {
          id,
          brandId,
          platform,
          handle: handleFromContentUrl(url),
          url,
          ownerId: employeeId,
          status: "active",
          notes: "Achievement takviminden atandı",
          autoTrack: true,
          lastSnapshotDate: date,
          lastViews: views ?? undefined,
          externalRef: detected?.externalRef,
          createdAt: now,
        };
        const { error: insErr } = await db.from("brand_links").insert({
          ...brandLinkToRow(link),
          external_ref: detected?.externalRef ?? null,
        });
        if (insErr) throw new Error(insErr.message);
        linksForDup.push(link);
        result.created += 1;
      } else {
        result.reused += 1;
        const patch: Record<string, unknown> = {
          status: "active",
          auto_track: true,
        };
        if (!link.ownerId) patch.owner_id = employeeId;
        if (views != null && (link.lastViews == null || link.lastViews < views)) {
          patch.last_views = views;
          link = { ...link, lastViews: views };
        }
        if (detected?.externalRef && !link.externalRef) {
          patch.external_ref = detected.externalRef;
          link = { ...link, externalRef: detected.externalRef };
        }
        const { error: upErr } = await db.from("brand_links").update(patch).eq("id", link.id);
        if (upErr) throw new Error(upErr.message);
      }

      if (views != null) {
        const snap: LinkSnapshot = {
          id: snapshotIdForLinkDate(link.id, date),
          linkId: link.id,
          date,
          views,
          notes: "auto",
          likes: reel?.last_likes != null ? Number(reel.last_likes) : undefined,
          comments: reel?.last_comments != null ? Number(reel.last_comments) : undefined,
          shares: reel?.last_shares != null ? Number(reel.last_shares) : undefined,
          refreshedAt: now,
        };
        const { error: snapErr } = await db.from("link_snapshots").upsert(
          {
            id: snap.id,
            link_id: snap.linkId,
            date: snap.date,
            views: snap.views,
            notes: snap.notes,
            likes: snap.likes ?? null,
            comments: snap.comments ?? null,
            shares: snap.shares ?? null,
            refreshed_at: snap.refreshedAt,
          },
          { onConflict: "id" }
        );
        if (snapErr) throw new Error(snapErr.message);
        result.snapshots.push(snap);
      }

      if (reel) {
        const { error: reelErr } = await db
          .from("week_brand_reels")
          .update({
            brand_id: brandId,
            brand_link_id: link.id,
            week_start: weekStart,
            updated_at: now,
          })
          .eq("id", item.id)
          .eq("employee_id", employeeId);
        if (reelErr) throw new Error(reelErr.message);
        result.reelPatches.push({
          id: item.id,
          brandId,
          brandLinkId: link.id,
          views,
        });
      } else if (postId && post) {
        const { error: postErr } = await db
          .from("brand_posts")
          .update({ brand_id: brandId })
          .eq("id", postId)
          .eq("employee_id", employeeId);
        if (postErr) throw new Error(postErr.message);
      }

      result.links.push(link);
      result.assigned += 1;
      if (refreshIds.length < IMMEDIATE_REFRESH_CAP) refreshIds.push(link.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${item.url}: ${msg}`);
    }
  }

  if (isRapidApiEnabled()) {
    const uniqueRefresh = [...new Set(refreshIds)];
    for (const linkId of uniqueRefresh) {
      try {
        const refresh = await refreshSingleLink(linkId, { targetDate: date });
        if (refresh.ok) result.refreshed += 1;
        else if (refresh.error) result.errors.push(`${linkId}: ${refresh.error}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${linkId}: ${msg}`);
      }
    }
  }

  return result;
}
