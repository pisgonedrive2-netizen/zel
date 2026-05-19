import { describe, expect, it } from "vitest";
import {
  deriveBrandMonthlyStats,
  draftBrandMonthlyStats,
  findBrandMonthlyStats,
  fmtBrandMoney,
  hasBrandMonthlyStatsData,
} from "./brand-monthly-stats";
import type { BrandMonthlyStats } from "@/store/store";

const sample: BrandMonthlyStats = {
  id: "bms-1",
  brandId: "br-gala",
  month: "2026-05",
  newRegistrations: 1000,
  depositingMembers: 200,
  firstTimeDepositors: 150,
  depositCount: 450,
  depositAmount: 500_000,
  withdrawalAmount: 120_000,
  currency: "TRY",
  liveDemoAllocated: 5000,
  liveDemoRemaining: 1200,
  liveDemoNotes: "Slot demo",
  notes: "",
};

describe("brand-monthly-stats", () => {
  it("finds row by brand and month", () => {
    const rows = [sample, { ...sample, id: "bms-2", brandId: "br-hit", month: "2026-04" }];
    expect(findBrandMonthlyStats(rows, "br-gala", "2026-05")?.id).toBe("bms-1");
    expect(findBrandMonthlyStats(rows, "br-gala", "2026-04")).toBeUndefined();
  });

  it("derives net deposit and conversion", () => {
    const d = deriveBrandMonthlyStats(sample);
    expect(d.netDeposit).toBe(380_000);
    expect(d.avgDepositPerMember).toBe(2500);
    expect(d.registrationToDepositPct).toBe(20);
  });

  it("detects empty draft", () => {
    const draft = draftBrandMonthlyStats("br-gala", "2026-05");
    expect(hasBrandMonthlyStatsData(draft)).toBe(false);
    expect(hasBrandMonthlyStatsData(sample)).toBe(true);
  });

  it("formats money with currency", () => {
    expect(fmtBrandMoney(1_500_000, "TRY")).toContain("₺");
    expect(fmtBrandMoney(2500, "USD")).toContain("$");
  });
});
