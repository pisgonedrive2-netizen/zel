import { describe, it, expect } from "vitest";
import {
  shiftWeekStartIso,
  weekDayIsosFromStart,
  planDateInWeek,
  formatDateLongTr,
} from "@/lib/data";
import { normalizeWeeklyPlanInput, resolveWeeklyPlanEmployeeId } from "./weekly-plan-normalize";
import type { Employee } from "@/store/store";

const employees = [
  { id: "emp-ramiz", name: "Ramiz", kind: "streamer", status: "active" },
  { id: "emp-lucy", name: "Lucy", kind: "streamer", status: "active" },
] as Employee[];

describe("weekly-plan-normalize", () => {
  it("resolves valid employee id", () => {
    expect(resolveWeeklyPlanEmployeeId("emp-lucy", employees)).toBe("emp-lucy");
  });

  it("falls back when id invalid", () => {
    expect(resolveWeeklyPlanEmployeeId("bad-id", employees, "emp-ramiz")).toBe("emp-ramiz");
  });

  it("normalizes date and week start from date", () => {
    const row = normalizeWeeklyPlanInput(
      {
        employeeId: "emp-ramiz",
        weekStart: "2026-05-24",
        date: "2026-05-28",
        activity: "Yayın",
        notes: "",
        status: "planned",
      },
      { employees, fallbackEmployeeId: "emp-ramiz" }
    );
    expect(row?.date).toBe("2026-05-28");
    expect(row?.weekStart).toBe("2026-05-25");
  });
});

describe("week calendar local", () => {
  it("shift week does not use UTC slice", () => {
    expect(shiftWeekStartIso("2026-05-25", 1)).toBe("2026-06-01");
    expect(shiftWeekStartIso("2026-05-25", -1)).toBe("2026-05-18");
  });

  it("seven days from monday", () => {
    const days = weekDayIsosFromStart("2026-05-25");
    expect(days[0]).toBe("2026-05-25");
    expect(days[6]).toBe("2026-05-31");
  });

  it("normalizes legacy sunday week anchor to monday", () => {
    const days = weekDayIsosFromStart("2026-05-24");
    expect(days[0]).toBe("2026-05-25");
    expect(days).toContain("2026-05-27");
  });

  it("planDateInWeek uses date not stale week_start", () => {
    expect(planDateInWeek("2026-05-27", "2026-05-24")).toBe(true);
    expect(planDateInWeek("2026-05-27", "2026-05-25")).toBe(true);
    expect(planDateInWeek("2026-05-20", "2026-05-25")).toBe(false);
  });

  it("formatDateLongTr matches weekday", () => {
    const label = formatDateLongTr("2026-05-27");
    expect(label.toLowerCase()).toContain("çarşamba");
  });
});
