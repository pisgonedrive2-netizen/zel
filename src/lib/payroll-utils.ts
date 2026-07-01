import type { Employee } from "@/store/store";

/** İki ay anahtarını karşılaştır ("2026-04" >= "2026-03"). */
export const ymGte = (a: string, b: string) => a.localeCompare(b) >= 0;
export const ymGt = (a: string, b: string) => a.localeCompare(b) > 0;

/** Çalışan, verilen ay için maaş bordrosunda mı? (payrollStartMonth / payrollEndMonth uygulanır.) */
export function isPayrollActive(employee: Employee, month: string): boolean {
  if (!ymGte(month, employee.payrollStartMonth)) return false;
  if (employee.payrollEndMonth && ymGt(month, employee.payrollEndMonth)) return false;
  if (employee.status === "inactive" && !employee.payrollEndMonth) return false;
  return true;
}

/** Oransal temel maaş — tam dolar (29/30 × 3500 → 3383 gibi). */
export function proRatedBaseSalary(baseSalary: number, factor: number): number {
  if (factor >= 1) return baseSalary;
  return Math.floor(baseSalary * factor);
}

/** İş çıkışı ayında gün bazlı oransal maaş çarpanı (0–1). */
export function payrollProrationFactor(employee: Employee, month: string): number {
  if (!employee.payrollEndMonth || employee.payrollEndMonth !== month) return 1;
  if (!employee.exitDate) return 1;
  const exitYm = employee.exitDate.slice(0, 7);
  if (exitYm !== month) return 1;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const exitDay = parseInt(employee.exitDate.slice(8, 10), 10);
  if (!Number.isFinite(exitDay) || exitDay <= 0) return 1;
  return Math.max(0, Math.min(1, exitDay / daysInMonth));
}

export function isFinalPayrollMonth(employee: Employee, month: string): boolean {
  return Boolean(employee.payrollEndMonth && employee.payrollEndMonth === month);
}

/** Prim dağıtımına dahil mi? Bordrodan farklı — işten ayrılanlar prim almaz. */
export function isPrimEligible(employee: Employee, month: string): boolean {
  if (!isPayrollActive(employee, month)) return false;
  if (employee.status === "inactive") return false;
  return true;
}
