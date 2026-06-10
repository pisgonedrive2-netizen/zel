import { describe, expect, it } from "vitest";
import {
  getRentForMonth,
  reconcileRentExtrasForAllEmployees,
  type Employee,
  type SalaryExtra,
} from "./store";

const acelya: Employee = {
  id: "emp-acelya",
  name: "Acelya",
  role: "Yayıncı",
  department: "Yayın",
  baseSalary: 3500,
  rentSupport: 650,
  initialAdvance: 0,
  paymentDay: "1-5",
  payrollStartMonth: "2026-06",
  startDate: "2026-05-03",
  status: "active",
  walletAddress: "",
  avatar: "A",
  notes: "",
  kind: "streamer",
};

describe("getRentForMonth", () => {
  it("falls back to contract rentSupport when no rent extra row", () => {
    const extras: SalaryExtra[] = [];
    expect(getRentForMonth(acelya, "2026-06", extras)).toBe(650);
  });

  it("uses rent extra sum when rows exist", () => {
    const extras: SalaryExtra[] = [
      {
        id: "se-acelya-rent-2026-06",
        employeeId: "emp-acelya",
        month: "2026-06",
        amount: 500,
        description: "eski",
        type: "rent",
      },
    ];
    expect(getRentForMonth(acelya, "2026-06", extras)).toBe(500);
  });
});

describe("reconcileRentExtrasForAllEmployees", () => {
  it("Acelya: Mayıs kira kilitli kalır, Haziran+ sözleşme tutarına çekilir", () => {
    const emp: Employee = {
      ...acelya,
      payrollStartMonth: "2026-05",
    };
    const extras: SalaryExtra[] = [
      {
        id: "se-acelya-rent-2026-05",
        employeeId: "emp-acelya",
        month: "2026-05",
        amount: 1550,
        description: "ilk bordro",
        type: "rent",
      },
      {
        id: "se-acelya-rent-2026-06",
        employeeId: "emp-acelya",
        month: "2026-06",
        amount: 500,
        description: "eski",
        type: "rent",
      },
      {
        id: "se-acelya-rent-2026-07",
        employeeId: "emp-acelya",
        month: "2026-07",
        amount: 800,
        description: "eski",
        type: "rent",
      },
    ];
    const fixed = reconcileRentExtrasForAllEmployees([emp], extras);
    expect(fixed.find((e) => e.month === "2026-05")?.amount).toBe(1550);
    expect(fixed.find((e) => e.month === "2026-06")?.amount).toBe(800);
    expect(fixed.find((e) => e.month === "2026-07")?.amount).toBe(800);
  });

  it("syncs forward from the latest standard rent row when months disagree", () => {
    const extras: SalaryExtra[] = [
      {
        id: "se-acelya-rent-2026-06",
        employeeId: "emp-acelya",
        month: "2026-06",
        amount: 500,
        description: "eski",
        type: "rent",
      },
      {
        id: "se-acelya-rent-2026-07",
        employeeId: "emp-acelya",
        month: "2026-07",
        amount: 800,
        description: "güncel",
        type: "rent",
      },
    ];
    const fixed = reconcileRentExtrasForAllEmployees([acelya], extras);
    expect(fixed.find((e) => e.month === "2026-06")?.amount).toBe(800);
    expect(fixed.find((e) => e.month === "2026-07")?.amount).toBe(800);
  });

  it("fills missing rent months from contract rentSupport", () => {
    const fixed = reconcileRentExtrasForAllEmployees([acelya], []);
    expect(fixed.find((e) => e.month === "2026-06")?.amount).toBe(650);
  });
});
