import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const deleteMock = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    neq: vi.fn().mockResolvedValue({ error: null }),
  }),
});

const selectMock = vi.fn().mockResolvedValue({
  data: [{ id: "ce-1" }, { id: "se-1" }],
  error: null,
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "salary_extras") {
        return { delete: deleteMock, upsert: upsertMock, select: selectMock };
      }
      return { upsert: upsertMock, select: selectMock };
    },
  }),
}));

describe("syncContentExpensesAndSalaryExtras", () => {
  beforeEach(() => {
    upsertMock.mockClear();
  });

  it("writes content without salary_extra_id before extras", async () => {
    const { syncContentExpensesAndSalaryExtras } = await import("./content-expense-sync");
    await syncContentExpensesAndSalaryExtras(
      [
        {
          id: "ce-1",
          date: "2026-05-01",
          month: "2026-05",
          employeeId: "emp-1",
          brandName: "B",
          category: "Vlog",
          description: "x",
          amountUsd: 10,
          paid: false,
          notes: "",
          salaryExtraId: "se-1",
          settlementMode: "payroll",
        },
      ],
      [
        {
          id: "se-1",
          employeeId: "emp-1",
          month: "2026-05",
          amount: 10,
          description: "içerik",
          type: "expense",
          contentExpenseId: "ce-1",
        },
      ]
    );

    const contentCalls = upsertMock.mock.calls.filter((c) => c[0]?.[0]?.employee_id != null);
    expect(contentCalls.length).toBeGreaterThanOrEqual(2);
    expect(contentCalls[0][0][0].salary_extra_id).toBeNull();
    expect(contentCalls[contentCalls.length - 1][0][0].salary_extra_id).toBe("se-1");
  });
});
