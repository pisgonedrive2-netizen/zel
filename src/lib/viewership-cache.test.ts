import { describe, expect, it } from "vitest";
import {
  filterViewershipByBrandIds,
  preferRicherViewership,
} from "./viewership-cache";
import type { BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";

const link = (id: string, brandId: string): BrandLink => ({
  id,
  brandId,
  platform: "Instagram",
  handle: "@x",
  url: "https://instagram.com/x",
  status: "active",
  notes: "",
  autoTrack: true,
});

describe("filterViewershipByBrandIds", () => {
  it("drops links, snapshots and viewership for removed brands", () => {
    const snapshots: LinkSnapshot[] = [
      {
        id: "ls-1",
        linkId: "bl-a",
        date: "2026-05-01",
        views: 100,
        likes: 0,
        comments: 0,
        shares: 0,
        notes: "",
      },
      {
        id: "ls-2",
        linkId: "bl-b",
        date: "2026-05-01",
        views: 50,
        likes: 0,
        comments: 0,
        shares: 0,
        notes: "",
      },
    ];
    const viewership: BrandViewership[] = [
      {
        id: "bv-1",
        brandId: "br-a",
        brandName: "A",
        employeeId: "emp-1",
        month: "2026-05",
        views: 100,
        url: "https://instagram.com/a",
        notes: "",
      },
      {
        id: "bv-2",
        brandId: "br-b",
        brandName: "B",
        employeeId: "emp-1",
        month: "2026-05",
        views: 50,
        url: "https://instagram.com/b",
        notes: "",
      },
    ];
    const out = filterViewershipByBrandIds(
      {
        brandLinks: [link("bl-a", "br-a"), link("bl-b", "br-b")],
        linkSnapshots: snapshots,
        brandViewership: viewership,
      },
      new Set(["br-a"])
    );
    expect(out.brandLinks.map((l) => l.id)).toEqual(["bl-a"]);
    expect(out.linkSnapshots.map((s) => s.id)).toEqual(["ls-1"]);
    expect(out.brandViewership.map((v) => v.id)).toEqual(["bv-1"]);
  });
});

describe("preferRicherViewership", () => {
  it("filters cache orphans when server brand list is narrower", () => {
    const server = {
      brandLinks: [link("bl-a", "br-a")],
      linkSnapshots: [],
      brandViewership: [],
    };
    const cache = {
      savedAt: new Date().toISOString(),
      brandLinks: [
        link("bl-a", "br-a"),
        { ...link("bl-b", "br-b"), lastViews: 99999 },
      ],
      linkSnapshots: [],
      brandViewership: [],
    };
    const out = preferRicherViewership(server, cache, new Set(["br-a"]));
    expect(out.brandLinks.map((l) => l.id)).toEqual(["bl-a"]);
  });
});
