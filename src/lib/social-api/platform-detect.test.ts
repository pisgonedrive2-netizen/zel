import { describe, expect, it } from "vitest";
import {
  buildUrlFromHandle,
  detectPlatform,
  isAutoTrackable,
  resolveLinkDetection,
} from "./platform-detect";

describe("platform-detect", () => {
  it("builds TikTok URL from handle when url is empty", () => {
    const d = resolveLinkDetection({
      url: "",
      platform: "TikTok",
      handle: "@lucy",
    });
    expect(d?.platform).toBe("tiktok");
    expect(d?.externalRef).toBe("lucy");
    expect(d?.kind).toBe("user");
  });

  it("detects TikTok video from full URL", () => {
    const d = detectPlatform(
      "https://www.tiktok.com/@lucy/video/7516594811734854943",
      "TikTok"
    );
    expect(d?.platform).toBe("tiktok");
    expect(d?.kind).toBe("video");
    expect(d?.externalRef).toBe("7516594811734854943");
  });

  it("detects Instagram reel shortcode", () => {
    const d = detectPlatform("https://www.instagram.com/reel/ABC123xyz/", "Instagram");
    expect(d?.platform).toBe("instagram");
    expect(d?.kind).toBe("video");
    expect(d?.externalRef).toBe("ABC123xyz");
  });

  it("falls back to stored external_ref for TikTok", () => {
    const d = resolveLinkDetection({
      url: "https://vm.tiktok.com/ZZZ/",
      platform: "TikTok",
      handle: "",
      externalRef: "lucy",
    });
    expect(d?.platform).toBe("tiktok");
    expect(d?.externalRef).toBe("lucy");
  });

  it("isAutoTrackable for placeholder tiktok url + handle", () => {
    expect(
      isAutoTrackable("https://tiktok.com/@", "TikTok", "lucy")
    ).toBe(true);
  });

  it("detects YouTube shorts", () => {
    const d = detectPlatform("https://youtube.com/shorts/abcdEFG12hi", "YouTube");
    expect(d?.platform).toBe("youtube");
    expect(d?.kind).toBe("video");
  });
});
