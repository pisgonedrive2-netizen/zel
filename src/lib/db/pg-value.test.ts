import { describe, it, expect } from "vitest";
import { pgDate, pgTimestamptz } from "./pg-value";
import { weekDayIsosFromStart, weekStartFromDateIso } from "@/lib/data";

describe("pg-value", () => {
  it("maps empty date to null", () => {
    expect(pgDate("")).toBeNull();
    expect(pgDate("  ")).toBeNull();
  });

  it("uses fallback for empty date", () => {
    expect(pgDate("", "2026-05-26")).toBe("2026-05-26");
  });

  it("strips datetime prefix", () => {
    expect(pgDate("2026-05-26T14:00:00Z")).toBe("2026-05-26");
  });

  it("empty timestamptz is null", () => {
    expect(pgTimestamptz("")).toBeNull();
  });
});

describe("week calendar local", () => {
  it("returns 7 days from monday", () => {
    const days = weekDayIsosFromStart("2026-05-25");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-05-25");
    expect(days[6]).toBe("2026-05-31");
  });

  it("week start from any day in week", () => {
    expect(weekStartFromDateIso("2026-05-28")).toBe("2026-05-25");
  });
});
