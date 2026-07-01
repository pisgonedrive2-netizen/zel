import { describe, expect, it } from "vitest";
import { linkViewsGainInMonth, snapshotViewsDelta, linkSiteLabel } from "@/lib/link-snapshot-delta";
import type { BrandLink, LinkSnapshot } from "@/store/store";

const link: BrandLink = {
  id: "bl-kick",
  brandId: "b1",
  platform: "Kick",
  handle: "Gala tanıtım",
  url: "https://kick.com/ramiz/video/123",
  status: "active",
  notes: "",
};

describe("snapshotViewsDelta", () => {
  it("returns full views when no previous", () => {
    expect(snapshotViewsDelta(5000, null)).toBe(5000);
  });
  it("returns difference when previous exists", () => {
    expect(snapshotViewsDelta(8000, 5000)).toBe(3000);
  });
});

describe("linkViewsGainInMonth", () => {
  it("computes gain from prior month snapshot", () => {
    const snaps: LinkSnapshot[] = [
      { id: "s1", linkId: "bl-kick", date: "2026-05-28", views: 2000, notes: "manual" },
      { id: "s2", linkId: "bl-kick", date: "2026-06-10", views: 7500, notes: "manual" },
    ];
    const r = linkViewsGainInMonth(link, "2026-06", snaps, "2026-07");
    expect(r.gain).toBe(5500);
    expect(r.latest).toBe(7500);
  });
});

describe("linkSiteLabel", () => {
  it("detects kick", () => {
    expect(linkSiteLabel("https://www.kick.com/foo")).toBe("Kick");
  });
});
