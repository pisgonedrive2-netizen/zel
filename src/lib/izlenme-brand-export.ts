import type {
  Brand,
  BrandLink,
  BrandMonthlyStats,
  BrandViewership,
  ContentExpense,
  Employee,
  LinkSnapshot,
  WeekBrandReel,
} from "@/store/store";
import {
  findBrandMonthlyStats,
  fmtBrandCount,
  fmtBrandMoney,
  hasBrandMonthlyStatsData,
} from "@/lib/brand-monthly-stats";
import {
  linkEngagementForMonth,
  linkViewsForMonth,
  sumBrandContentExpensesForMonth,
} from "@/lib/brand-month-metrics";
import { weekOverlapsMonth, type BrandMonthPdfInput } from "@/lib/marka-izlenme-pdf";

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

function weekRangeLabel(weekStartIso: string) {
  const a = new Date(weekStartIso + "T00:00:00");
  const b = new Date(weekStartIso + "T00:00:00");
  b.setDate(b.getDate() + 6);
  return `${a.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${b.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
}

export function buildBrandMonthExportPayload(args: {
  brand: Brand;
  viewMonth: string;
  todayYm: string;
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  brandMonthlyStats: BrandMonthlyStats[];
  employees: Employee[];
  weekBrandReels: WeekBrandReel[];
  contentExpenses?: ContentExpense[];
}): BrandMonthPdfInput | null {
  const {
    brand,
    viewMonth,
    todayYm,
    brands,
    brandLinks,
    linkSnapshots,
    brandViewership,
    brandMonthlyStats,
    employees,
    weekBrandReels,
    contentExpenses = [],
  } = args;

  const empName = (id?: string) => employees.find((e) => e.id === id)?.name ?? "—";

  const linksWithMonthViews = brandLinks.map((link) => {
    const { lastViews, refDate } = linkViewsForMonth(
      link,
      viewMonth,
      linkSnapshots,
      todayYm
    );
    return { link, lastViews, refDate };
  });

  const linkRows = linksWithMonthViews.map(({ link, lastViews, refDate }) => {
    const eng = linkEngagementForMonth(link, viewMonth, linkSnapshots, todayYm);
    const likes = eng.likes ?? 0;
    const comments = eng.comments ?? 0;
    const shares = eng.shares ?? 0;
    const totalEngage = likes + comments + shares;
    const engagementRate =
      lastViews > 0 ? `${((totalEngage / lastViews) * 100).toFixed(2)}%` : "-";
    return {
      platform: link.platform,
      handle: link.handle || "-",
      url: link.url || "-",
      owner: link.ownerId ? empName(link.ownerId) : "Genel / atanmamis",
      lastViews: lastViews > 0 ? fmtViews(lastViews) : "-",
      lastSnapshot: refDate ?? "-",
      lastLikes: eng.likes != null ? fmtViews(eng.likes) : undefined,
      lastComments: eng.comments != null ? fmtViews(eng.comments) : undefined,
      lastShares: eng.shares != null ? fmtViews(eng.shares) : undefined,
      engagementRate,
    };
  });

  const platformMap = new Map<
    string,
    {
      linkCount: number;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
    }
  >();
  for (const { link, lastViews } of linksWithMonthViews) {
    const eng = linkEngagementForMonth(link, viewMonth, linkSnapshots, todayYm);
    const cur = platformMap.get(link.platform) ?? {
      linkCount: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
    };
    cur.linkCount += 1;
    cur.totalViews += lastViews ?? 0;
    cur.totalLikes += eng.likes ?? 0;
    cur.totalComments += eng.comments ?? 0;
    cur.totalShares += eng.shares ?? 0;
    platformMap.set(link.platform, cur);
  }

  const platformBreakdown = Array.from(platformMap.entries())
    .sort((a, b) => b[1].totalViews - a[1].totalViews)
    .map(([platform, v]) => ({
      platform,
      linkCount: String(v.linkCount),
      totalViews: fmtViews(v.totalViews),
      totalLikes: fmtViews(v.totalLikes),
      totalComments: fmtViews(v.totalComments),
      totalShares: fmtViews(v.totalShares),
    }));

  const viewRows = brandViewership.filter(
    (v) => v.brandId === brand.id && v.month === viewMonth
  );
  const monthlyRows = viewRows.map((v) => ({
    kaynak: v.employeeId ? `Yayinci: ${empName(v.employeeId)}` : "Genel / admin",
    izlenme: fmtViews(v.views),
    url: v.url || "-",
    not: v.notes || "-",
  }));

  const totalLinkViewsMonth = linksWithMonthViews.reduce((s, r) => s + r.lastViews, 0);
  if (monthlyRows.length === 0 && totalLinkViewsMonth > 0) {
    monthlyRows.push({
      kaynak: "Marka linkleri toplami (hesaplanan)",
      izlenme: fmtViews(totalLinkViewsMonth),
      url: "-",
      not: "-",
    });
  }

  const reels = weekBrandReels
    .filter((r) => r.brandId === brand.id && weekOverlapsMonth(r.weekStart, viewMonth))
    .map((r) => ({
      hafta: weekRangeLabel(r.weekStart),
      yayıncı: empName(r.employeeId),
      platform: r.platform,
      link: r.contentUrl,
      not: r.notes || "-",
    }));

  const stats = findBrandMonthlyStats(brandMonthlyStats, brand.id, viewMonth);
  const operationStats: { label: string; value: string }[] = [];
  if (stats && hasBrandMonthlyStatsData(stats)) {
    const cur = stats.currency ?? "USD";
    const net = Number(stats.depositAmount) - Number(stats.withdrawalAmount);
    operationStats.push(
      { label: "Yeni kayit", value: fmtBrandCount(stats.newRegistrations) },
      { label: "FTD", value: fmtBrandCount(stats.firstTimeDepositors) },
      { label: "Net yatirim", value: fmtBrandMoney(net, cur) }
    );
  }
  const expenseTotal = sumBrandContentExpensesForMonth(
    contentExpenses,
    brand,
    viewMonth,
    brands
  );
  if (expenseTotal > 0) {
    operationStats.push({
      label: "Icerik harcamasi (pay)",
      value: `$${expenseTotal.toLocaleString("tr-TR")}`,
    });
  }

  return {
    brandFullName: brand.name,
    monthYm: viewMonth,
    monthTitle: monthTitleYm(viewMonth),
    links: linkRows,
    monthlyRows,
    reels,
    platformBreakdown,
    operationStats: operationStats.length ? operationStats : undefined,
  };
}

export type { MarkalarOverviewInput, MarkalarOverviewRow } from "@/lib/marka-izlenme-pdf";
export {
  downloadMarkalarOverviewPdf,
  downloadMarkalarOverviewCsv,
} from "@/lib/marka-izlenme-pdf";
