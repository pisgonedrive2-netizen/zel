import { describe, it, expect } from "vitest";
import {
  brandContentExpensesForMonth,
  sumBrandContentExpensesForMonth,
  linkViewsForMonth,
} from "./brand-month-metrics";
import type { Brand, BrandLink, ContentExpense, LinkSnapshot } from "@/store/store";

const brand: Brand = {
  id: "br-1",
  name: "Galabet",
  shortName: "Gala",
  category: "Bahis",
  status: "active",
  notes: "",
};

const link: BrandLink = {
  id: "lnk-1",
  brandId: "br-1",
  platform: "Kick",
  handle: "@gala",
  url: "https://kick.com/gala",
  status: "active",
  notes: "",
  autoTrack: false,
  lastViews: 99999,
  lastSnapshotDate: "2026-05-10",
};

describe("brand-month-metrics", () => {
  it("filters expenses by month and brand", () => {
    const expenses: ContentExpense[] = [
      {
        id: "e1",
        date: "2026-04-01",
        month: "2026-04",
        employeeId: "emp-1",
        brandId: "br-1",
        brandName: "Gala",
        category: "Vlog",
        description: "Nisan",
        amountUsd: 100,
        paid: true,
        notes: "",
        reviewStatus: "approved",
      },
      {
        id: "e2",
        date: "2026-05-01",
        month: "2026-05",
        employeeId: "emp-1",
        brandId: "br-1",
        brandName: "Gala",
        category: "Vlog",
        description: "Mayıs",
        amountUsd: 200,
        paid: true,
        notes: "",
        reviewStatus: "approved",
      },
    ];
    expect(sumBrandContentExpensesForMonth(expenses, brand, "2026-04", [brand])).toBe(100);
    expect(sumBrandContentExpensesForMonth(expenses, brand, "2026-05", [brand])).toBe(200);
    expect(brandContentExpensesForMonth(expenses, brand, "2026-04")).toHaveLength(1);
  });

  it("does not use lastViews for past months without snapshots", () => {
    const snaps: LinkSnapshot[] = [];
    const meta = linkViewsForMonth(link, "2026-03", snaps, "2026-05");
    expect(meta.lastViews).toBe(0);
    expect(meta.stale).toBe(true);
  });

  it("uses snapshot in selected month", () => {
    const snaps: LinkSnapshot[] = [
      { id: "s1", linkId: "lnk-1", date: "2026-04-15", views: 5000, notes: "" },
    ];
    const meta = linkViewsForMonth(link, "2026-04", snaps, "2026-05");
    expect(meta.lastViews).toBe(5000);
    expect(meta.stale).toBe(false);
  });
});
