import { describe, expect, it } from "vitest";
import {
  calcNetPayable,
  calcPayrollPayoutDue,
  type ContentExpense,
  type Employee,
  type SalaryExtra,
} from "@/store/store";

const ramiz: Employee = {
  id: "emp-ramiz",
  name: "Ramiz",
  role: "Yayıncı",
  department: "Yayın",
  baseSalary: 10000,
  rentSupport: 1400,
  initialAdvance: 8000,
  paymentDay: "1-5",
  payrollStartMonth: "2026-04",
  startDate: "2025-04-01",
  status: "active",
  walletAddress: "",
  avatar: "R",
  notes: "",
  kind: "streamer",
};

const mayExtras: SalaryExtra[] = [
  { id: "se-ramiz-rent-2026-05", employeeId: "emp-ramiz", month: "2026-05", amount: 1400, description: "Kira", type: "rent" },
  { id: "se-ramiz-adv-2026-05", employeeId: "emp-ramiz", month: "2026-05", amount: 3000, description: "Avans", type: "deduction" },
];

const orphanPayrollExpense: ContentExpense = {
  id: "orphan-1",
  date: "2026-05-15",
  month: "2026-05",
  employeeId: "emp-ramiz",
  brandName: "Pipo",
  category: "Vlog",
  description: "Test",
  amountUsd: 6376.48,
  amountThb: 0,
  paid: false,
  submittedAt: "2026-05-15T12:00:00.000Z",
  submittedBy: "u-ramiz",
  reviewStatus: "approved",
  settlementMode: "payroll",
  notes: "",
};

describe("calcPayrollPayoutDue", () => {
  it("Ramiz Mayıs: bordro 8400 + bordroya işlenmiş içerik 6376 ≈ 14776", () => {
    const base = calcNetPayable(ramiz, "2026-05", [], mayExtras, []);
    expect(base).toBe(8400);

    const due = calcPayrollPayoutDue(
      ramiz,
      "2026-05",
      [],
      mayExtras,
      [],
      [orphanPayrollExpense],
    );
    expect(due).toBeCloseTo(14776.48, 2);
  });
});
