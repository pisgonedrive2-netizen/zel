import { describe, expect, it } from "vitest";
import {
  propagateRentForEmployee,
  applyRentToMonths,
  getRentForMonth,
  type Employee,
  type SalaryExtra,
} from "./store";

const lucy: Employee = {
  id: "emp-lucy",
  name: "Lucy",
  role: "Yayıncı",
  department: "Yayın",
  baseSalary: 3000,
  rentSupport: 650,
  initialAdvance: 0,
  paymentDay: "17",
  payrollStartMonth: "2026-04",
  startDate: "2026-04-01",
  status: "active",
  walletAddress: "",
  avatar: "L",
  notes: "",
  kind: "streamer",
};

function makeRentSeed(employeeId: string, months: string[], amount: number): SalaryExtra[] {
  return months.map((m) => ({
    id: `se-${employeeId.replace(/^emp-/, "")}-rent-${m}`,
    employeeId,
    month: m,
    amount,
    description: "Ev kira desteği (aylık)",
    type: "rent",
  }));
}

describe("propagateRentForEmployee", () => {
  it("updates all rent extras at or after fromMonth", () => {
    const seed = makeRentSeed("emp-lucy", ["2026-04", "2026-05", "2026-06", "2026-07"], 650);
    const out = propagateRentForEmployee(seed, lucy, 800, "2026-05");
    // 2026-04 unchanged
    expect(out.find((e) => e.month === "2026-04")?.amount).toBe(650);
    // 2026-05+ updated
    expect(out.find((e) => e.month === "2026-05")?.amount).toBe(800);
    expect(out.find((e) => e.month === "2026-06")?.amount).toBe(800);
    expect(out.find((e) => e.month === "2026-07")?.amount).toBe(800);
  });

  it("creates rent extras for missing months in the 12-month horizon", () => {
    const seed: SalaryExtra[] = [];
    const out = propagateRentForEmployee(seed, lucy, 800, "2026-05");
    // 12 months from 2026-05 → 2026-05..2027-04
    const lucyRent = out.filter((e) => e.employeeId === "emp-lucy" && e.type === "rent");
    expect(lucyRent.length).toBe(12);
    expect(lucyRent.every((e) => e.amount === 800)).toBe(true);
    expect(lucyRent.map((e) => e.month).sort()).toContain("2027-04");
    expect(lucyRent.map((e) => e.month).sort()).toContain("2026-05");
  });

  it("fills gaps when some months exist and some don't", () => {
    const seed = makeRentSeed("emp-lucy", ["2026-05", "2026-07"], 650);
    const out = propagateRentForEmployee(seed, lucy, 800, "2026-05");
    const lucyRent = out
      .filter((e) => e.employeeId === "emp-lucy" && e.type === "rent")
      .map((e) => e.month)
      .sort();
    // 2026-05..2027-04 = 12 months
    expect(lucyRent.length).toBe(12);
    // All amounts 800
    out
      .filter((e) => e.employeeId === "emp-lucy" && e.type === "rent")
      .forEach((e) => expect(e.amount).toBe(800));
  });

  it("preserves description on existing rent extras (does not overwrite custom notes)", () => {
    const seed: SalaryExtra[] = [
      {
        id: "se-lucy-rent-2026-05",
        employeeId: "emp-lucy",
        month: "2026-05",
        amount: 650,
        description: "Lucy + Acelya ortak konut · $1.300 cap",
        type: "rent",
      },
    ];
    const out = propagateRentForEmployee(seed, lucy, 800, "2026-05");
    const may = out.find((e) => e.month === "2026-05");
    expect(may?.amount).toBe(800);
    expect(may?.description).toBe("Lucy + Acelya ortak konut · $1.300 cap");
  });

  it("removes future rent extras when amount is set to 0", () => {
    const seed = makeRentSeed("emp-lucy", ["2026-04", "2026-05", "2026-06"], 650);
    const out = propagateRentForEmployee(seed, lucy, 0, "2026-05");
    expect(out.find((e) => e.month === "2026-04")?.amount).toBe(650);
    expect(out.find((e) => e.month === "2026-05")).toBeUndefined();
    expect(out.find((e) => e.month === "2026-06")).toBeUndefined();
  });

  it("never writes rent before payrollStartMonth (effective floor = payrollStartMonth)", () => {
    // fromMonth = 2026-01 but payrollStartMonth = 2026-04 → effectiveFrom = 2026-04
    const seed = makeRentSeed("emp-lucy", ["2026-02"], 100); // pre-payroll legacy entry
    const out = propagateRentForEmployee(seed, lucy, 800, "2026-01");
    // Pre-payroll entry intact
    expect(out.find((e) => e.month === "2026-02")?.amount).toBe(100);
    // 2026-04 onward filled with 800
    expect(out.find((e) => e.month === "2026-04")?.amount).toBe(800);
  });

  it("does not affect other employees", () => {
    const seed: SalaryExtra[] = [
      ...makeRentSeed("emp-lucy", ["2026-05"], 650),
      ...makeRentSeed("emp-ramiz", ["2026-05"], 1400),
    ];
    const out = propagateRentForEmployee(seed, lucy, 800, "2026-05");
    expect(out.find((e) => e.employeeId === "emp-ramiz")?.amount).toBe(1400);
    expect(out.find((e) => e.employeeId === "emp-lucy")?.amount).toBe(800);
  });
});

describe("applyRentToMonths", () => {
  it("sets different months without touching others", () => {
    const seed = makeRentSeed("emp-lucy", ["2026-04"], 500);
    const out = applyRentToMonths(seed, lucy, ["2026-05", "2026-06"], 600);
    expect(getRentForMonth(lucy, "2026-04", out)).toBe(500);
    expect(getRentForMonth(lucy, "2026-05", out)).toBe(600);
    expect(getRentForMonth(lucy, "2026-06", out)).toBe(600);
  });
});
