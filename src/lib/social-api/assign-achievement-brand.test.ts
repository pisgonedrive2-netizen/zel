import { describe, expect, it } from "vitest";
import {
  displayPlatformFromUrl,
  handleFromContentUrl,
  parseBrandPostId,
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
