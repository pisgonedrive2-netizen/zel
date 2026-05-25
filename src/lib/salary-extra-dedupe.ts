import type { ContentExpense, SalaryExtra } from "@/store/store";

/**
 * Aynı content_expense_id için tek salary_extra bırakır (DB unique index).
 * content_expenses.salary_extra_id ile eşleşen kayıt tercih edilir.
 */
export function dedupeSalaryExtrasByContentExpense(
  extras: SalaryExtra[],
  contentExpenses: ContentExpense[] = []
): SalaryExtra[] {
  const preferredId = new Map<string, string>();
  for (const ce of contentExpenses) {
    if (ce.salaryExtraId) preferredId.set(ce.id, ce.salaryExtraId);
  }

  const keptContentIds = new Set<string>();
  const withoutContentLink: SalaryExtra[] = [];
  const linked: SalaryExtra[] = [];

  for (const e of extras) {
    if (!e.contentExpenseId) {
      withoutContentLink.push(e);
      continue;
    }
    linked.push(e);
  }

  const byContent = new Map<string, SalaryExtra[]>();
  for (const e of linked) {
    const list = byContent.get(e.contentExpenseId!) ?? [];
    list.push(e);
    byContent.set(e.contentExpenseId!, list);
  }

  const dedupedLinked: SalaryExtra[] = [];
  for (const [contentId, list] of byContent) {
    const pref = preferredId.get(contentId);
    const pick =
      (pref && list.find((x) => x.id === pref)) ||
      list[list.length - 1];
    if (!keptContentIds.has(contentId)) {
      keptContentIds.add(contentId);
      dedupedLinked.push(pick);
    }
  }

  return [...withoutContentLink, ...dedupedLinked];
}
