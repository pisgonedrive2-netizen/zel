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
  pickNonDecreasingViews,
  planAchievementBrandLink,
  type AchievementAssignItem,
} from "./assign-achievement-brand-helpers";

export type { AchievementAssignItem };
export { displayPlatformFromUrl, handleFromContentUrl, parseBrandPostId, pickNonDecreasingViews };

export type AchievementAssignResult = {
  assigned: number;
  created: number;
  reused: number;
  moved: number;
  refreshed: number;
  links: BrandLink[];
  snapshots: LinkSnapshot[];
  reelPatches: { id: string; brandId: string; brandLinkId: string; views?: number | null }[];
  errors: string[];
};

const IMMEDIATE_REFRESH_CAP = 6;

function asViews(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Achievement günündeki paylaşımları marka izlenme (`brand_links`) kaydına bağlar.
 * Marka değişince aynı link taşınır (sayılar düşmez, çift sayılmaz). Snapshot tarihi paylaşım günüdür.
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
    moved: 0,
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

  const { data: ownerLinkRows, error: linkErr } = await db
    .from("brand_links")
    .select("*")
    .eq("owner_id", employeeId);
  if (linkErr) throw new Error(linkErr.message);

  const ownerLinks = (ownerLinkRows ?? []).map((r) => brandLinkFromRow(r as Record<string, unknown>));
  const linksById = new Map(ownerLinks.map((l) => [l.id, l]));

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
  const linksForDup = [...ownerLinks];
  const refreshIds: string[] = [];

  async function upsertSnapshot(opts: {
    linkId: string;
    views: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
  }): Promise<LinkSnapshot | null> {
    if (opts.views == null) return null;
    const id = snapshotIdForLinkDate(opts.linkId, date);
    const { data: existing } = await db
      .from("link_snapshots")
      .select("views, likes, comments, shares")
      .eq("id", id)
      .maybeSingle();
    const prev = existing as
      | { views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null }
      | null;
    const views = pickNonDecreasingViews(prev?.views, opts.views);
    if (views == null) return null;
    const snap: LinkSnapshot = {
      id,
      linkId: opts.linkId,
      date,
      views,
      notes: "auto",
      likes: pickNonDecreasingViews(prev?.likes, opts.likes) ?? undefined,
      comments: pickNonDecreasingViews(prev?.comments, opts.comments) ?? undefined,
      shares: pickNonDecreasingViews(prev?.shares, opts.shares) ?? undefined,
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
    return snap;
  }

  async function copySnapshots(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) return;
    const { data, error } = await db.from("link_snapshots").select("*").eq("link_id", fromId);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const rec = row as {
        date?: string;
        views?: number | null;
        likes?: number | null;
        comments?: number | null;
        shares?: number | null;
        notes?: string | null;
      };
      const snapDate = String(rec.date ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(snapDate)) continue;
      const newId = snapshotIdForLinkDate(toId, snapDate);
      const { data: dest } = await db
        .from("link_snapshots")
        .select("views")
        .eq("id", newId)
        .maybeSingle();
      const views = pickNonDecreasingViews(
        dest ? Number((dest as { views?: number }).views) : null,
        rec.views
      );
      if (views == null) continue;
      const { error: upErr } = await db.from("link_snapshots").upsert(
        {
          id: newId,
          link_id: toId,
          date: snapDate,
          views,
          notes: rec.notes ?? "auto",
          likes: rec.likes ?? null,
          comments: rec.comments ?? null,
          shares: rec.shares ?? null,
          refreshed_at: now,
        },
        { onConflict: "id" }
      );
      if (upErr) throw new Error(upErr.message);
    }
  }

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
      const incomingViews = asViews(reel?.last_views ?? post?.views);
      const detected = resolveLinkDetection({ url, platform });

      const reelLinkId = reel?.brand_link_id ? String(reel.brand_link_id) : "";
      const attached = reelLinkId ? linksById.get(reelLinkId) : undefined;
      const onTarget = findDuplicateBrandLink(linksForDup, url, attached?.id, {
        brandId,
        ownerId: employeeId,
      });
      const elsewhere = findDuplicateBrandLink(linksForDup, url, attached?.id, {
        ownerId: employeeId,
      });
      const currentLink = attached ?? elsewhere ?? onTarget;
      const duplicateOnTarget =
        onTarget && onTarget.id !== currentLink?.id ? onTarget : null;
      const plan = planAchievementBrandLink({
        targetBrandId: brandId,
        currentLink: currentLink ? { id: currentLink.id, brandId: currentLink.brandId } : null,
        duplicateOnTarget: duplicateOnTarget ? { id: duplicateOnTarget.id } : null,
      });

      let link: BrandLink;
      if (plan.kind === "create") {
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
          lastViews: incomingViews ?? undefined,
          externalRef: detected?.externalRef,
          createdAt: now,
        };
        const { error: insErr } = await db.from("brand_links").insert({
          ...brandLinkToRow(link),
          external_ref: detected?.externalRef ?? null,
        });
        if (insErr) throw new Error(insErr.message);
        linksForDup.push(link);
        linksById.set(link.id, link);
        result.created += 1;
      } else {
        const keepId = plan.kind === "merge" ? plan.keepId : plan.linkId;
        const dropId = plan.kind === "merge" ? plan.dropId : null;
        const keep =
          linksById.get(keepId) ??
          duplicateOnTarget ??
          currentLink;
        if (!keep) throw new Error("Marka linki bulunamadı");
        const drop = dropId ? linksById.get(dropId) : undefined;
        const views = pickNonDecreasingViews(
          pickNonDecreasingViews(keep.lastViews, drop?.lastViews),
          incomingViews
        );
        if (plan.kind === "merge" && dropId) {
          await copySnapshots(dropId, keepId);
          const { error: dropErr } = await db
            .from("brand_links")
            .update({ status: "inactive", auto_track: false })
            .eq("id", dropId);
          if (dropErr) throw new Error(dropErr.message);
          const dropped = linksById.get(dropId);
          if (dropped) {
            const inactive = { ...dropped, status: "inactive" as const, autoTrack: false };
            linksById.set(dropId, inactive);
            const idx = linksForDup.findIndex((l) => l.id === dropId);
            if (idx >= 0) linksForDup[idx] = inactive;
          }
          result.moved += 1;
        } else if (plan.kind === "move") {
          result.moved += 1;
        } else {
          result.reused += 1;
        }

        const patch: Record<string, unknown> = {
          brand_id: brandId,
          status: "active",
          auto_track: true,
          owner_id: employeeId,
        };
        if (views != null) patch.last_views = views;
        if (detected?.externalRef && !keep.externalRef) patch.external_ref = detected.externalRef;
        const { error: upErr } = await db.from("brand_links").update(patch).eq("id", keepId);
        if (upErr) throw new Error(upErr.message);
        link = {
          ...keep,
          brandId,
          status: "active",
          autoTrack: true,
          ownerId: employeeId,
          lastViews: views ?? keep.lastViews,
          externalRef: detected?.externalRef ?? keep.externalRef,
        };
        linksById.set(link.id, link);
        const idx = linksForDup.findIndex((l) => l.id === link.id);
        if (idx >= 0) linksForDup[idx] = link;
        else linksForDup.push(link);
      }

      const snap = await upsertSnapshot({
        linkId: link.id,
        views: pickNonDecreasingViews(link.lastViews, incomingViews),
        likes: asViews(reel?.last_likes),
        comments: asViews(reel?.last_comments),
        shares: asViews(reel?.last_shares),
      });
      if (snap) {
        result.snapshots.push(snap);
        if (snap.views > (link.lastViews ?? 0)) {
          link = { ...link, lastViews: snap.views, lastSnapshotDate: date };
        }
      }

      if (reel) {
        const reelViews = pickNonDecreasingViews(asViews(reel.last_views), link.lastViews);
        const { error: reelErr } = await db
          .from("week_brand_reels")
          .update({
            brand_id: brandId,
            brand_link_id: link.id,
            week_start: weekStart,
            last_views: reelViews,
            updated_at: now,
          })
          .eq("id", item.id)
          .eq("employee_id", employeeId);
        if (reelErr) throw new Error(reelErr.message);
        result.reelPatches.push({
          id: item.id,
          brandId,
          brandLinkId: link.id,
          views: reelViews,
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
        if (refresh.ok) {
          result.refreshed += 1;
          const live = asViews(refresh.metrics?.views);
          if (live != null) {
            for (const patch of result.reelPatches) {
              if (patch.brandLinkId !== linkId) continue;
              patch.views = pickNonDecreasingViews(patch.views, live);
            }
            result.links = result.links.map((l) =>
              l.id === linkId
                ? { ...l, lastViews: pickNonDecreasingViews(l.lastViews, live) ?? l.lastViews }
                : l
            );
            if (refresh.linkUpdate?.snapshot) {
              const snap = refresh.linkUpdate.snapshot;
              const idx = result.snapshots.findIndex((s) => s.id === snap.id);
              if (idx >= 0) {
                result.snapshots[idx] = {
                  ...result.snapshots[idx]!,
                  views: pickNonDecreasingViews(result.snapshots[idx]!.views, snap.views) ?? snap.views,
                };
              } else {
                result.snapshots.push(snap);
              }
            }
          }
        } else if (refresh.error) result.errors.push(`${linkId}: ${refresh.error}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${linkId}: ${msg}`);
      }
    }
  }

  return result;
}
