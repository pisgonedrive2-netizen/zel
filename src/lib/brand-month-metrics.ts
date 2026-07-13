import type { Brand, BrandLink, BrandViewership, ContentExpense, LinkSnapshot } from "@/store/store";
import { expenseReviewStatus } from "@/lib/content-expense";
import {
  brandExpenseShareUsd,
  expenseMatchesBrand,
} from "@/lib/content-expense-brands";

export { expenseMatchesBrand } from "@/lib/content-expense-brands";

/** İptal/red dışındaki harcamalar (CPM ve özet için). */
export function isCountableContentExpense(e: ContentExpense): boolean {
  const st = expenseReviewStatus(e);
  return st !== "cancelled" && st !== "rejected";
}

/** Seçili ay + marka için içerik harcamaları. */
export function brandContentExpensesForMonth(
  expenses: ContentExpense[],
  brand: Brand,
  monthYm: string,
  allBrands: Brand[] = []
): ContentExpense[] {
  const brands = allBrands.length > 0 ? allBrands : [brand];
  return expenses.filter(
    (e) =>
      e.month === monthYm &&
      isCountableContentExpense(e) &&
      expenseMatchesBrand(e, brand, brands)
  );
}

export function sumBrandContentExpensesForMonth(
  expenses: ContentExpense[],
  brand: Brand,
  monthYm: string,
  allBrands: Brand[] = []
): number {
  const brands = allBrands.length > 0 ? allBrands : [brand];
  return expenses
    .filter(
      (e) =>
        e.month === monthYm &&
        isCountableContentExpense(e) &&
        expenseMatchesBrand(e, brand, brands)
    )
    .reduce((s, e) => s + brandExpenseShareUsd(e, brand.id, brands), 0);
}

/** Tüm markalar — seçili ay içerik harcaması toplamı. */
export function totalContentExpensesForMonth(
  expenses: ContentExpense[],
  monthYm: string
): number {
  return expenses
    .filter((e) => e.month === monthYm && isCountableContentExpense(e))
    .reduce((s, e) => s + e.amountUsd, 0);
}

/** Seçilen YYYY-MM için link izlenme (o ayın son snapshot’ı; yalnızca bu ay canlıysa lastViews). */
export function linkViewsForMonth(
  link: BrandLink,
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): { lastViews: number; refDate: string | null; stale: boolean; snapsInMonth: LinkSnapshot[] } {
  const snapsInMonth = allSnaps
    .filter((s) => s.linkId === link.id && s.date.startsWith(monthYm))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (snapsInMonth.length > 0) {
    return {
      lastViews: snapsInMonth[0].views,
      refDate: snapsInMonth[0].date,
      stale: false,
      snapsInMonth,
    };
  }
  if (monthYm === todayYm) {
    const lastViews = link.lastViews ?? 0;
    const refDate = link.lastSnapshotDate ?? null;
    const hasEngagement =
      link.lastLikes != null || link.lastComments != null || link.lastShares != null;
    const stale = !link.lastSnapshotDate && lastViews === 0 && !hasEngagement;
    return { lastViews, refDate, stale, snapsInMonth: [] };
  }
  return { lastViews: 0, refDate: null, stale: true, snapsInMonth: [] };
}

/**
 * Seçili ay için engagement.
 * - Ay içi snapshot’lardan alan bazında coalesce (views-only snap engagement’ı silmez)
 * - Bu ay: eksik alanlar link.lastLikes/Comments/Shares ile tamamlanır
 * - Geçmiş ay: yalnızca o aya ait snapshot engagement’ı (canlı last* karışmaz)
 */
export function linkEngagementForMonth(
  link: BrandLink,
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): { likes?: number; comments?: number; shares?: number } {
  const { snapsInMonth } = linkViewsForMonth(link, monthYm, allSnaps, todayYm);

  let likes: number | undefined;
  let comments: number | undefined;
  let shares: number | undefined;

  for (const snap of snapsInMonth) {
    if (likes == null && snap.likes != null) likes = snap.likes;
    if (comments == null && snap.comments != null) comments = snap.comments;
    if (shares == null && snap.shares != null) shares = snap.shares;
    if (likes != null && comments != null && shares != null) break;
  }

  if (monthYm === todayYm) {
    if (likes == null && link.lastLikes != null) likes = link.lastLikes;
    if (comments == null && link.lastComments != null) comments = link.lastComments;
    if (shares == null && link.lastShares != null) shares = link.lastShares;
  }

  return { likes, comments, shares };
}

/** Liste görünümü: geçmiş aylarda yalnızca o aya ait snapshot'ı olan linkler; bu ayda aktif linkler. */
export function linkVisibleInMonth(
  link: BrandLink,
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): boolean {
  const { snapsInMonth, lastViews, stale } = linkViewsForMonth(
    link,
    monthYm,
    allSnaps,
    todayYm
  );
  if (snapsInMonth.length > 0) return true;
  if (monthYm !== todayYm) return false;
  if (link.status === "active") return true;
  if (!stale && (lastViews > 0 || link.lastCheckedAt)) return true;
  return false;
}

export function filterLinksForViewMonth(
  links: BrandLink[],
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string,
  showAll: boolean
): BrandLink[] {
  if (showAll) return links;
  return links.filter((l) => linkVisibleInMonth(l, monthYm, allSnaps, todayYm));
}

export function totalLinkViewsForMonth(
  links: BrandLink[],
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): number {
  return links.reduce(
    (sum, link) => sum + linkViewsForMonth(link, monthYm, allSnaps, todayYm).lastViews,
    0
  );
}

/**
 * Kısa izlenme gösterimi: 62M, 1.2k (asla 62035.6k gibi binler üstü k değil).
 * 1M+ için M, 10k+ için k, altında tam sayı.
 */
export function fmtCompactViews(n: number): string {
  const v = Math.abs(Math.floor(n));
  if (v >= 1_000_000_000) {
    const b = v / 1_000_000_000;
    return `${b >= 10 ? b.toFixed(1) : b.toFixed(2)}B`;
  }
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m >= 100 ? Math.round(m) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`;
  }
  if (v >= 10_000) {
    const k = v / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString("tr-TR");
}

/**
 * Aynı yayıncı + marka için link snapshot'ı varsa brand_viewership satırını
 * sayma — çift sayım olmasın (API/manuel link takibi öncelikli).
 */
export function shouldSkipManualViewership(
  v: BrandViewership,
  links: BrandLink[],
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): boolean {
  if (!v.employeeId || !v.brandId) return false;
  return links.some(
    (l) =>
      l.ownerId === v.employeeId &&
      l.brandId === v.brandId &&
      linkViewsForMonth(l, monthYm, allSnaps, todayYm).lastViews > 0
  );
}

/** Link snapshot + yayıncı manuel raporları (çift sayım olmadan toplam KPI). */
export function totalViewsForMonth(
  links: BrandLink[],
  viewership: BrandViewership[],
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): number {
  const linkTotal = totalLinkViewsForMonth(links, monthYm, allSnaps, todayYm);
  const manual = viewership
    .filter((v) => v.month === monthYm)
    .filter((v) => !shouldSkipManualViewership(v, links, monthYm, allSnaps, todayYm))
    .reduce((s, v) => s + v.views, 0);
  return linkTotal + manual;
}
