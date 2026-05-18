import { describe, it, expect } from "vitest";
import {
  plannedDateUrgency,
  expandPlannedToMonths,
  remainingBudget,
  quarterKey,
} from "./planned-schedule";
import type { PlannedItem } from "@/store/store";

const base: Omit<PlannedItem, "id"> = {
  name: "Test",
  category: "capex",
  budget: 1000,
  spent: 200,
  startDate: "2026-01-01",
  targetDate: "2026-03-01",
  priority: "medium",
  status: "planned",
  notes: "",
  isRecurring: false,
  recurrence: "none",
};

describe("planned-schedule", () => {
  it("detects overdue", () => {
    expect(plannedDateUrgency("2026-01-01", "planned", new Date(2026, 4, 1))).toBe("overdue");
  });

  it("expands monthly recurring", () => {
    const item: PlannedItem = {
      ...base,
      id: "1",
      isRecurring: true,
      recurrence: "monthly",
      startDate: "2026-01-01",
      targetDate: "2026-03-01",
    };
    const months = expandPlannedToMonths(item, "2026-01", "2026-12");
    expect(months.length).toBeGreaterThanOrEqual(3);
  });

  it("remaining budget", () => {
    expect(remainingBudget({ ...base, id: "x" } as PlannedItem)).toBe(800);
  });

  it("quarter key", () => {
    expect(quarterKey("2026-05-15")).toBe("2026-Q2");
  });
});
