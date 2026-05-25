import type { Brand, BrandLink, ContentExpense, LinkSnapshot } from "@/store/store";
import { expenseReviewStatus } from "@/lib/content-expense";

/** Harcama marka ile eşleşir (brandId veya eski kayıtlarda brandName). */
export function expenseMatchesBrand(expense: ContentExpense, brand: Brand): boolean {
  if (expense.brandId && expense.brandId === brand.id) return true;
  if (!expense.brandId && expense.brandName) {
    const n = expense.brandName.trim().toLowerCase();
    return n === brand.shortName.trim().toLowerCase() || n === brand.name.trim().toLowerCase();
  }
  return false;
}

/** İptal/red dışındaki harcamalar (CPM ve özet için). */
export function isCountableContentExpense(e: ContentExpense): boolean {
  const st = expenseReviewStatus(e);
  return st !== "cancelled" && st !== "rejected";
}

/** Seçili ay + marka için içerik harcamaları. */
export function brandContentExpensesForMonth(
  expenses: ContentExpense[],
  brand: Brand,
  monthYm: string
): ContentExpense[] {
  return expenses.filter(
    (e) => e.month === monthYm && expenseMatchesBrand(e, brand) && isCountableContentExpense(e)
  );
}

export function sumBrandContentExpensesForMonth(
  expenses: ContentExpense[],
  brand: Brand,
  monthYm: string
): number {
  return brandContentExpensesForMonth(expenses, brand, monthYm).reduce((s, e) => s + e.amountUsd, 0);
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

/** Seçili ay için engagement — snapshot varsa ondan, yalnızca bu ay canlıysa link üzerindeki API alanları. */
export function linkEngagementForMonth(
  link: BrandLink,
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): { likes?: number; comments?: number; shares?: number } {
  const { snapsInMonth } = linkViewsForMonth(link, monthYm, allSnaps, todayYm);
  const snap = snapsInMonth[0];
  if (snap) {
    return {
      likes: snap.likes,
      comments: snap.comments,
      shares: snap.shares,
    };
  }
  if (monthYm === todayYm) {
    return {
      likes: link.lastLikes,
      comments: link.lastComments,
      shares: link.lastShares,
    };
  }
  return {};
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

/** Link snapshot + yayıncı manuel raporları (çift sayım olmadan toplam KPI). */
export function totalViewsForMonth(
  links: BrandLink[],
  viewership: { month: string; views: number }[],
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): number {
  const linkTotal = totalLinkViewsForMonth(links, monthYm, allSnaps, todayYm);
  const manual = viewership
    .filter((v) => v.month === monthYm)
    .reduce((s, v) => s + v.views, 0);
  return linkTotal + manual;
}
