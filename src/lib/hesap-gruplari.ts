import type { BrandLink, LinkSnapshot } from "@/store/store";
import { linkViewsForMonth } from "@/lib/brand-month-metrics";
import { mediaKeyFromUrl, parseMediaRef } from "@/lib/media-ref";
import {
  accountIdentityFromLink,
  isApiFetchedAccount,
  isYeniHesaplarBrandId,
  parseHesapTag,
  type HesapTag,
} from "@/lib/yeni-hesaplar";

export type HesapTab = "eski" | "aktif" | "yeni";
export type PlatformFamily = "youtube" | "instagram" | "tiktok" | "kick" | "diger";

export const UNKNOWN_HANDLE = "hesap-belirsiz";

export function platformFamily(platform: string, url?: string): PlatformFamily {
  const s = `${platform} ${url ?? ""}`.toLowerCase();
  if (s.includes("youtube") || s.includes("youtu.be")) return "youtube";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("kick")) return "kick";
  return "diger";
}

export function linkInTab(link: BrandLink, tab: HesapTab): boolean {
  if (!link.url?.trim()) return false;
  if (tab === "eski") return !isYeniHesaplarBrandId(link.brandId);
  if (tab === "yeni") return isYeniHesaplarBrandId(link.brandId);
  return link.status === "active" && isApiFetchedAccount(link);
}

export interface VideoEntry {
  link: BrandLink;
  views: number;
  family: PlatformFamily;
  handle: string;
  mediaKey: string;
  /** Aynı video birden fazla markada takip edilebilir; hesapta tek video sayılır. */
  brandIds: string[];
}

export interface AccountGroup {
  key: string;
  family: PlatformFamily;
  platform: string;
  handle: string;
  /** Tekil video/reel linkleri. */
  videos: VideoEntry[];
  /** Profil / kanal linkleri. */
  profiles: BrandLink[];
  /** Video linklerinin seçili aydaki izlenme toplamı. */
  videoViews: number;
  /** Profil/kanal linkindeki sayı (YT kanal izlenmesi, IG takipçi, TT gönderi toplamı). */
  profileMetric: number;
  /** Sıralama ve grafikte kullanılan sayı. */
  views: number;
  activeLinks: number;
  apiOkLinks: number;
  errorLinks: number;
  lastCheckedAt: string | null;
  brandIds: string[];
  isNew: boolean;
  /** Naz / Ponpon gibi sahiplik etiketleri. */
  tags: HesapTag[];
}

export function groupAccounts(
  links: BrandLink[],
  tab: HesapTab,
  monthYm: string,
  snapshots: LinkSnapshot[],
  todayYm: string
): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();
  const snapsByLink = new Map<string, LinkSnapshot[]>();
  for (const s of snapshots) {
    if (!s.date.startsWith(monthYm)) continue;
    const arr = snapsByLink.get(s.linkId);
    if (arr) arr.push(s);
    else snapsByLink.set(s.linkId, [s]);
  }
  for (const link of links) {
    if (!linkInTab(link, tab)) continue;
    const family = platformFamily(link.platform, link.url);
    const identity = accountIdentityFromLink(link);
    const handle = identity?.handle ?? UNKNOWN_HANDLE;
    const key = `${family}|${handle}`;
    const views = linkViewsForMonth(link, monthYm, snapsByLink.get(link.id) ?? [], todayYm).lastViews;
    const g =
      groups.get(key) ??
      ({
        key,
        family,
        platform: link.platform,
        handle,
        videos: [],
        profiles: [],
        videoViews: 0,
        profileMetric: 0,
        views: 0,
        activeLinks: 0,
        apiOkLinks: 0,
        errorLinks: 0,
        lastCheckedAt: null,
        brandIds: [],
        isNew: false,
        tags: [],
      } satisfies AccountGroup);
    if (parseMediaRef(link.url)) {
      const mediaKey = mediaKeyFromUrl(link.url);
      const dup = g.videos.find((v) => v.mediaKey === mediaKey);
      if (dup) {
        if (!dup.brandIds.includes(link.brandId)) dup.brandIds.push(link.brandId);
        if (views > dup.views) {
          g.videoViews += views - dup.views;
          dup.views = views;
          dup.link = link;
        }
      } else {
        g.videos.push({ link, views, family, handle, mediaKey, brandIds: [link.brandId] });
        g.videoViews += views;
      }
    } else {
      g.profiles.push(link);
      g.profileMetric = Math.max(g.profileMetric, views);
    }
    if (link.status === "active") g.activeLinks += 1;
    if (isApiFetchedAccount(link)) g.apiOkLinks += 1;
    if (link.lastCheckError?.trim() || (link.lastRefreshStatus && link.lastRefreshStatus !== "ok")) {
      g.errorLinks += 1;
    }
    if (link.lastCheckedAt && (!g.lastCheckedAt || link.lastCheckedAt > g.lastCheckedAt)) {
      g.lastCheckedAt = link.lastCheckedAt;
    }
    if (!g.brandIds.includes(link.brandId)) g.brandIds.push(link.brandId);
    if (isYeniHesaplarBrandId(link.brandId)) g.isNew = true;
    const tag = parseHesapTag(link.notes);
    if (tag && !g.tags.includes(tag)) g.tags.push(tag);
    g.views = g.videoViews > 0 ? g.videoViews : g.profileMetric;
    groups.set(key, g);
  }
  for (const g of groups.values()) g.videos.sort((a, b) => b.views - a.views);
  return [...groups.values()];
}

export type SortKey = "views" | "videos" | "recent" | "name";

export function sortAccounts(groups: AccountGroup[], sort: SortKey): AccountGroup[] {
  const out = [...groups];
  out.sort((a, b) => {
    if (a.handle === UNKNOWN_HANDLE) return 1;
    if (b.handle === UNKNOWN_HANDLE) return -1;
    if (sort === "videos") return b.videos.length - a.videos.length || b.views - a.views;
    if (sort === "recent") return (b.lastCheckedAt ?? "").localeCompare(a.lastCheckedAt ?? "");
    if (sort === "name") return a.handle.localeCompare(b.handle, "tr");
    return b.views - a.views;
  });
  return out;
}

export function filterAccounts(
  groups: AccountGroup[],
  query: string,
  family: PlatformFamily | "all"
): AccountGroup[] {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  return groups.filter((g) => {
    if (family !== "all" && g.family !== family) return false;
    if (!q) return true;
    if (g.handle.includes(q)) return true;
    if (g.tags.some((t) => t.includes(q))) return true;
    return g.videos.some(
      (v) => v.link.url.toLowerCase().includes(q) || (v.link.notes ?? "").toLowerCase().includes(q)
    );
  });
}
