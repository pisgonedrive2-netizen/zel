import { describe, expect, it } from "vitest";
import {
  extractDirectVideoUrl,
  pickYoutubeProgressiveMp4,
} from "./content-media-url";
import { buildContentCaption } from "./telegram-content-caption";

describe("extractDirectVideoUrl", () => {
  it("picks TikTok hdplay", () => {
    expect(
      extractDirectVideoUrl({
        data: {
          hdplay: "https://v16.tiktokcdn.com/x/video.mp4",
          play: "https://v16.tiktokcdn.com/x/wm.mp4",
        },
      })
    ).toBe("https://v16.tiktokcdn.com/x/video.mp4");
  });

  it("picks Instagram video_url", () => {
    expect(
      extractDirectVideoUrl({
        video_url: "https://scontent.cdninstagram.com/v/t50.2886-16/a.mp4?_nc=1",
      })
    ).toContain("cdninstagram.com");
  });

  it("ignores page URLs", () => {
    expect(extractDirectVideoUrl({ url: "https://www.youtube.com/shorts/abc" })).toBeNull();
  });
});

describe("pickYoutubeProgressiveMp4", () => {
  it("prefers itag 18 under size cap", () => {
    const url = pickYoutubeProgressiveMp4([
      {
        itag: 137,
        mimeType: "video/mp4; codecs=\"avc1.640028\"",
        url: "https://googlevideo.com/videoonly",
        contentLength: "80000000",
      },
      {
        itag: 18,
        mimeType: "video/mp4; codecs=\"avc1.42001E, mp4a.40.2\"",
        url: "https://googlevideo.com/itag18",
        contentLength: "4200000",
        audioQuality: "AUDIO_QUALITY_LOW",
      },
    ]);
    expect(url).toBe("https://googlevideo.com/itag18");
  });
});

describe("buildContentCaption", () => {
  it("includes streamer, platform and url", () => {
    const c = buildContentCaption({
      employeeName: "Ramiz",
      platform: "YouTube",
      url: "https://www.youtube.com/shorts/abc",
      handle: "@ramiz",
    });
    expect(c).toContain("Ramiz");
    expect(c).toContain("YouTube");
    expect(c).toContain("shorts/abc");
  });
});
