import { parsePaymentWindow } from "@/lib/payroll-dates";

export type ProjectPaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

/** Ödeme günü metninden bu/sonraki ay için tahmini ödeme tarihi aralığı. */
export function paymentWindowInMonth(
  paymentDay: string,
  yearMonth: string
): { start: Date; end: Date; label: string } | null {
  const w = parsePaymentWindow(paymentDay);
  if (!w) return null;
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return null;
  const start = new Date(y, m - 1, w.start);
  const end = new Date(y, m - 1, w.end);
  end.setHours(23, 59, 59, 999);
  const label =
    w.start === w.end
      ? `${w.start} ${start.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}`
      : `${w.start}–${w.end} ${start.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}`;
  return { start, end, label };
}

/** Bugün ödeme penceresi içinde veya `daysBefore` gün kala mı? */
export function isInBrandPaymentReminderWindow(
  paymentDay: string,
  yearMonth: string,
  now = new Date(),
  daysBefore = 3
): boolean {
  const win = paymentWindowInMonth(paymentDay, yearMonth);
  if (!win) return false;
  const lead = Math.max(0, Math.min(daysBefore, 30));
  const remindStart = new Date(win.start);
  remindStart.setDate(remindStart.getDate() - lead);
  remindStart.setHours(0, 0, 0, 0);
  return now >= remindStart && now <= win.end;
}

/** Ay sonu geçtiyse ve ödenmemişse gecikmiş say. */
export function derivePaymentStatus(
  status: ProjectPaymentStatus,
  monthYm: string,
  paymentDay: string,
  now = new Date()
): ProjectPaymentStatus {
  if (status === "paid" || status === "cancelled") return status;
  const win = paymentWindowInMonth(paymentDay, monthYm);
  if (!win) return status === "pending" ? "pending" : status;
  if (now > win.end) return "overdue";
  return "pending";
}

export function daysUntilPaymentWindow(
  paymentDay: string,
  yearMonth: string,
  now = new Date()
): number | null {
  const win = paymentWindowInMonth(paymentDay, yearMonth);
  if (!win) return null;
  const ms = win.start.getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}
