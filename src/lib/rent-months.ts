import { shiftCalendarMonthYm } from "@/lib/data";

/** fromYm ≤ toYm aralığındaki tüm YYYY-MM değerleri (dahil). */
export function monthsInclusive(fromYm: string, toYm: string, maxSpan = 36): string[] {
  if (fromYm.localeCompare(toYm) > 0) return [];
  const out: string[] = [];
  let cur = fromYm;
  while (cur.localeCompare(toYm) <= 0) {
    out.push(cur);
    if (out.length >= maxSpan) break;
    cur = shiftCalendarMonthYm(cur, 1);
  }
  return out;
}
