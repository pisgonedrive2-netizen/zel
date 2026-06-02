import { describe, expect, it } from "vitest";
import {
  brandPartnerEmployeeIds,
  buildBrandAggregatedActivity,
  buildBrandStreamerActivity,
  countActivityDaysInMonth,
  scopeBrandActivityData,
} from "@/lib/brand-activity-dates";
import type { BrandLink, BrandPost, WeekBrandReel } from "@/store/store";

const brandId = "brand-a";
const emp1 = "emp-1";
const emp2 = "emp-2";

describe("brand-activity-dates", () => {
  const reels: WeekBrandReel[] = [
    {
      id: "r1",
      employeeId: emp1,
      weekStart: "2026-05-26",
      brandId,
      contentUrl: "https://instagram.com/reel/1",
      platform: "instagram",
      publishedAt: "2026-05-28T10:00:00Z",
      createdAt: "2026-05-28T10:00:00Z",
      brandLinkId: "link-1",
      notes: "",
      contentType: "reel",
    },
    {
      id: "r2",
      employeeId: emp2,
      weekStart: "2026-05-26",
      brandId: "brand-b",
      contentUrl: "https://instagram.com/reel/2",
      platform: "instagram",
      publishedAt: "2026-05-29T10:00:00Z",
      createdAt: "2026-05-29T10:00:00Z",
      notes: "",
      contentType: "reel",
    },
  ];

  const links: BrandLink[] = [
    {
      id: "link-1",
      brandId,
      platform: "instagram",
      url: "https://instagram.com/reel/1",
      handle: "@a",
      ownerId: emp1,
      status: "active",
      notes: "",
      lastViews: 100,
      lastCheckedAt: "2026-05-28T12:00:00Z",
    },
  ];

  const posts: BrandPost[] = [
    {
      id: "p1",
      brandId,
      employeeId: emp1,
      dealId: "deal-1",
      url: "https://tiktok.com/@x/video/1",
      platform: "tiktok",
      postType: "reel",
      status: "live",
      postedAt: "2026-05-30T08:00:00Z",
      createdAt: "2026-05-30T08:00:00Z",
      updatedAt: "2026-05-30T08:00:00Z",
      caption: "",
      views: 0,
      likes: 0,
      comments: 0,
    },
  ];

  it("scopes data to brand", () => {
    const scope = scopeBrandActivityData(brandId, {
      weekBrandReels: reels,
      brandPosts: posts,
      brandLinks: links,
      brandDeals: [],
    });
    expect(scope.reels).toHaveLength(1);
    expect(scope.posts).toHaveLength(1);
    expect(brandPartnerEmployeeIds(scope)).toContain(emp1);
  });

  it("builds per-streamer and aggregated activity", () => {
    const scope = scopeBrandActivityData(brandId, {
      weekBrandReels: reels,
      brandPosts: posts,
      brandLinks: links,
      brandDeals: [],
    });
    const one = buildBrandStreamerActivity(emp1, scope);
    expect(one.byDate.has("2026-05-28")).toBe(true);
    expect(one.byDate.has("2026-05-30")).toBe(true);

    const agg = buildBrandAggregatedActivity(scope);
    expect(countActivityDaysInMonth(agg.byDate, "2026-05")).toBeGreaterThanOrEqual(2);
  });
});
