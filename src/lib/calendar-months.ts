import { shiftCalendarMonthYm } from "@/lib/data";
import { monthLabelTr } from "@/lib/month-label";

/** Bitiş ayından geriye 12 takvim ayı (YYYY-MM). */
export function last12MonthsYm(endYm: string): string[] {
  return Array.from({ length: 12 }, (_, i) => shiftCalendarMonthYm(endYm, i - 11));
}

export function shortMonthLabel(ym: string): string {
  const [y, mo] = ym.split("-").map(Number);
  if (!y || !mo) return ym;
  return new Date(y, mo - 1, 1).toLocaleDateString("tr-TR", { month: "short" });
}

export function shortMonthWithYear(ym: string): string {
  const [y, mo] = ym.split("-").map(Number);
  if (!y || !mo) return ym;
  return new Date(y, mo - 1, 1).toLocaleDateString("tr-TR", {
    month: "short",
    year: "2-digit",
  });
}

export function currentCalendarYear(): number {
  return new Date().getFullYear();
}

export { monthLabelTr };
