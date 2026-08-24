import { describe, expect, it } from "vitest";
import {
  displayPlatformFromUrl,
  handleFromContentUrl,
  parseBrandPostId,
  pickNonDecreasingViews,
  planAchievementBrandLink,
} from "./assign-achievement-brand-helpers";
import { normalizeBrandLinkUrl } from "@/lib/brand-link-url";

describe("assign-achievement-brand helpers", () => {
  it("detects YouTube Shorts platform and video id handle", () => {
    const url = "https://www.youtube.com/shorts/bfrUa_f0c34";
    expect(displayPlatformFromUrl(url)).toBe("YouTube");
    expect(handleFromContentUrl(url)).toBe("bfrUa_f0c34");
    expect(normalizeBrandLinkUrl(url)).toBe("youtube:video:bfrUa_f0c34");
  });

  it("keeps youtu.be and shorts as the same video", () => {
    expect(normalizeBrandLinkUrl("https://youtu.be/bfrUa_f0c34")).toBe(
      normalizeBrandLinkUrl("https://www.youtube.com/shorts/bfrUa_f0c34")
    );
  });

  it("parses brand post ids", () => {
    expect(parseBrandPostId("post-bp-1")).toBe("bp-1");
    expect(parseBrandPostId("wr-abc")).toBeNull();
  });
});

describe("pickNonDecreasingViews", () => {
  it("keeps the higher number", () => {
    expect(pickNonDecreasingViews(100, 80)).toBe(100);
    expect(pickNonDecreasingViews(80, 120)).toBe(120);
  });

  it("fills a missing side", () => {
    expect(pickNonDecreasingViews(null, 50)).toBe(50);
    expect(pickNonDecreasingViews(40, null)).toBe(40);
    expect(pickNonDecreasingViews(null, null)).toBeNull();
  });
});

describe("planAchievementBrandLink", () => {
  it("creates when the post has no link yet", () => {
    expect(planAchievementBrandLink({ targetBrandId: "b1" })).toEqual({ kind: "create" });
  });

  it("reuses the same brand link", () => {
    expect(
      planAchievementBrandLink({
        targetBrandId: "b1",
        currentLink: { id: "bl-1", brandId: "b1" },
      })
    ).toEqual({ kind: "reuse", linkId: "bl-1" });
  });

  it("moves the link when the brand changes", () => {
    expect(
      planAchievementBrandLink({
        targetBrandId: "b2",
        currentLink: { id: "bl-1", brandId: "b1" },
      })
    ).toEqual({ kind: "move", linkId: "bl-1" });
  });

  it("merges onto the target duplicate instead of double-counting", () => {
    expect(
      planAchievementBrandLink({
        targetBrandId: "b2",
        currentLink: { id: "bl-old", brandId: "b1" },
        duplicateOnTarget: { id: "bl-new" },
      })
    ).toEqual({ kind: "merge", keepId: "bl-new", dropId: "bl-old" });
  });
});
