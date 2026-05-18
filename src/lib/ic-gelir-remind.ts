import { fmt } from "@/lib/data";
import { paymentWindowInMonth } from "@/lib/brand-payment-schedule";
import { payrollMonthLongTitle } from "@/lib/payroll-dates";
import type { Brand, InternalProject } from "@/store/store";
import type { AppUser } from "@/store/auth";

export function brandUsersForProject(
  users: AppUser[],
  brandId: string | undefined
): AppUser[] {
  if (!brandId) return [];
  return users.filter((u) => u.role === "brand" && u.brandId === brandId && u.active);
}

export function buildBrandPaymentReminderCopy(
  project: InternalProject,
  brand: Brand | undefined,
  monthYm: string
): { title: string; message: string; refId: string } {
  const brandLabel = brand?.shortName ?? brand?.name ?? "Marka";
  const win = paymentWindowInMonth(project.paymentDay, monthYm);
  const pencere = win?.label ?? (project.paymentDay || "belirtilmedi");
  const ay = payrollMonthLongTitle(monthYm);
  const refId = `brand-pay-${project.id}-${monthYm}`;
  const title = `${brandLabel} · ${ay} ödeme hatırlatması`;
  const message =
    `${project.name} (${project.category}) için ${ay} dönemi tahsilatı bekleniyor. ` +
    `Beklenen tutar: ${fmt(project.monthlyRevenue)}. Ödeme penceresi: ${pencere}. ` +
    `Ödeme sonrası lütfen finans ekibiyle iletişime geçin veya paneldeki bildirimlere yanıt verin.`;
  return { title, message, refId };
}

/** Aynı gün tekrar otomatik hatırlatma gönderilmesin. */
export function wasReminderSentToday(lastReminderSentAt: string | undefined, now = new Date()): boolean {
  if (!lastReminderSentAt) return false;
  const sent = new Date(lastReminderSentAt);
  if (Number.isNaN(sent.getTime())) return false;
  return (
    sent.getFullYear() === now.getFullYear() &&
    sent.getMonth() === now.getMonth() &&
    sent.getDate() === now.getDate()
  );
}
