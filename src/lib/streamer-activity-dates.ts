import { isoToLocalDateOnly } from "@/lib/data";
import type { BrandDeal, BrandLink, BrandPost, WeekBrandReel } from "@/store/store";

export type ActivityDayItem = {
  id: string;
  date: string;
  url: string;
  platform: string;
  label?: string;
  source: "reel" | "post" | "link";
};

export type BuildStreamerActivityOptions = {
  /** Anlaşma → yayıncı (employeeId eksik postlar için). */
  brandDeals?: BrandDeal[];
  /** Link sahibi → yayıncı (employeeId eksik reel'ler için). */
  brandLinks?: BrandLink[];
};

/** Paylaşım günü — achievement takvimi için `weekStart` kullanılmaz (yanlış güne düşer). */
export function activityDateFromRecord(
  publishedAt?: string | null,
  createdAt?: string | null
): string {
  return isoToLocalDateOnly(publishedAt ?? createdAt ?? "");
}

function dealEmployeeMap(deals: BrandDeal[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of deals) {
    if (d.employeeId) m.set(d.id, d.employeeId);
  }
  return m;
}

function linkOwnerMap(links: BrandLink[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const l of links) {
    if (l.ownerId) m.set(l.id, l.ownerId);
  }
  return m;
}

export function postBelongsToEmployee(
  post: BrandPost,
  employeeId: string,
  dealEmployees: Map<string, string>
): boolean {
  if (post.employeeId) return post.employeeId === employeeId;
  if (post.dealId) return dealEmployees.get(post.dealId) === employeeId;
  return false;
}

export function reelBelongsToEmployee(
  reel: WeekBrandReel,
  employeeId: string,
  linkOwners: Map<string, string>
): boolean {
  if (reel.employeeId === employeeId) return true;
  if (reel.brandLinkId) return linkOwners.get(reel.brandLinkId) === employeeId;
  return false;
}

export function buildStreamerActivity(
  employeeId: string,
  reels: WeekBrandReel[],
  posts: BrandPost[] = [],
  opts: BuildStreamerActivityOptions = {}
): { dates: string[]; byDate: Map<string, ActivityDayItem[]> } {
  const byDate = new Map<string, ActivityDayItem[]>();
  const dealEmployees = dealEmployeeMap(opts.brandDeals ?? []);
  const linkOwners = linkOwnerMap(opts.brandLinks ?? []);

  const push = (item: ActivityDayItem) => {
    if (!item.date) return;
    const arr = byDate.get(item.date) ?? [];
    if (arr.some((x) => x.id === item.id)) return;
    arr.push(item);
    byDate.set(item.date, arr);
  };

  for (const r of reels) {
    if (r.brandLinkId) continue;
    if (!reelBelongsToEmployee(r, employeeId, linkOwners)) continue;
    const date = activityDateFromRecord(r.publishedAt, r.createdAt);
    if (!date) continue;
    push({
      id: r.id,
      date,
      url: r.contentUrl,
      platform: r.platform,
      label: r.contentType,
      source: "reel",
    });
  }

  for (const p of posts) {
    if (!postBelongsToEmployee(p, employeeId, dealEmployees)) continue;
    const date = activityDateFromRecord(p.postedAt, p.createdAt);
    if (!date) continue;
    push({
      id: `post-${p.id}`,
      date,
      url: p.url,
      platform: p.platform,
      label: p.postType,
      source: "post",
    });
  }

  const dates = [...byDate.keys()].sort();
  return { dates, byDate };
}

export function activityDatesList(byDate: Map<string, ActivityDayItem[]>): string[] {
  const out: string[] = [];
  for (const [date, items] of byDate) {
    for (let i = 0; i < items.length; i++) out.push(date);
  }
  return out;
}
