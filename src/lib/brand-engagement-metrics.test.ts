import { describe, expect, it } from "vitest";
import {
  shouldSkipManualViewership,
  totalViewsForMonth,
} from "@/lib/brand-month-metrics";
import { totalLinkEngagementForMonth } from "@/lib/brand-engagement-metrics";
import type { BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";

const link: BrandLink = {
  id: "bl-1",
  brandId: "b1",
  platform: "Instagram",
  handle: "@test",
  url: "https://instagram.com/p/abc",
  status: "active",
  notes: "",
  ownerId: "emp-1",
};

describe("shouldSkipManualViewership", () => {
  it("skips brand_viewership when employee has link snapshots for same brand", () => {
    const snaps: LinkSnapshot[] = [
      {
        id: "s1",
        linkId: "bl-1",
        date: "2026-06-15",
        views: 5000,
        notes: "auto",
        likes: 100,
        comments: 20,
      },
    ];
    const v: BrandViewership = {
      id: "bv-1",
      brandName: "Test",
      employeeId: "emp-1",
      brandId: "b1",
      month: "2026-06",
      views: 3000,
      url: "",
      notes: "",
    };
    expect(shouldSkipManualViewership(v, [link], "2026-06", snaps, "2026-07")).toBe(true);
  });
});

describe("totalViewsForMonth dedupe", () => {
  it("does not add manual viewership when link tracking exists", () => {
    const snaps: LinkSnapshot[] = [
      { id: "s1", linkId: "bl-1", date: "2026-06-20", views: 8000, notes: "auto" },
    ];
    const viewership: BrandViewership[] = [
      {
        id: "bv-1",
        brandName: "Test",
        employeeId: "emp-1",
        brandId: "b1",
        month: "2026-06",
        views: 4000,
        url: "",
        notes: "",
      },
    ];
    expect(totalViewsForMonth([link], viewership, "2026-06", snaps, "2026-07")).toBe(8000);
  });
});

describe("totalLinkEngagementForMonth", () => {
  it("sums likes comments shares from snapshots", () => {
    const snaps: LinkSnapshot[] = [
      {
        id: "s1",
        linkId: "bl-1",
        date: "2026-06-20",
        views: 1000,
        notes: "auto",
        likes: 50,
        comments: 10,
        shares: 5,
      },
    ];
    const r = totalLinkEngagementForMonth([link], "2026-06", snaps, "2026-07");
    expect(r.likes).toBe(50);
    expect(r.comments).toBe(10);
    expect(r.shares).toBe(5);
    expect(r.interactions).toBe(65);
  });

  it("coalesces engagement from earlier snap when latest is views-only", () => {
    const snaps: LinkSnapshot[] = [
      {
        id: "s2",
        linkId: "bl-1",
        date: "2026-06-28",
        views: 2000,
        notes: "views-only",
      },
      {
        id: "s1",
        linkId: "bl-1",
        date: "2026-06-10",
        views: 1000,
        notes: "auto",
        likes: 40,
        comments: 8,
        shares: 2,
      },
    ];
    const r = totalLinkEngagementForMonth([link], "2026-06", snaps, "2026-07");
    expect(r.likes).toBe(40);
    expect(r.comments).toBe(8);
    expect(r.shares).toBe(2);
  });

  it("falls back to live last* for current month when snap lacks engagement", () => {
    const live: BrandLink = {
      ...link,
      lastLikes: 90,
      lastComments: 12,
      lastShares: 3,
    };
    const snaps: LinkSnapshot[] = [
      { id: "s1", linkId: "bl-1", date: "2026-07-05", views: 3000, notes: "auto" },
    ];
    const r = totalLinkEngagementForMonth([live], "2026-07", snaps, "2026-07");
    expect(r.likes).toBe(90);
    expect(r.comments).toBe(12);
    expect(r.shares).toBe(3);
  });

  it("does not use live last* for past months", () => {
    const live: BrandLink = {
      ...link,
      lastLikes: 999,
      lastComments: 999,
      lastShares: 999,
    };
    const snaps: LinkSnapshot[] = [
      { id: "s1", linkId: "bl-1", date: "2026-05-20", views: 500, notes: "auto" },
    ];
    const r = totalLinkEngagementForMonth([live], "2026-05", snaps, "2026-07");
    expect(r.likes).toBe(0);
    expect(r.linksWithData).toBe(0);
  });
});
