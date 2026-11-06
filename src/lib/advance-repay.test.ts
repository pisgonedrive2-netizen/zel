import { describe, expect, it } from "vitest";
import {
  encodeAdvanceOverrideInNotes,
  encodeAdvancePlanInNotes,
  parseAdvancePlanFromNotes,
  propagateAdvanceCutsForEmployee,
  resolveAdvancePlan,
  autoAdvanceCutId,
  effectiveAdvanceCutForMonth,
} from "@/lib/advance-repay";
import type { Employee, SalaryExtra } from "@/store/store";

const ponpon: Employee = {
  id: "c5fba5c8-a7ec-49be-84a5-31b10bb08309",
  name: "Ponpon",
  role: "Mod",
  department: "",
  baseSalary: 1500,
  rentSupport: 0,
  initialAdvance: 2500,
  advanceMonthlyCut: 100,
  advanceRepayStartMonth: "2026-10",
  paymentDay: "1-5",
  payrollStartMonth: "2026-07",
  startDate: "2026-07-01",
  status: "active",
  walletAddress: "",
  avatar: "",
  notes: "",
  kind: "moderator",
};

describe("advance plan notes", () => {
  it("round-trips cut/start in notes", () => {
    const notes = encodeAdvancePlanInNotes("Merhaba", 100, "2026-10");
    expect(notes).toContain("[adv-plan:cut=100;start=2026-10]");
    expect(parseAdvancePlanFromNotes(notes)).toEqual({ cut: 100, start: "2026-10" });
  });

  it("effectiveAdvanceCutForMonth uses override", () => {
    const notes = encodeAdvanceOverrideInNotes(
      encodeAdvancePlanInNotes("", 100, "2026-10"),
      "2026-10",
      400,
    );
    expect(effectiveAdvanceCutForMonth({ ...ponpon, notes }, "2026-10")).toBe(400);
    expect(effectiveAdvanceCutForMonth({ ...ponpon, notes }, "2026-11")).toBe(100);
  });
});

describe("propagateAdvanceCutsForEmployee", () => {
  it("honors per-month override cut", () => {
    const withOverride = {
      ...ponpon,
      notes: encodeAdvanceOverrideInNotes(encodeAdvancePlanInNotes("", 100, "2026-10"), "2026-10", 400),
    };
    const july: SalaryExtra = {
      id: "se-ponpon-adv-2026-07",
      employeeId: ponpon.id,
      month: "2026-07",
      amount: 100,
      description: "600$ serisi geri ödemesi (1/6)",
      type: "deduction",
    };
    const sept: SalaryExtra = {
      id: "se-ponpon-adv-2026-09",
      employeeId: ponpon.id,
      month: "2026-09",
      amount: 100,
      description: "Avans",
      type: "deduction",
    };
    const out = propagateAdvanceCutsForEmployee([july, sept], withOverride, "2026-11");
    const oct = out.find((e) => e.month === "2026-10");
    const nov = out.find((e) => e.month === "2026-11");
    expect(oct?.amount).toBe(400);
    expect(oct?.description).toContain("kalan $2000");
    expect(nov?.amount).toBe(100);
    expect(nov?.description).toContain("kalan $1900");
  });

  it("skips September and starts October; respects prior manual repayment", () => {
    const july: SalaryExtra = {
      id: "se-ponpon-adv-2026-07",
      employeeId: ponpon.id,
      month: "2026-07",
      amount: 100,
      description: "600$ serisi geri ödemesi (1/6) · $100 → kalan $500",
      type: "deduction",
    };
    const out = propagateAdvanceCutsForEmployee([july], ponpon, "2026-12");
    expect(out.some((e) => e.month === "2026-09")).toBe(false);
    expect(out.find((e) => e.month === "2026-07")?.amount).toBe(100);
    const oct = out.find((e) => e.id === autoAdvanceCutId(ponpon.id, "2026-10"));
    expect(oct?.amount).toBe(100);
    // 2600 − 100 (Temmuz) = 2500 açık; Ekim–Aralık 3×100
    const auto = out.filter((e) => e.id.startsWith("se-advcut-"));
    expect(auto).toHaveLength(3);
    expect(auto.reduce((s, e) => s + e.amount, 0)).toBe(300);
  });

  it("resolveAdvancePlan reads fields or notes", () => {
    expect(resolveAdvancePlan(ponpon)).toEqual({ cut: 100, start: "2026-10" });
    expect(
      resolveAdvancePlan({
        ...ponpon,
        advanceMonthlyCut: undefined,
        advanceRepayStartMonth: undefined,
        notes: encodeAdvancePlanInNotes("", 250, "2026-11"),
      }),
    ).toEqual({ cut: 250, start: "2026-11" });
  });
});
