import { describe, expect, it } from "vitest";
import {
  classifyBrandLinkUrl,
  isBrandLinkContentUrl,
  isBrandLinkProfileUrl,
  isBrandLinkShell,
} from "./brand-link-kind";

describe("brand-link-kind", () => {
  it("shell = empty url", () => {
    expect(isBrandLinkShell("")).toBe(true);
    expect(isBrandLinkShell("  ")).toBe(true);
    expect(classifyBrandLinkUrl("")).toBe("shell");
  });

  it("instagram profile vs reel", () => {
    expect(isBrandLinkProfileUrl("https://www.instagram.com/lanetkelim.o?igsh=x")).toBe(true);
    expect(isBrandLinkContentUrl("https://www.instagram.com/reel/AbC123/")).toBe(true);
    expect(isBrandLinkProfileUrl("https://www.instagram.com/reel/AbC123/")).toBe(false);
  });

  it("tiktok short and video are content", () => {
    expect(isBrandLinkContentUrl("https://vt.tiktok.com/ZSC6vpB4m/")).toBe(true);
    expect(isBrandLinkContentUrl("https://www.tiktok.com/@u/video/123")).toBe(true);
    expect(isBrandLinkProfileUrl("https://www.tiktok.com/@lanetkeltv")).toBe(true);
  });

  it("youtube shorts content, channel profile", () => {
    expect(isBrandLinkContentUrl("https://www.youtube.com/shorts/abc")).toBe(true);
    expect(isBrandLinkProfileUrl("https://www.youtube.com/@channel")).toBe(true);
  });
});
