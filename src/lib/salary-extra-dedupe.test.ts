import { describe, it, expect } from "vitest";
import { dedupeSalaryExtrasByContentExpense } from "./salary-extra-dedupe";
import type { ContentExpense, SalaryExtra } from "@/store/store";

describe("dedupeSalaryExtrasByContentExpense", () => {
  it("keeps one extra per content expense, prefers salaryExtraId link", () => {
    const extras: SalaryExtra[] = [
      {
        id: "se-old",
        employeeId: "emp-1",
        month: "2026-05",
        amount: 100,
        description: "old",
        type: "expense",
        contentExpenseId: "ce-1",
      },
      {
        id: "se-new",
        employeeId: "emp-1",
        month: "2026-05",
        amount: 100,
        description: "new",
        type: "expense",
        contentExpenseId: "ce-1",
      },
      {
        id: "se-rent",
        employeeId: "emp-1",
        month: "2026-05",
        amount: 500,
        description: "kira",
        type: "rent",
      },
    ];
    const content: ContentExpense[] = [
      {
        id: "ce-1",
        employeeId: "emp-1",
        month: "2026-05",
        amountUsd: 100,
        brandName: "B",
        category: "Vlog",
        salaryExtraId: "se-new",
      } as ContentExpense,
    ];
    const out = dedupeSalaryExtrasByContentExpense(extras, content);
    expect(out.filter((e) => e.contentExpenseId === "ce-1")).toHaveLength(1);
    expect(out.find((e) => e.contentExpenseId === "ce-1")?.id).toBe("se-new");
    expect(out.find((e) => e.type === "rent")).toBeTruthy();
  });
});
