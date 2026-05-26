import { describe, expect, it } from "vitest";
import { weeklyPlanMatchesBrand } from "@/lib/weekly-plan-brand-match";

const padi = { name: "Padişahbet", shortName: "Padi" };

describe("weeklyPlanMatchesBrand", () => {
  it("matches short name tag", () => {
    expect(weeklyPlanMatchesBrand({ brandName: "Padi" }, padi)).toBe(true);
  });

  it("matches full name tag", () => {
    expect(weeklyPlanMatchesBrand({ brandName: "Padişahbet" }, padi)).toBe(true);
  });

  it("rejects other brands", () => {
    expect(weeklyPlanMatchesBrand({ brandName: "Gala" }, padi)).toBe(false);
  });

  it("rejects empty tag", () => {
    expect(weeklyPlanMatchesBrand({ brandName: "" }, padi)).toBe(false);
  });
});
