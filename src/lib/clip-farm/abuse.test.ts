import { describe, expect, it } from "vitest";
import { creatorRisk, normalizeClipContact } from "@/lib/clip-farm/abuse";
import type { ClipCreator, ClipSubmission } from "@/lib/clip-farm/types";

describe("clip abuse helpers", () => {
  it("normalizes telegram and phone contacts", () => {
    expect(normalizeClipContact("@KelAdam")).toBe("keladam");
    expect(normalizeClipContact("https://t.me/KelAdam")).toBe("keladam");
    expect(normalizeClipContact("0532 111 22 33")).toBe("5321112233");
    expect(normalizeClipContact("+905321112233")).toBe("5321112233");
  });

  it("flags duplicate contacts and pending floods", () => {
    const base: ClipCreator = {
      id: "a",
      name: "A",
      contact: "@same",
      contactNorm: "same",
      email: "",
      payoutMethod: "",
      payoutDetails: "",
      accounts: [],
      status: "pending",
      notes: "",
      createdAt: "2026-10-01T00:00:00Z",
    };
    const twin = { ...base, id: "b", name: "B" };
    const now = new Date().toISOString();
    const subs: ClipSubmission[] = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      campaignId: "c",
      creatorId: "a",
      url: `https://tiktok.com/@x/video/${i}`,
      mediaKey: `tiktok:${i}`,
      platform: "tiktok",
      accountHandle: "x",
      status: "pending",
      source: "creator",
      rejectReason: "",
      views: null,
      likes: null,
      comments: null,
      shares: null,
      publishedAt: null,
      lastCheckedAt: null,
      lastCheckError: null,
      reviewedAt: null,
      createdAt: now,
    }));
    const risk = creatorRisk(base, subs, [base, twin]);
    expect(risk.level).not.toBe("ok");
    expect(risk.labels.some((l) => /bekleyen|aynı iletişim/i.test(l))).toBe(true);
  });
});
