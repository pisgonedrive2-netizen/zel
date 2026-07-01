import { describe, expect, it } from "vitest";
import {
  buildPayrollLinePlan,
  buildPayrollPaymentLines,
  payrollPaymentPhase,
  sumUnpaidPayrollLines,
} from "@/lib/payroll-lines";
import type { ContentExpense, Employee, MonthPaymentStatus, SalaryExtra } from "@/store/store";

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

describe("buildPayrollLinePlan content-linked extras", () => {
  it("contentExpenseId olan masraf kalemi yalnızca content: satırında sayılır", () => {
    const content: ContentExpense = {
      id: "ce-1",
      date: "2026-06-10",
      month: "2026-06",
      employeeId: "emp-ramiz",
      brandName: "Padi",
      category: "Vlog",
      description: "Test harcama",
      amountUsd: 500,
      amountThb: 0,
      paid: false,
      submittedAt: "2026-06-10T12:00:00.000Z",
      submittedBy: "u-ramiz",
      reviewStatus: "approved",
      settlementMode: "payroll",
      notes: "",
    };
    const extras: SalaryExtra[] = [
      {
        id: "se-1",
        employeeId: "emp-ramiz",
        month: "2026-06",
        amount: 500,
        description: "İçerik · Test",
        type: "expense",
        contentExpenseId: "ce-1",
      },
      {
        id: "se-ramiz-rent-2026-06",
        employeeId: "emp-ramiz",
        month: "2026-06",
        amount: 1400,
        description: "Kira",
        type: "rent",
      },
    ];
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
    const plan = buildPayrollLinePlan(ramiz, "2026-06", [], extras, [content], []);
    expect(plan.filter((l) => l.amountUsd === 500)).toHaveLength(1);
    expect(plan.find((l) => l.lineId === "content:ce-1")?.amountUsd).toBe(500);
    expect(plan.find((l) => l.lineId === "extra:se-1")).toBeUndefined();
    expect(plan.reduce((s, l) => s + l.amountUsd, 0)).toBe(11900);
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
