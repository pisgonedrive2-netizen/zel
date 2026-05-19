import type { Brand, ExpenseEntry } from "@/store/store";

/** Markaya atanmış genel giderler (expense_entries.brand_id). */
export function brandLinkedExpenses(
  expenses: ExpenseEntry[],
  brandId: string | undefined,
  monthYm?: string
): ExpenseEntry[] {
  if (!brandId) return [];
  return expenses
    .filter((e) => e.brandId === brandId)
    .filter((e) => !monthYm || e.date.startsWith(monthYm))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function sumBrandLinkedExpenses(
  expenses: ExpenseEntry[],
  brandId: string | undefined,
  monthYm?: string
): number {
  return brandLinkedExpenses(expenses, brandId, monthYm).reduce((s, e) => s + e.amount, 0);
}

export function brandLabel(brands: Brand[], brandId: string | undefined): string {
  if (!brandId) return "—";
  const b = brands.find((x) => x.id === brandId);
  return b?.shortName || b?.name || brandId;
}
