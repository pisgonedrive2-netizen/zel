import type { BrandLink, LinkSnapshot } from "@/store/store";
import { linkViewsForMonth, totalLinkViewsForMonth } from "@/lib/brand-month-metrics";
import { totalLinkEngagementForMonth } from "@/lib/brand-engagement-metrics";
import {
  linkViewsGainInMonth,
  totalLinkViewsGainInMonth,
  linkDisplayTitle,
} from "@/lib/link-snapshot-delta";

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
  /** Ay sonu kümülatif snapshot toplamı (platformdaki toplam view) */
  totalViews: number;
  /** Ay içi artış (önceki ay sonu → bu ay sonu) */
  totalGain: number;
  linkCount: number;
}

export interface PerLinkViewershipRow {
  linkId: string;
  title: string;
  platform: string;
  addedMonthYm: string | null;
  /** Seçili ay snapshot toplamı */
  monthViews: number;
  /** Seçili ay izlenme artışı (delta) */
  monthGain: number;
  /** Güncel kümülatif */
  lifetimeViews: number;
  /** Ay ay snapshot toplamları (link bazlı) */
  monthlySeries: { monthYm: string; views: number }[];
}

export interface BrandLinkViewershipStats {
  viewMonth: string;
  /**
   * Seçili ay — ay sonu kümülatif snapshot toplamı.
   * Platformdaki toplam view (artış değil). Güncel aydaysa lifetime’a yakın görünür.
   */
  monthTotalViews: number;
  /** Seçili ay — gerçek aylık izlenme = önceki ay sonu → bu ay sonu artışı */
  monthTotalGain: number;
  /** Tüm linkler — güncel/kümülatif izlenme toplamı */
  lifetimeTotalViews: number;
  /** Seçili ay içinde eklenen link sayısı */
  linksAddedInMonth: number;
  /** Bu ay eklenenlerin ay sonu kümülatif snapshot toplamı */
  viewsFromLinksAddedInMonth: number;
  /** Bu ay eklenenlerin ay içi artışı (genelde snapshot ≈ artış, önceki yok) */
  gainFromLinksAddedInMonth: number;
  /** Seçili ay eklenen linklerin bugüne kadar kümülatif izlenmesi */
  cohortLifetimeViews: number;
  /** Ay ay izlenme (snapshot olan aylar) */
  monthlyBreakdown: MonthViewershipRow[];
  /** Link bazlı detay */
  perLinkRows: PerLinkViewershipRow[];
  activeLinkCount: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    interactions: number;
    linksWithData: number;
  };
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
  const monthTotalGain = totalLinkViewsGainInMonth(active, viewMonth, snapshots, todayYm);
  const lifetimeTotalViews = active.reduce((s, l) => s + linkLatestViews(l, snapshots), 0);
  const engagement = totalLinkEngagementForMonth(active, viewMonth, snapshots, todayYm);

  const addedInMonth = active.filter((l) => linkAddedInMonth(l, viewMonth, snapshots));
  const viewsFromLinksAddedInMonth = totalLinkViewsForMonth(
    addedInMonth,
    viewMonth,
    snapshots,
    todayYm
  );
  const gainFromLinksAddedInMonth = totalLinkViewsGainInMonth(
    addedInMonth,
    viewMonth,
    snapshots,
    todayYm
  );
  const cohortLifetimeViews = addedInMonth.reduce(
    (s, l) => s + linkLatestViews(l, snapshots),
    0
  );

  const perLinkRows: PerLinkViewershipRow[] = active.map((link) => {
    const { lastViews } = linkViewsForMonth(link, viewMonth, snapshots, todayYm);
    const gainRow = linkViewsGainInMonth(link, viewMonth, snapshots, todayYm);

    const linkSnaps = snapshots.filter((s) => s.linkId === link.id);
    const monthSet = new Set(linkSnaps.map((s) => s.date.slice(0, 7)));
    if (todayYm) monthSet.add(todayYm);
    monthSet.add(viewMonth);
    const monthlySeries = [...monthSet]
      .sort()
      .map((monthYm) => ({
        monthYm,
        views: linkViewsForMonth(link, monthYm, snapshots, todayYm).lastViews,
      }))
      .filter((r) => r.views > 0);

    return {
      linkId: link.id,
      title: linkDisplayTitle(link),
      platform: link.platform,
      addedMonthYm: linkAddedMonthYm(link, snapshots),
      monthViews: lastViews,
      monthGain: gainRow.gain,
      lifetimeViews: linkLatestViews(link, snapshots),
      monthlySeries,
    };
  });

  perLinkRows.sort((a, b) => b.monthViews - a.monthViews || b.lifetimeViews - a.lifetimeViews);

  const snapshotMonths = uniqueMonthsFromSnapshots(snapshots, linkIds);
  const monthsToShow = new Set(snapshotMonths);
  monthsToShow.add(viewMonth);
  if (todayYm) monthsToShow.add(todayYm);

  const monthlyBreakdown: MonthViewershipRow[] = [...monthsToShow]
    .sort()
    .map((monthYm) => {
      let linkCount = 0;
      let totalViews = 0;
      let totalGain = 0;
      for (const link of active) {
        const { lastViews, snapsInMonth } = linkViewsForMonth(
          link,
          monthYm,
          snapshots,
          todayYm
        );
        const gain = linkViewsGainInMonth(link, monthYm, snapshots, todayYm).gain;
        if (snapsInMonth.length > 0 || (monthYm === todayYm && (lastViews > 0 || link.lastCheckedAt))) {
          linkCount += 1;
          totalViews += lastViews;
          totalGain += gain;
        }
      }
      return { monthYm, totalViews, totalGain, linkCount };
    })
    .filter((r) => r.totalViews > 0 || r.linkCount > 0 || r.totalGain > 0);

  return {
    viewMonth,
    monthTotalViews,
    monthTotalGain,
    lifetimeTotalViews,
    linksAddedInMonth: addedInMonth.length,
    viewsFromLinksAddedInMonth,
    gainFromLinksAddedInMonth,
    cohortLifetimeViews,
    monthlyBreakdown,
    perLinkRows,
    activeLinkCount: active.length,
    engagement: {
      likes: engagement.likes,
      comments: engagement.comments,
      shares: engagement.shares,
      interactions: engagement.interactions,
      linksWithData: engagement.linksWithData,
    },
  };
}
