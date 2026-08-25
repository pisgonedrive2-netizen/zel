import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeBrandLinkUrl } from "@/lib/brand-link-url";
import { brandLinkFromRow } from "@/lib/db/mappers";
import { snapshotIdForLinkDate } from "@/lib/link-tracking-mode";
import { pickNonDecreasingViews } from "./assign-achievement-brand-helpers";
import type { BrandLink } from "@/store/store";

export type BrandLinkDedupeGroup = {
  brandId: string;
  key: string;
  keepId: string;
  dropIds: string[];
};

export type DedupeBrandLinksResult = {
  scanned: number;
  groups: number;
  removed: number;
  keptIds: string[];
  removedIds: string[];
  errors: string[];
};

/** Aynı marka içinde kanonik URL’ye göre hangi kaydın kalacağını seçer. */
export function pickKeepBrandLink(links: BrandLink[]): BrandLink {
  return [...links].sort((a, b) => {
    const aActive = a.status === "inactive" ? 0 : 1;
    const bActive = b.status === "inactive" ? 0 : 1;
    if (bActive !== aActive) return bActive - aActive;
    const av = a.lastViews ?? -1;
    const bv = b.lastViews ?? -1;
    if (bv !== av) return bv - av;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  })[0]!;
}

/** Marka başına çift (aynı kanonik URL) gruplarını bulur — boş URL sayılmaz. */
export function findDuplicateBrandLinkGroups(links: BrandLink[]): BrandLinkDedupeGroup[] {
  const byKey = new Map<string, BrandLink[]>();
  for (const link of links) {
    if (link.status === "inactive") continue;
    const norm = normalizeBrandLinkUrl(link.url);
    if (!norm) continue;
    const key = `${link.brandId}::${norm}`;
    const list = byKey.get(key);
    if (list) list.push(link);
    else byKey.set(key, [link]);
  }

  const groups: BrandLinkDedupeGroup[] = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const keep = pickKeepBrandLink(list);
    groups.push({
      brandId: keep.brandId,
      key,
      keepId: keep.id,
      dropIds: list.filter((l) => l.id !== keep.id).map((l) => l.id),
    });
  }
  return groups;
}

async function copySnapshots(
  db: ReturnType<typeof getSupabaseAdmin>,
  fromId: string,
  toId: string,
  now: string
): Promise<void> {
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
    const { data: dest } = await db.from("link_snapshots").select("views").eq("id", newId).maybeSingle();
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

/**
 * Tüm markaları (veya tek markayı) tarar; aynı içerik URL’sinin çift kayıtlarını
 * birleştirir (snapshot + reel FK) ve fazla satırları siler.
 */
export async function dedupeBrandLinks(opts?: {
  brandId?: string;
}): Promise<DedupeBrandLinksResult> {
  const db = getSupabaseAdmin();
  const result: DedupeBrandLinksResult = {
    scanned: 0,
    groups: 0,
    removed: 0,
    keptIds: [],
    removedIds: [],
    errors: [],
  };

  const rows: Record<string, unknown>[] = [];
  const brandId = opts?.brandId?.trim();
  for (let from = 0; ; from += 1000) {
    let q = db.from("brand_links").select("*").range(from, from + 999);
    if (brandId) q = q.eq("brand_id", brandId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < 1000) break;
  }

  const links = rows.map((r) => brandLinkFromRow(r));
  result.scanned = links.filter((l) => l.status !== "inactive").length;
  const groups = findDuplicateBrandLinkGroups(links);
  result.groups = groups.length;
  if (groups.length === 0) return result;

  const byId = new Map(links.map((l) => [l.id, l]));
  const now = new Date().toISOString();

  for (const group of groups) {
    const keep = byId.get(group.keepId);
    if (!keep) continue;
    try {
      let maxViews = keep.lastViews ?? null;
      for (const dropId of group.dropIds) {
        const drop = byId.get(dropId);
        if (!drop) continue;
        maxViews = pickNonDecreasingViews(maxViews, drop.lastViews);
        await copySnapshots(db, dropId, group.keepId, now);
        const { error: reelErr } = await db
          .from("week_brand_reels")
          .update({ brand_link_id: group.keepId })
          .eq("brand_link_id", dropId);
        if (reelErr) throw new Error(reelErr.message);

        const { error: snapDelErr } = await db.from("link_snapshots").delete().eq("link_id", dropId);
        if (snapDelErr) throw new Error(snapDelErr.message);

        const { error: delErr } = await db.from("brand_links").delete().eq("id", dropId);
        if (delErr) throw new Error(delErr.message);

        result.removed += 1;
        result.removedIds.push(dropId);
        byId.delete(dropId);
      }

      const patch: Record<string, unknown> = { status: "active", auto_track: true };
      if (maxViews != null) patch.last_views = maxViews;
      const { error: keepErr } = await db.from("brand_links").update(patch).eq("id", group.keepId);
      if (keepErr) throw new Error(keepErr.message);
      result.keptIds.push(group.keepId);
      byId.set(group.keepId, {
        ...keep,
        status: "active",
        autoTrack: true,
        lastViews: maxViews ?? keep.lastViews,
      });
    } catch (err) {
      result.errors.push(
        `${group.brandId} ${group.key}: ${err instanceof Error ? err.message : "birleştirme hatası"}`
      );
    }
  }

  return result;
}
