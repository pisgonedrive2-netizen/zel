import { describe, expect, it } from "vitest";
import {
  buildPayrollLinePlan,
  buildPayrollPaymentLines,
  payrollPaymentPhase,
  sumUnpaidPayrollLines,
} from "@/lib/payroll-lines";
import type { Employee, MonthPaymentStatus, SalaryExtra } from "@/store/store";

const lucy: Employee = {
  id: "emp-lucy",
  name: "Lucy",
  role: "Yayıncı",
  department: "Yayın",
  baseSalary: 3000,
  rentSupport: 500,
  initialAdvance: 0,
  paymentDay: "1-5",
  payrollStartMonth: "2026-04",
  startDate: "2026-01-01",
  status: "active",
  walletAddress: "",
  avatar: "L",
  notes: "",
  kind: "streamer",
};

const lucyMayExtras: SalaryExtra[] = [
  {
    id: "se-lucy-rent-2026-05",
    employeeId: "emp-lucy",
    month: "2026-05",
    amount: 500,
    description: "Ev kira desteği",
    type: "rent",
  },
  {
    id: "se-lucy-transition-2026-05",
    employeeId: "emp-lucy",
    month: "2026-05",
    amount: 1500,
    description: "Plan geçişi — yarım dönem",
    type: "deduction",
  },
];

describe("buildPayrollLinePlan", () => {
  it("Lucy Mayıs: kesinti sonrası maaş 1500 + kira 500", () => {
    const plan = buildPayrollLinePlan(
      lucy,
      "2026-05",
      [],
      lucyMayExtras,
      [],
      [],
    );
    expect(plan.find((l) => l.lineId === "base")?.amountUsd).toBe(1500);
    expect(plan.find((l) => l.lineId === "rent")?.amountUsd).toBe(500);
    expect(plan.reduce((s, l) => s + l.amountUsd, 0)).toBe(2000);
  });
});

describe("buildPayrollPaymentLines partial", () => {
  it("maaş ödendi, kira bekliyor", () => {
    const statuses: MonthPaymentStatus[] = [
      {
        employeeId: "emp-lucy",
        month: "2026-05",
        paid: false,
        linePayments: [
          {
            lineId: "base",
            kind: "base_salary",
            label: "Temel maaş",
            amountUsd: 1500,
            paid: true,
            paidDate: "2026-06-01",
          },
        ],
      },
    ];
    const lines = buildPayrollPaymentLines(
      lucy,
      "2026-05",
      [],
      lucyMayExtras,
      [],
      statuses,
    );
    expect(payrollPaymentPhase(lines)).toBe("partial");
    expect(sumUnpaidPayrollLines(lines)).toBe(500);
    expect(lines.find((l) => l.lineId === "rent")?.paid).toBe(false);
  });
});
