import { describe, expect, it } from "vitest";
import {
  calcNetPayable,
  calcOpenAdvanceBalance,
  initialEmployees,
  initialSalaryExtras,
  mergeCanonicalSalaryExtras,
  type SalaryExtra,
} from "@/store/store";
import { buildPayrollPaymentLines } from "@/lib/payroll-lines";
import { sumUnpaidPayrollLines } from "@/lib/payroll-lines";

describe("Acelya Haziran 2026 son bordro", () => {
  const acelya = initialEmployees.find((e) => e.id === "emp-acelya")!;
  const extras = mergeCanonicalSalaryExtras(initialSalaryExtras);
  const juneExtras = extras.filter(
    (e) => e.employeeId === "emp-acelya" && e.month === "2026-06",
  );

  it("floor(3500×29/30) − 600 avans = 2783 (kira hariç)", () => {
    const net = calcNetPayable(acelya, "2026-06", [], extras, [
      {
        employeeId: "emp-acelya",
        month: "2026-06",
        paid: false,
        linePayments: [
          {
            lineId: "rent",
            kind: "rent",
            label: "Kira",
            amountUsd: 1550,
            paid: true,
            paidDate: "2026-06-05",
          },
        ],
      },
    ]);
    expect(net).toBe(4333);
    const lines = buildPayrollPaymentLines(acelya, "2026-06", [], extras, [], [
      {
        employeeId: "emp-acelya",
        month: "2026-06",
        paid: false,
        linePayments: [
          {
            lineId: "rent",
            kind: "rent",
            label: "Kira desteği",
            amountUsd: 1550,
            paid: true,
            paidDate: "2026-06-05",
          },
        ],
      },
    ]);
    const unpaid = sumUnpaidPayrollLines(lines);
    expect(unpaid).toBe(2783);
  });

  it("Haziran sonrası avans kalmaz", () => {
    expect(calcOpenAdvanceBalance(acelya, "2026-06", extras)).toBe(0);
  });

  it("Haziran avans kesintisi $600", () => {
    const adv = juneExtras.find((e) => e.type === "deduction");
    expect(adv?.amount).toBe(600);
  });
});

describe("Lucy Haziran 2026", () => {
  const lucy = initialEmployees.find((e) => e.id === "emp-lucy")!;
  const extras = initialSalaryExtras;

  it("oransal maaş + kira = 2300", () => {
    const net = calcNetPayable(lucy, "2026-06", [], extras, []);
    expect(net).toBe(2300);
  });
});
