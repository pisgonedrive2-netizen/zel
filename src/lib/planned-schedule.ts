import type { PlannedItem, PlannedRecurrence } from "@/store/store";

export type PlannedDateUrgency = "none" | "ok" | "soon" | "overdue";

/** Hedef tarihe göre aciliyet (gün). */
export function plannedDateUrgency(
  targetDate: string,
  status: PlannedItem["status"],
  now = new Date()
): PlannedDateUrgency {
  if (!targetDate || status === "completed" || status === "cancelled") return "none";
  const end = new Date(targetDate + "T23:59:59");
  if (Number.isNaN(end.getTime())) return "none";
  const ms = end.getTime() - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 14) return "soon";
  return "ok";
}

export function daysUntilPlannedTarget(targetDate: string, now = new Date()): number | null {
  if (!targetDate) return null;
  const end = new Date(targetDate + "T23:59:59");
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

export function formatPlannedDateRange(item: PlannedItem): string {
  if (item.startDate && item.targetDate) {
    return `${formatTr(item.startDate)} – ${formatTr(item.targetDate)}`;
  }
  if (item.targetDate) return formatTr(item.targetDate);
  if (item.startDate) return `Başlangıç: ${formatTr(item.startDate)}`;
  return "—";
}

function formatTr(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

/** Tekrarlayan kalemi hedef aralığında aylara yay (grafik / zaman çizelgesi). */
export function expandPlannedToMonths(
  item: PlannedItem,
  fromYm: string,
  toYm: string
): { month: string; amount: number }[] {
  if (!item.isRecurring || item.recurrence === "none") {
    const ym = item.targetDate?.slice(0, 7) || item.startDate?.slice(0, 7);
    if (!ym || ym < fromYm || ym > toYm) return [];
    return [{ month: ym, amount: item.budget }];
  }

  const startYm = (item.startDate || item.targetDate)?.slice(0, 7);
  const endYm = (item.targetDate || item.startDate)?.slice(0, 7);
  if (!startYm || !endYm) return [];

  const out: { month: string; amount: number }[] = [];
  const step = recurrenceMonths(item.recurrence);
  let cur = startYm;

  while (cur <= endYm) {
    if (cur >= fromYm && cur <= toYm) {
      out.push({ month: cur, amount: item.budget });
    }
    cur = addMonthsYm(cur, step);
    if (out.length > 120) break;
  }
  return out;
}

function recurrenceMonths(r: PlannedRecurrence): number {
  if (r === "monthly") return 1;
  if (r === "quarterly") return 3;
  if (r === "yearly") return 12;
  return 1;
}

function addMonthsYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function remainingBudget(item: PlannedItem): number {
  return Math.max(0, item.budget - (item.spent ?? 0));
}

export function budgetProgressPct(item: PlannedItem): number {
  if (item.budget <= 0) return item.spent > 0 ? 100 : 0;
  return Math.min(100, Math.round((item.spent / item.budget) * 100));
}

/** Çeyrek anahtarı: 2026-Q2 */
export function quarterKey(isoDate: string): string | null {
  if (!isoDate || isoDate.length < 7) return null;
  const [y, m] = isoDate.slice(0, 7).split("-").map(Number);
  if (!y || !m) return null;
  const q = Math.ceil(m / 3);
  return `${y}-Q${q}`;
}
