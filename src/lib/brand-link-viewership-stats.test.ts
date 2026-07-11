import { describe, expect, it } from "vitest";
import {
  computeBrandLinkViewershipStats,
  linkAddedInMonth,
  linkLatestViews,
} from "./brand-link-viewership-stats";
import type { BrandLink, LinkSnapshot } from "@/store/store";

const link = (id: string, brandId: string, createdAt?: string): BrandLink => ({
  id,
  brandId,
  platform: "YouTube",
  handle: "@test",
  url: "https://youtube.com/watch?v=1",
  status: "active",
  notes: "",
  createdAt,
});

describe("brand-link-viewership-stats", () => {
  it("sums lifetime, month snapshot, and month gain", () => {
    const links = [link("l1", "br-1", "2026-05-10"), link("l2", "br-1", "2026-06-02")];
    const snapshots: LinkSnapshot[] = [
      { id: "s1", linkId: "l1", date: "2026-05-31", views: 1000, notes: "" },
      { id: "s2", linkId: "l1", date: "2026-06-30", views: 5000, notes: "" },
      { id: "s3", linkId: "l2", date: "2026-06-15", views: 800, notes: "" },
    ];
    const stats = computeBrandLinkViewershipStats(links, snapshots, "2026-06", "2026-06");
    // Ay sonu kümülatif snapshot
    expect(stats.monthTotalViews).toBe(5800);
    expect(stats.lifetimeTotalViews).toBe(5800);
    // Ay içi artış: l1 5000-1000=4000, l2 800-0=800
    expect(stats.monthTotalGain).toBe(4800);
    expect(stats.linksAddedInMonth).toBe(1);
    expect(stats.viewsFromLinksAddedInMonth).toBe(800);
    expect(stats.gainFromLinksAddedInMonth).toBe(800);
    expect(stats.cohortLifetimeViews).toBe(800);
    expect(stats.perLinkRows).toHaveLength(2);
    expect(linkAddedInMonth(links[1], "2026-06", snapshots)).toBe(true);
    expect(linkLatestViews(links[0], snapshots)).toBe(5000);
    const june = stats.monthlyBreakdown.find((r) => r.monthYm === "2026-06");
    expect(june?.totalGain).toBe(4800);
    expect(june?.totalViews).toBe(5800);
  });
});
