import { describe, expect, it } from "vitest";
import {
  initialSalaryExtras,
  mergeCanonicalSalaryExtras,
  reconcileRentExtrasForAllEmployees,
  initialEmployees,
  type SalaryExtra,
} from "@/store/store";

describe("mergeCanonicalSalaryExtras", () => {
  it("restores Acelya May 2026 rent to $1,550 when DB had $650", () => {
    const wrong: SalaryExtra = {
      id: "se-acelya-rent-2026-05",
      employeeId: "emp-acelya",
      month: "2026-05",
      amount: 650,
      description: "stale",
      type: "rent",
    };
    const out = mergeCanonicalSalaryExtras([wrong]);
    const may = out.find((e) => e.id === "se-acelya-rent-2026-05");
    expect(may?.amount).toBe(1550);
  });

  it("reconcileRent does not downgrade locked May rent", () => {
    const extras = mergeCanonicalSalaryExtras(
      initialSalaryExtras.map((e) =>
        e.id === "se-acelya-rent-2026-05" ? { ...e, amount: 650 } : e
      )
    );
    const employees = initialEmployees.filter((e) => e.id === "emp-acelya");
    const fixed = reconcileRentExtrasForAllEmployees(employees, extras);
    expect(fixed.find((e) => e.id === "se-acelya-rent-2026-05")?.amount).toBe(1550);
    expect(fixed.find((e) => e.id === "se-acelya-rent-2026-06")?.amount).toBe(650);
  });
});
