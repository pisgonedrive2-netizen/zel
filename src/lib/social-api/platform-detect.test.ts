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

  it("detects Instagram profile with /reels/ subpath", () => {
    const d = detectPlatform("https://www.instagram.com/foxstreaming/reels/", "Instagram");
    expect(d?.platform).toBe("instagram");
    expect(d?.kind).toBe("user");
    expect(d?.externalRef).toBe("foxstreaming");
  });

  it("detects Instagram reel nested under username", () => {
    const d = detectPlatform(
      "https://www.instagram.com/foxstreaming/reel/ABC123xyz/",
      "Instagram"
    );
    expect(d?.platform).toBe("instagram");
    expect(d?.kind).toBe("video");
    expect(d?.externalRef).toBe("ABC123xyz");
  });

  it("detects Instagram from handle when URL path is unrecognized", () => {
    const d = resolveLinkDetection({
      url: "https://www.instagram.com/stories/highlights/12345/",
      platform: "Instagram",
      handle: "foxstreaming",
    });
    expect(d?.platform).toBe("instagram");
    expect(d?.externalRef).toBe("foxstreaming");
    expect(d?.kind).toBe("user");
  });

  it("detects Instagram share link as media", () => {
    const d = detectPlatform("https://www.instagram.com/share/AbCdEfGh/", "Instagram");
    expect(d?.platform).toBe("instagram");
    expect(d?.kind).toBe("video");
    expect(d?.externalRef).toBe("AbCdEfGh");
  });

  it("detects Instagram profile from handle only (empty url)", () => {
    const d = resolveLinkDetection({
      url: "",
      platform: "Instagram",
      handle: "@brandname",
    });
    expect(d?.platform).toBe("instagram");
    expect(d?.externalRef).toBe("brandname");
  });

  it("treats TikTok short link as a video (resolved via redirect), not the user handle", () => {
    // Kısa link + handle gibi (sayısal olmayan) saklı ref → kısa kodu video say.
    // Aksi halde tüm kısa linkler aynı kullanıcının toplam izlenmesini gösterirdi.
    const d = resolveLinkDetection({
      url: "https://vm.tiktok.com/ZZZ/",
      platform: "TikTok",
      handle: "",
      externalRef: "lucy",
    });
    expect(d?.platform).toBe("tiktok");
    expect(d?.kind).toBe("video");
    expect(d?.externalRef).toBe("ZZZ");
    expect(d?.sourceUrl).toContain("vm.tiktok.com/ZZZ");
  });

  it("detects YouTube watch?v= as the video even with a stored channel handle + timestamp", () => {
    // Regresyon: /watch placeholder sayılıp handle ile kanala dönüşüyordu →
    // her video kanal toplam izlenmesini çekiyordu.
    const d = resolveLinkDetection({
      url: "https://www.youtube.com/watch?v=gs3J65eUWfU&t=21s",
      platform: "YouTube",
      handle: "@lanetkeltur",
      externalRef: "@lanetkeltur",
    });
    expect(d?.platform).toBe("youtube");
    expect(d?.kind).toBe("video");
    expect(d?.externalRef).toBe("gs3J65eUWfU");
  });

  it("prefers a stored numeric video id for TikTok short links", () => {
    const d = resolveLinkDetection({
      url: "https://vt.tiktok.com/ABC123/",
      platform: "TikTok",
      handle: "",
      externalRef: "7412345678901234567",
    });
    expect(d?.platform).toBe("tiktok");
    expect(d?.kind).toBe("video");
    expect(d?.externalRef).toBe("7412345678901234567");
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
