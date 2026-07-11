import type { BrandLink, BrandViewership, Employee, LinkSnapshot } from "@/store/store";
import { linkViewsForMonth, shouldSkipManualViewership } from "@/lib/brand-month-metrics";
import { isActiveRosterEmployee } from "@/lib/active-streamers";

export interface StreamerMonthAggregate {
  employeeId: string;
  name: string;
  linkCount: number;
  activeLinkCount: number;
  linkViews: number;
  manualViews: number;
  totalViews: number;
  brandIds: Set<string>;
}

/** Yayıncı bazında link + manuel brand_viewership toplamları (çift sayım yok). */
export function aggregateStreamersForMonth(opts: {
  employees: Employee[];
  brandLinks: BrandLink[];
  brandViewership: BrandViewership[];
  monthYm: string;
  linkSnapshots: LinkSnapshot[];
  todayYm: string;
  /** Varsayılan true — pasif yayıncıları (eski owner) panodan çıkarır */
  activeOnly?: boolean;
}): StreamerMonthAggregate[] {
  const {
    employees,
    brandLinks,
    brandViewership,
    monthYm,
    linkSnapshots,
    todayYm,
    activeOnly = true,
  } = opts;
  const map = new Map<string, StreamerMonthAggregate>();

  const ensure = (employeeId: string): StreamerMonthAggregate | null => {
    if (activeOnly) {
      const emp = employees.find((e) => e.id === employeeId);
      if (!isActiveRosterEmployee(emp)) return null;
    }
    const existing = map.get(employeeId);
    if (existing) return existing;
    const emp = employees.find((e) => e.id === employeeId);
    const row: StreamerMonthAggregate = {
      employeeId,
      name: emp?.name ?? "Bilinmiyor",
      linkCount: 0,
      activeLinkCount: 0,
      linkViews: 0,
      manualViews: 0,
      totalViews: 0,
      brandIds: new Set(),
    };
    map.set(employeeId, row);
    return row;
  };

  for (const link of brandLinks) {
    if (!link.ownerId) continue;
    const row = ensure(link.ownerId);
    if (!row) continue;
    row.linkCount += 1;
    if (link.status === "active") row.activeLinkCount += 1;
    const v = linkViewsForMonth(link, monthYm, linkSnapshots, todayYm).lastViews;
    row.linkViews += v;
    row.brandIds.add(link.brandId);
  }

  for (const v of brandViewership) {
    if (v.month !== monthYm || !v.employeeId) continue;
    if (shouldSkipManualViewership(v, brandLinks, monthYm, linkSnapshots, todayYm)) continue;
    const row = ensure(v.employeeId);
    if (!row) continue;
    row.manualViews += v.views;
    if (v.brandId) row.brandIds.add(v.brandId);
  }

  for (const row of map.values()) {
    row.totalViews = row.linkViews + row.manualViews;
  }

  return [...map.values()].filter((r) => r.totalViews > 0 || r.linkCount > 0);
}

export function totalViewsIncludingViewership(
  brandLinks: BrandLink[],
  brandViewership: BrandViewership[],
  monthYm: string,
  linkSnapshots: LinkSnapshot[],
  todayYm: string
): number {
  const linkTotal = brandLinks.reduce(
    (s, l) => s + linkViewsForMonth(l, monthYm, linkSnapshots, todayYm).lastViews,
    0
  );
  const manual = brandViewership
    .filter((v) => v.month === monthYm)
    .filter((v) => !shouldSkipManualViewership(v, brandLinks, monthYm, linkSnapshots, todayYm))
    .reduce((s, v) => s + v.views, 0);
  return linkTotal + manual;
}
