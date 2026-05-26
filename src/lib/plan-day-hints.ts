import { getRentForMonth, isPayrollActive, type Employee, type SalaryExtra } from "@/store/store";
import {
  nextYearMonth,
  parsePaymentWindow,
  payrollMonthLongTitle,
} from "@/lib/payroll-dates";

/** Takvim günü üzerinde gösterilecek maaş / extra ipuçları. */
export function planDayPayrollHints(
  dateIso: string,
  employee: Employee,
  bordroYm: string,
  salaryExtras: SalaryExtra[]
): { label: string; tone: "payroll" | "rent" | "extra" }[] {
  const out: { label: string; tone: "payroll" | "rent" | "extra" }[] = [];
  if (!isPayrollActive(employee, bordroYm)) return out;

  const paymentYm = nextYearMonth(bordroYm);
  const w = parsePaymentWindow(employee.paymentDay);
  const day = parseInt(dateIso.slice(8, 10), 10);

  if (dateIso.startsWith(paymentYm) && w && day >= w.start && day <= w.end) {
    out.push({
      label: `${payrollMonthLongTitle(bordroYm)} maaş ödemesi`,
      tone: "payroll",
    });
  }

  const rent = getRentForMonth(employee, bordroYm, salaryExtras);
  if (rent > 0 && w && day === w.start) {
    out.push({
      label: `Kira +$${rent.toLocaleString("en-US")}`,
      tone: "rent",
    });
  }

  const extras = salaryExtras.filter(
    (ex) =>
      ex.employeeId === employee.id &&
      ex.month === bordroYm &&
      ex.type !== "rent" &&
      ex.type !== "deduction"
  );
  if (extras.length > 0 && dateIso.endsWith("-01")) {
    const sum = extras.reduce((s, e) => s + e.amount, 0);
    if (sum > 0) {
      out.push({
        label: `Ek ödeme +$${sum.toLocaleString("en-US")}`,
        tone: "extra",
      });
    }
  }

  return out;
}
