import { linkViewsForMonth } from "@/lib/brand-month-metrics";
import type { BrandLink, Employee, LinkSnapshot } from "@/store/store";

export type BrandLinkSortKey = "views" | "platform" | "handle";

export type EnrichedBrandLink = BrandLink & {
  lastViews: number;
  refDate: string | null;
  stale: boolean;
  ownerName: string;
};

export function enrichBrandLinksForMonth(
  links: BrandLink[],
  monthYm: string,
  linkSnapshots: LinkSnapshot[],
  todayYm: string,
  employees: Employee[]
): EnrichedBrandLink[] {
  const empName = (id?: string) =>
    id ? employees.find((e) => e.id === id)?.name ?? "—" : "Genel / atanmamış";

  return links.map((link) => {
    const meta = linkViewsForMonth(link, monthYm, linkSnapshots, todayYm);
    return {
      ...link,
      lastViews: meta.lastViews,
      refDate: meta.refDate,
      stale: meta.stale,
      ownerName: empName(link.ownerId),
    };
  });
}

export function filterBrandLinksDisplay(
  rows: EnrichedBrandLink[],
  opts: {
    search?: string;
    platform?: string;
    ownerId?: string;
    monthOnly?: boolean;
    monthYm?: string;
    todayYm?: string;
  }
): EnrichedBrandLink[] {
  let list = rows;
  const q = opts.search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (row) =>
        row.platform.toLowerCase().includes(q) ||
        row.handle.toLowerCase().includes(q) ||
        row.url.toLowerCase().includes(q) ||
        row.ownerName.toLowerCase().includes(q)
    );
  }
  if (opts.platform && opts.platform !== "all") {
    list = list.filter((row) => row.platform === opts.platform);
  }
  if (opts.ownerId && opts.ownerId !== "all") {
    list = list.filter((row) => (row.ownerId ?? "_none") === opts.ownerId);
  }
  if (opts.monthOnly && opts.monthYm && opts.todayYm) {
    list = list.filter((row) => row.lastViews > 0 || !row.stale || opts.monthYm === opts.todayYm);
  }
  return list;
}

export function sortBrandLinksDisplay(
  rows: EnrichedBrandLink[],
  sortKey: BrandLinkSortKey
): EnrichedBrandLink[] {
  const sorted = [...rows];
  if (sortKey === "platform") {
    sorted.sort(
      (a, b) =>
        a.platform.localeCompare(b.platform, "tr") || b.lastViews - a.lastViews
    );
  } else if (sortKey === "handle") {
    sorted.sort(
      (a, b) =>
        a.handle.localeCompare(b.handle, "tr") || b.lastViews - a.lastViews
    );
  } else {
    sorted.sort(
      (a, b) => b.lastViews - a.lastViews || a.platform.localeCompare(b.platform, "tr")
    );
  }
  return sorted;
}

export function platformOptionsFromLinks(links: BrandLink[]): string[] {
  const set = new Set<string>();
  for (const l of links) set.add(l.platform);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
}
