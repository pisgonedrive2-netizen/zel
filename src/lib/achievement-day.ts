import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isoToLocalDateOnly } from "@/lib/data";
import type { ActivityDayItem } from "@/lib/streamer-activity-dates";

export type AchievementDayItem = ActivityDayItem & {
  views?: number | null;
  title?: string;
  streamerAccountId?: string;
};

function dayRangeUtc(date: string): { from: string; to: string } {
  return {
    from: `${date}T00:00:00.000Z`,
    to: `${date}T23:59:59.999Z`,
  };
}

/** Kişisel hesap, marka linki ve manuel check-in reel'leri. */
export async function loadAchievementDayItems(opts: {
  employeeId: string;
  date: string;
  brandId?: string;
}): Promise<AchievementDayItem[]> {
  const { employeeId, date } = opts;
  const { from, to } = dayRangeUtc(date);
  const db = getSupabaseAdmin();

  let reelQuery = db
    .from("week_brand_reels")
    .select(
      "id, content_url, platform, content_type, published_at, created_at, brand_link_id, streamer_account_id, external_ref, last_views, notes, brand_id"
    )
    .eq("employee_id", employeeId)
    .gte("published_at", from)
    .lte("published_at", to);

  if (opts.brandId) {
    reelQuery = reelQuery.or(`brand_id.eq.${opts.brandId},brand_id.is.null`);
  }

  const { data: reels, error: reelErr } = await reelQuery;
  if (reelErr) throw new Error(reelErr.message);

  let postQuery = db
    .from("brand_posts")
    .select("id, url, platform, post_type, posted_at, created_at, employee_id, brand_id")
    .eq("employee_id", employeeId)
    .gte("posted_at", from)
    .lte("posted_at", to);

  if (opts.brandId) postQuery = postQuery.eq("brand_id", opts.brandId);

  const { data: posts, error: postErr } = await postQuery;
  if (postErr) throw new Error(postErr.message);

  const items: AchievementDayItem[] = [];

  for (const r of reels ?? []) {
    const row = r as Record<string, unknown>;
    if (opts.brandId) {
      const bid = row.brand_id ? String(row.brand_id) : null;
      if (bid && bid !== opts.brandId) continue;
    }
    const d = isoToLocalDateOnly(String(row.published_at ?? row.created_at ?? ""));
    if (d !== date) continue;
    items.push({
      id: String(row.id),
      date: d,
      url: String(row.content_url ?? ""),
      platform: String(row.platform ?? ""),
      label: row.content_type ? String(row.content_type) : undefined,
      source: row.brand_link_id ? "link" : "reel",
      views: row.last_views != null ? Number(row.last_views) : null,
      title: row.notes ? String(row.notes) : undefined,
      streamerAccountId: row.streamer_account_id
        ? String(row.streamer_account_id)
        : undefined,
    });
  }

  for (const p of posts ?? []) {
    const row = p as Record<string, unknown>;
    const d = isoToLocalDateOnly(String(row.posted_at ?? row.created_at ?? ""));
    if (d !== date) continue;
    items.push({
      id: `post-${row.id}`,
      date: d,
      url: String(row.url ?? ""),
      platform: String(row.platform ?? ""),
      label: row.post_type ? String(row.post_type) : undefined,
      source: "post",
    });
  }

  const seen = new Set<string>();
  return items.filter((x) => {
    const key = `${x.url.toLowerCase()}|${x.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(x.url?.trim());
  });
}
