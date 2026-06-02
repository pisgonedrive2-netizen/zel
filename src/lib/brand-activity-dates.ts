import {
  activityDateFromRecord,
  activityDatesList,
  buildStreamerActivity,
  type ActivityDayItem,
  type BuildStreamerActivityOptions,
} from "@/lib/streamer-activity-dates";
import type { BrandDeal, BrandLink, BrandPost, WeekBrandReel } from "@/store/store";

export type BrandActivityScope = {
  brandId: string;
  reels: WeekBrandReel[];
  posts: BrandPost[];
  links: BrandLink[];
  deals: BrandDeal[];
};

/** Marka kapsamına indirgenmiş store verisi. */
export function scopeBrandActivityData(
  brandId: string,
  data: {
    weekBrandReels: WeekBrandReel[];
    brandPosts: BrandPost[];
    brandLinks: BrandLink[];
    brandDeals: BrandDeal[];
  }
): BrandActivityScope {
  return {
    brandId,
    reels: data.weekBrandReels.filter((r) => r.brandId === brandId),
    posts: data.brandPosts.filter((p) => p.brandId === brandId),
    links: data.brandLinks.filter((l) => l.brandId === brandId),
    deals: data.brandDeals.filter((d) => d.brandId === brandId),
  };
}

/** Bu markayla ilişkili yayıncı id'leri (link sahibi, reel, post, anlaşma). */
export function brandPartnerEmployeeIds(scope: BrandActivityScope): string[] {
  const ids = new Set<string>();
  for (const l of scope.links) {
    if (l.ownerId) ids.add(l.ownerId);
  }
  for (const r of scope.reels) {
    if (r.employeeId) ids.add(r.employeeId);
  }
  for (const p of scope.posts) {
    if (p.employeeId) ids.add(p.employeeId);
  }
  for (const d of scope.deals) {
    if (d.employeeId) ids.add(d.employeeId);
  }
  return [...ids].sort();
}

export function buildBrandStreamerActivity(
  employeeId: string,
  scope: BrandActivityScope,
  extraPosts?: BrandPost[]
): { dates: string[]; byDate: Map<string, ActivityDayItem[]> } {
  const posts =
    extraPosts?.length
      ? mergePostsById(scope.posts, extraPosts)
      : scope.posts;
  const opts: BuildStreamerActivityOptions = {
    brandDeals: scope.deals,
    brandLinks: scope.links,
  };
  return buildStreamerActivity(employeeId, scope.reels, posts, opts);
}

function mergePostsById(base: BrandPost[], extra: BrandPost[]): BrandPost[] {
  const byId = new Map(base.map((p) => [p.id, p]));
  for (const p of extra) byId.set(p.id, p);
  return [...byId.values()];
}

/** Tüm partner yayıncıların aktivitesini tek takvimde birleştirir. */
export function buildBrandAggregatedActivity(
  scope: BrandActivityScope,
  employeeIds?: string[],
  extraPosts?: BrandPost[]
): { dates: string[]; byDate: Map<string, ActivityDayItem[]> } {
  const ids = employeeIds?.length
    ? employeeIds
    : brandPartnerEmployeeIds(scope);
  const byDate = new Map<string, ActivityDayItem[]>();
  for (const eid of ids) {
    const { byDate: one } = buildBrandStreamerActivity(eid, scope, extraPosts);
    for (const [date, items] of one) {
      const arr = byDate.get(date) ?? [];
      for (const item of items) {
        if (!arr.some((x) => x.id === item.id)) arr.push(item);
      }
      byDate.set(date, arr);
    }
  }
  const dates = [...byDate.keys()].sort();
  return { dates, byDate };
}

/** Belirli anlaşmaya ait post + yayıncı reel aktivitesi. */
export function buildDealActivity(
  deal: BrandDeal,
  scope: BrandActivityScope,
  dealPosts: BrandPost[]
): { dates: string[]; byDate: Map<string, ActivityDayItem[]> } {
  const employeeId = deal.employeeId ?? "";
  if (!employeeId) {
    const byDate = new Map<string, ActivityDayItem[]>();
    for (const p of dealPosts.filter((x) => x.dealId === deal.id)) {
      const date = activityDateFromRecord(p.postedAt, p.createdAt);
      if (!date) continue;
      const arr = byDate.get(date) ?? [];
      arr.push({
        id: `post-${p.id}`,
        date,
        url: p.url,
        platform: p.platform,
        label: p.postType,
        source: "post",
      });
      byDate.set(date, arr);
    }
    return { dates: [...byDate.keys()].sort(), byDate };
  }
  const postsForDeal = dealPosts.filter((p) => p.dealId === deal.id || p.brandId === deal.brandId);
  return buildBrandStreamerActivity(employeeId, scope, postsForDeal);
}

/** Ay içindeki benzersiz paylaşım günü sayısı. */
export function countActivityDaysInMonth(
  byDate: Map<string, ActivityDayItem[]>,
  monthYm: string
): number {
  let n = 0;
  for (const date of byDate.keys()) {
    if (date.startsWith(monthYm)) n += 1;
  }
  return n;
}

/** Takvim ızgarası için gün → paylaşım var mı. */
export function activityDaySetForMonth(
  byDate: Map<string, ActivityDayItem[]>,
  monthYm: string
): Set<string> {
  const out = new Set<string>();
  for (const date of byDate.keys()) {
    if (date.startsWith(monthYm)) out.add(date);
  }
  return out;
}

export function brandActivityDatesList(byDate: Map<string, ActivityDayItem[]>): string[] {
  return activityDatesList(byDate);
}

/** Reel / link için görüntülenecek yayın günü. */
export function reelDisplayDate(reel: WeekBrandReel): string {
  return activityDateFromRecord(reel.publishedAt, reel.createdAt);
}
