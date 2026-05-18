import type { ContentExpense } from "@/store/store";

export type ExpenseReviewStatus = NonNullable<ContentExpense["reviewStatus"]>;

export function expenseReviewStatus(e: ContentExpense): ExpenseReviewStatus {
  return e.reviewStatus ?? (e.paid ? "approved" : "pending");
}

export function canStreamerWithdrawExpense(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  return s === "pending" || s === "needs_info";
}

export function canStreamerEditExpense(e: ContentExpense): boolean {
  return canStreamerWithdrawExpense(e);
}

export function countsTowardPayroll(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  return s !== "rejected" && s !== "cancelled" && s !== "pending" && s !== "needs_info";
}

/**
 * "Hareketli" (aktif) harcama: reddedilmemiş ve geri çekilmemiş.
 * Toplamlar, grafikler ve KPI'lar bu filtreyi kullanmalı; aksi halde
 * yayıncının iptal ettiği talepler hâlâ tabloda/grafikte sayılır.
 */
export function isActiveContentExpense(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  return s !== "rejected" && s !== "cancelled";
}
