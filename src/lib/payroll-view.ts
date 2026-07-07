import type {
  Advance,
  ContentExpense,
  Employee,
  MonthPaymentStatus,
  SalaryExtra,
} from "@/store/store";
import { isPayrollActive } from "@/lib/payroll-utils";
import {
  buildPayrollPaymentLines,
  payrollPaymentPhase,
  sumPaidPayrollLines,
  type PayrollLineItem,
} from "@/lib/payroll-lines";

/** Seçili ayda bordro kartı gösterilecek ay (yalnızca bordro aktif ayı veya çıkış ayı). */
export function employeePayrollMonthForView(
  employee: Employee,
  viewMonth: string,
  advances: Advance[],
  salaryExtras: SalaryExtra[],
  contentExpenses: ContentExpense[],
  paymentStatuses: MonthPaymentStatus[],
): string | null {
  if (employee.kind === "coordinator") return null;
  if (isPayrollActive(employee, viewMonth)) return viewMonth;
  // Çıkış sonrası aylarda (Temmuz+) kart gösterme — son bordro yalnızca çıkış ayında.
  const end = employee.payrollEndMonth;
  if (!end || viewMonth !== end) return null;
  const lines = buildPayrollPaymentLines(
    employee,
    end,
    advances,
    salaryExtras,
    contentExpenses,
    paymentStatuses,
  );
  if (lines.length > 0 && payrollPaymentPhase(lines) !== "full") return end;
  return null;
}

export function payrollAmountDue(
  net: number,
  unpaidLineTotal: number,
  isFullyPaid: boolean,
  paidOut: number,
  payrollLines: PayrollLineItem[],
): number {
  if (isFullyPaid) return paidOut > 0 ? paidOut : sumPaidPayrollLines(payrollLines);
  if (unpaidLineTotal > 0) return unpaidLineTotal;
  if (payrollPaymentPhase(payrollLines) === "partial") {
    return Math.max(0, net - sumPaidPayrollLines(payrollLines));
  }
  return Math.max(0, net);
}
