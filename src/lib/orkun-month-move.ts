/**
 * İçerik harcamasını başka bir aya taşırken tarih/ay eşlemesi.
 * Gün, hedef ayda yoksa (örn. 31 → Şubat) ayın son gününe düşer.
 */

export type ExpenseMonthMoveSource = {
  date: string;
  month?: string;
};

export type ExpenseMonthMovePlan = {
  date: string;
  month: string;
};

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function parseYm(ym: string): { y: number; m: number } | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m };
}

function dayFromDate(date: string): number {
  const dayPart = date.slice(8, 10);
  const day = Number(dayPart);
  if (!Number.isFinite(day) || day < 1) return 1;
  return day;
}

/** Harcamanın gününü koruyarak hedef aya map eder. */
export function planExpenseMonthMove(
  expense: ExpenseMonthMoveSource,
  targetMonth: string
): ExpenseMonthMovePlan {
  const ym = parseYm(targetMonth);
  if (!ym) {
    throw new Error(`Geçersiz hedef ay: ${targetMonth}`);
  }
  const day = dayFromDate(String(expense.date ?? "").trim() || `${targetMonth}-01`);
  const maxDay = daysInMonth(ym.y, ym.m);
  const clamped = Math.min(day, maxDay);
  const date = `${targetMonth}-${String(clamped).padStart(2, "0")}`;
  return { date, month: targetMonth };
}
