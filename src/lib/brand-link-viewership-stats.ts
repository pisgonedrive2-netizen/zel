import type { BrandLink, LinkSnapshot } from "@/store/store";
import { linkViewsForMonth, totalLinkViewsForMonth } from "@/lib/brand-month-metrics";

/** Linkin sisteme eklendiği ay (YYYY-MM). */
export function linkAddedMonthYm(link: BrandLink, snapshots: LinkSnapshot[]): string | null {
  if (link.createdAt) return link.createdAt.slice(0, 7);
  const snaps = snapshots
    .filter((s) => s.linkId === link.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (snaps.length > 0) return snaps[0].date.slice(0, 7);
  return null;
}

export function linkAddedInMonth(link: BrandLink, monthYm: string, snapshots: LinkSnapshot[]): boolean {
  return linkAddedMonthYm(link, snapshots) === monthYm;
}

/** Link için en güncel izlenme (son snapshot veya lastViews). */
export function linkLatestViews(link: BrandLink, snapshots: LinkSnapshot[]): number {
  const snaps = snapshots
    .filter((s) => s.linkId === link.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (snaps.length > 0) return snaps[0].views;
  return link.lastViews ?? 0;
}

export interface MonthViewershipRow {
  monthYm: string;
  totalViews: number;
  linkCount: number;
}

export interface BrandLinkViewershipStats {
  viewMonth: string;
  /** Seçili ay — tüm linklerin o ayki snapshot toplamı */
  monthTotalViews: number;
  /** Tüm linkler — güncel/kümülatif izlenme toplamı */
  lifetimeTotalViews: number;
  /** Seçili ay içinde eklenen link sayısı */
  linksAddedInMonth: number;
  /** Seçili ay içinde eklenen linklerin o ayki izlenme toplamı */
  viewsFromLinksAddedInMonth: number;
  /** Ay ay izlenme (snapshot olan aylar) */
  monthlyBreakdown: MonthViewershipRow[];
  activeLinkCount: number;
}

function uniqueMonthsFromSnapshots(snapshots: LinkSnapshot[], linkIds: Set<string>): string[] {
  const months = new Set<string>();
  for (const s of snapshots) {
    if (!linkIds.has(s.linkId)) continue;
    months.add(s.date.slice(0, 7));
  }
  return [...months].sort();
}

export function computeBrandLinkViewershipStats(
  links: BrandLink[],
  snapshots: LinkSnapshot[],
  viewMonth: string,
  todayYm: string
): BrandLinkViewershipStats {
  const active = links.filter((l) => l.status !== "inactive");
  const linkIds = new Set(active.map((l) => l.id));

  const monthTotalViews = totalLinkViewsForMonth(active, viewMonth, snapshots, todayYm);
  const lifetimeTotalViews = active.reduce((s, l) => s + linkLatestViews(l, snapshots), 0);

  const addedInMonth = active.filter((l) => linkAddedInMonth(l, viewMonth, snapshots));
  const viewsFromLinksAddedInMonth = totalLinkViewsForMonth(
    addedInMonth,
    viewMonth,
    snapshots,
    todayYm
  );

  const snapshotMonths = uniqueMonthsFromSnapshots(snapshots, linkIds);
  const monthsToShow = new Set(snapshotMonths);
  monthsToShow.add(viewMonth);
  if (todayYm) monthsToShow.add(todayYm);

  const monthlyBreakdown: MonthViewershipRow[] = [...monthsToShow]
    .sort()
    .map((monthYm) => {
      let linkCount = 0;
      let totalViews = 0;
      for (const link of active) {
        const { lastViews, snapsInMonth } = linkViewsForMonth(
          link,
          monthYm,
          snapshots,
          todayYm
        );
        if (snapsInMonth.length > 0 || (monthYm === todayYm && (lastViews > 0 || link.lastCheckedAt))) {
          linkCount += 1;
          totalViews += lastViews;
        }
      }
      return { monthYm, totalViews, linkCount };
    })
    .filter((r) => r.totalViews > 0 || r.linkCount > 0);

  return {
    viewMonth,
    monthTotalViews,
    lifetimeTotalViews,
    linksAddedInMonth: addedInMonth.length,
    viewsFromLinksAddedInMonth,
    monthlyBreakdown,
    activeLinkCount: active.length,
  };
}
