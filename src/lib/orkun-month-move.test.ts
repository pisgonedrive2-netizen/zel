import { describe, expect, it } from "vitest";
import { planExpenseMonthMove } from "./orkun-month-move";

describe("planExpenseMonthMove", () => {
  it("maps same day into target month", () => {
    expect(
      planExpenseMonthMove({ date: "2026-07-15", month: "2026-07" }, "2026-08")
    ).toEqual({ date: "2026-08-15", month: "2026-08" });
  });

  it("clamps day to last day of shorter target month", () => {
    expect(
      planExpenseMonthMove({ date: "2026-01-31", month: "2026-01" }, "2026-02")
    ).toEqual({ date: "2026-02-28", month: "2026-02" });
  });

  it("handles leap-year February", () => {
    expect(
      planExpenseMonthMove({ date: "2024-01-31", month: "2024-01" }, "2024-02")
    ).toEqual({ date: "2024-02-29", month: "2024-02" });
  });

  it("keeps day 1 when moving to any month", () => {
    expect(
      planExpenseMonthMove({ date: "2026-05-01", month: "2026-05" }, "2026-12")
    ).toEqual({ date: "2026-12-01", month: "2026-12" });
  });

  it("throws on invalid target month", () => {
    expect(() =>
      planExpenseMonthMove({ date: "2026-01-10" }, "2026-13")
    ).toThrow(/Geçersiz hedef ay/);
  });
});
