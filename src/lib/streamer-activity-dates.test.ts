import { describe, expect, it } from "vitest";
import {
  buildStreamerActivity,
  postBelongsToEmployee,
  reelBelongsToEmployee,
} from "@/lib/streamer-activity-dates";
import type { BrandDeal, BrandLink, BrandPost, WeekBrandReel } from "@/store/store";

describe("postBelongsToEmployee", () => {
  const deals = new Map<string, string>([["bd-1", "emp-ramiz"]]);

  it("matches direct employeeId", () => {
    expect(
      postBelongsToEmployee(
        { employeeId: "emp-ramiz" } as BrandPost,
        "emp-ramiz",
        deals
      )
    ).toBe(true);
  });

  it("resolves via deal when employeeId missing", () => {
    expect(
      postBelongsToEmployee(
        { dealId: "bd-1" } as BrandPost,
        "emp-ramiz",
        deals
      )
    ).toBe(true);
  });

  it("rejects other streamers", () => {
    expect(
      postBelongsToEmployee(
        { employeeId: "emp-acelya" } as BrandPost,
        "emp-ramiz",
        deals
      )
    ).toBe(false);
  });
});

describe("reelBelongsToEmployee", () => {
  const links = new Map<string, string>([["bl-1", "emp-ramiz"]]);

  it("matches link owner when reel employeeId differs", () => {
    expect(
      reelBelongsToEmployee(
        { employeeId: "emp-other", brandLinkId: "bl-1" } as WeekBrandReel,
        "emp-ramiz",
        links
      )
    ).toBe(true);
  });
});

describe("buildStreamerActivity", () => {
  it("merges reels and posts on the same local day", () => {
    const reels: WeekBrandReel[] = [
      {
        id: "wr-1",
        employeeId: "emp-ramiz",
        weekStart: "2026-05-26",
        brandId: "br-x",
        contentUrl: "https://instagram.com/reel/aaa",
        platform: "Instagram",
        publishedAt: "2026-05-28T14:00:00.000Z",
        notes: "",
        createdAt: "2026-05-28T14:00:00.000Z",
      },
    ];
    const posts: BrandPost[] = [
      {
        id: "bp-1",
        brandId: "br-x",
        employeeId: "emp-ramiz",
        platform: "instagram",
        postType: "reel",
        url: "https://instagram.com/reel/bbb",
        caption: "",
        views: 0,
        likes: 0,
        comments: 0,
        status: "live",
        postedAt: "2026-05-30T10:00:00.000Z",
        createdAt: "2026-05-30T10:00:00.000Z",
        updatedAt: "2026-05-30T10:00:00.000Z",
      },
    ];
    const { byDate } = buildStreamerActivity("emp-ramiz", reels, posts);
    expect(byDate.size).toBe(2);
    expect(byDate.get("2026-05-28")?.[0]?.url).toContain("aaa");
    expect(byDate.get("2026-05-30")?.[0]?.source).toBe("post");
  });

  it("includes brand-link reels for link owner", () => {
    const links: BrandLink[] = [
      {
        id: "bl-1",
        brandId: "br-x",
        platform: "instagram",
        url: "https://instagram.com/reel/link",
        handle: "@a",
        ownerId: "emp-ramiz",
        status: "active",
        notes: "",
        lastViews: 100,
        lastCheckedAt: "2026-05-28T12:00:00Z",
      },
    ];
    const reels: WeekBrandReel[] = [
      {
        id: "wr-link",
        employeeId: "emp-ramiz",
        weekStart: "2026-05-26",
        brandId: "br-x",
        brandLinkId: "bl-1",
        contentUrl: "https://instagram.com/reel/link",
        platform: "Instagram",
        publishedAt: "2026-05-27T14:00:00.000Z",
        createdAt: "2026-05-27T14:00:00.000Z",
        notes: "",
      },
    ];
    const { byDate } = buildStreamerActivity("emp-ramiz", reels, [], { brandLinks: links });
    expect(byDate.get("2026-05-27")?.[0]?.source).toBe("link");
  });
});
