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
