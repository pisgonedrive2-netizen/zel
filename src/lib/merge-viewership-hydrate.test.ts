import { describe, expect, it } from "vitest";
import { mergeCanonicalBrandLinks, mergeLinkSnapshotsHydrate } from "./merge-viewership-hydrate";
import { initialBrandLinks, type BrandLink, type LinkSnapshot } from "@/store/store";

describe("mergeCanonicalBrandLinks", () => {
  it("keeps stored URL when bootstrap sends empty placeholder", () => {
    const seed = initialBrandLinks[0];
    const rich: BrandLink = {
      ...seed,
      url: "https://instagram.com/ramiz",
      handle: "@ramiz",
      ownerId: "emp-ramiz",
      lastViews: 12000,
    };
    const out = mergeCanonicalBrandLinks([
      { ...seed, url: "", handle: "" },
      rich,
    ]);
    expect(out.find((l) => l.id === seed.id)?.url).toBe("https://instagram.com/ramiz");
  });
});

describe("mergeLinkSnapshotsHydrate", () => {
  it("does not wipe snapshots when incoming is empty", () => {
    const cur: LinkSnapshot[] = [
      {
        id: "ls-1",
        linkId: "bl-x",
        date: "2026-05-01",
        views: 100,
        likes: 0,
        comments: 0,
        shares: 0,
        notes: "",
      },
    ];
    expect(mergeLinkSnapshotsHydrate(cur, [])).toEqual(cur);
  });
});
