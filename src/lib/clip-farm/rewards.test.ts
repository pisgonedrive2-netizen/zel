import { describe, expect, it } from "vitest";
import { monthlySummaries, submissionFlags, videoEarning } from "@/lib/clip-farm/rewards";
import type { ClipCampaign, ClipCreator, ClipSnapshot, ClipSubmission } from "@/lib/clip-farm/types";

const campaign: ClipCampaign = {
  id: "cc-1",
  title: "Test",
  description: "",
  status: "active",
  currency: "TRY",
  ratePer1kViews: 10,
  ratePerLike: 0.1,
  ratePerComment: 1,
  ratePerShare: 0,
  minViews: 1000,
  maxPerVideo: 2000,
  maxPerCreatorMonth: null,
  platforms: ["instagram", "tiktok", "youtube"],
  rules: "",
  startsOn: "2026-10-01",
  endsOn: null,
  createdAt: "2026-09-01",
};

const creator: ClipCreator = {
  id: "ccr-1",
  name: "Ali",
  contact: "@ali",
  email: "",
  payoutMethod: "IBAN",
  payoutDetails: "TR00",
  accounts: [{ platform: "tiktok", handle: "ali" }],
  status: "pending",
  notes: "",
  createdAt: "2026-09-01",
};

function sub(p: Partial<ClipSubmission>): ClipSubmission {
  return {
    id: "cs-1",
    campaignId: "cc-1",
    creatorId: "ccr-1",
    url: "https://www.tiktok.com/@ali/video/1",
    mediaKey: "tiktok:1",
    platform: "tiktok",
    accountHandle: "ali",
    status: "approved",
    source: "creator",
    rejectReason: "",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    publishedAt: null,
    lastCheckedAt: "2026-10-09",
    lastCheckError: null,
    reviewedAt: null,
    createdAt: "2026-09-10T00:00:00Z",
    ...p,
  };
}

describe("clip rewards", () => {
  it("applies rates, minimum views and per-video cap", () => {
    expect(videoEarning({ views: 999, likes: 500, comments: 50, shares: 0 }, campaign)).toBe(0);
    expect(videoEarning({ views: 50_000, likes: 1000, comments: 20, shares: 0 }, campaign)).toBe(620);
    expect(videoEarning({ views: 10_000_000, likes: 0, comments: 0, shares: 0 }, campaign)).toBe(2000);
  });

  it("pays only the growth inside the month", () => {
    const s = sub({ views: 80_000 });
    const snaps: ClipSnapshot[] = [{ submissionId: "cs-1", date: "2026-09-30", views: 30_000, likes: 0, comments: 0, shares: 0 }];
    const base = { campaigns: [campaign], creators: [creator], submissions: [s], snapshots: snaps, payouts: [] };
    const sep = monthlySummaries({ ...base, monthYm: "2026-09", todayYm: "2026-10" });
    expect(sep[0].due).toBe(300);
    const oct = monthlySummaries({ ...base, monthYm: "2026-10", todayYm: "2026-10" });
    expect(oct[0].due).toBe(500);
  });

  it("ignores pending videos and applies the monthly creator cap", () => {
    const capped = { ...campaign, maxPerCreatorMonth: 100 };
    const rows = monthlySummaries({
      monthYm: "2026-10",
      todayYm: "2026-10",
      campaigns: [capped],
      creators: [creator],
      submissions: [sub({ views: 50_000 }), sub({ id: "cs-2", status: "pending", views: 90_000 })],
      snapshots: [],
      payouts: [],
    });
    expect(rows[0].lines).toHaveLength(1);
    expect(rows[0]).toMatchObject({ gross: 500, due: 100, capped: true });
  });

  it("flags foreign accounts, early videos and low engagement", () => {
    const flags = submissionFlags(
      sub({ accountHandle: "baskasi", publishedAt: "2026-09-20T00:00:00Z", views: 100_000, likes: 10, comments: 1 }),
      creator,
      campaign
    );
    expect(flags).toEqual(["account", "early", "engagement"]);
  });
});
