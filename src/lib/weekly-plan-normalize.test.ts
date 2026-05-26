import { describe, it, expect } from "vitest";
import { shiftWeekStartIso, weekDayIsosFromStart } from "@/lib/data";
import { normalizeWeeklyPlanInput, resolveWeeklyPlanEmployeeId } from "./weekly-plan-normalize";
import type { Employee } from "@/store/store";

const employees: Employee[] = [
  {
    id: "emp-ramiz",
    name: "Ramiz",
    kind: "streamer",
    status: "active",
    startDate: "2026-01-01",
    paymentDay: 1,
  },
  {
    id: "emp-lucy",
    name: "Lucy",
    kind: "streamer",
    status: "active",
    startDate: "2026-01-01",
    paymentDay: 1,
  },
];

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
});
