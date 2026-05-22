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

/** Bordroya masraf olarak işlendi mi? */
export function isPayrollSettled(e: ContentExpense): boolean {
  return e.settlementMode === "payroll" || Boolean(e.salaryExtraId);
}

/** Kasadan ödendi mi? */
export function isKasaSettled(e: ContentExpense): boolean {
  return e.settlementMode === "kasa" || Boolean(e.kasaTxId && e.paid);
}

/**
 * Onaylı ama henüz kasa/bordro ile kapatılmamış — plan toplamına eklenir.
 * Bordroya eklenenler zaten salary_extras üzerinden nete dahildir.
 */
export function isUnsettledApprovedContent(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  if (s === "rejected" || s === "cancelled" || s === "pending" || s === "needs_info") {
    return false;
  }
  return !isPayrollSettled(e) && !isKasaSettled(e);
}

export const CONTENT_EXPENSE_CATEGORIES = [
  "Vlog",
  "Yetişkin İçerik",
  "Site Videoları",
  "Yol",
  "Reklam",
  "Ekipman",
  "Diğer",
] as const;

export function settlementLabel(e: ContentExpense): string {
  if (isKasaSettled(e)) return "Kasadan ödendi";
  if (isPayrollSettled(e)) return "Maaşa masraf";
  const s = expenseReviewStatus(e);
  if (s === "approved") return "Onaylı · ödeme bekliyor";
  if (s === "pending") return "İncelemede";
  if (s === "needs_info") return "Bilgi istendi";
  if (s === "rejected") return "Reddedildi";
  if (s === "cancelled") return "Geri çekildi";
  return "—";
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
