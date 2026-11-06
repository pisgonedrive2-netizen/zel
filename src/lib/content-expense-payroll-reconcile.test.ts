import { describe, expect, it } from "vitest";
import { reconcilePayrollSettledContentExtras } from "@/store/store";
import type { ContentExpense, SalaryExtra } from "@/store/store";

describe("reconcilePayrollSettledContentExtras", () => {
  it("links expense when salary_extra exists but expense still pending", () => {
    const exp: ContentExpense = {
      id: "ce-1",
      date: "2026-10-01",
      month: "2026-10",
      employeeId: "emp-ramiz",
      brandName: "Padi",
      category: "Vlog",
      description: "x",
      amountUsd: 594,
      paid: false,
      reviewStatus: "pending",
    };
    const extra: SalaryExtra = {
      id: "se-1",
      employeeId: "emp-ramiz",
      month: "2026-10",
      amount: 594,
      description: "İçerik",
      type: "expense",
      contentExpenseId: "ce-1",
    };
    const { contentExpenses, changed } = reconcilePayrollSettledContentExtras(
      [extra],
      [exp],
    );
    expect(contentExpenses[0].reviewStatus).toBe("approved");
    expect(contentExpenses[0].settlementMode).toBe("payroll");
    expect(contentExpenses[0].salaryExtraId).toBe("se-1");
    expect(changed).toHaveLength(1);
  });
});
