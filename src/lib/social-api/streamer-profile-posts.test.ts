import { describe, expect, it } from "vitest";
import {
  parseInstagramMediaList,
  parseYouTubeChannelVideos,
  pickIgUserId,
} from "./streamer-profile-posts";

describe("pickIgUserId", () => {
  it("reads numeric pk at root", () => {
    expect(pickIgUserId({ pk: 70823938693, pk_id: "70823938693" })).toBe("70823938693");
  });

  it("reads nested data.user pk without string pk_id", () => {
    expect(pickIgUserId({ data: { user: { pk: 25025320 } } })).toBe("25025320");
  });

  it("ignores non-numeric id strings", () => {
    expect(pickIgUserId({ id: "not-an-id", pk_id: "70823938693" })).toBe("70823938693");
  });
});

describe("parseInstagramMediaList", () => {
  it("parses feed items with unix taken_at", () => {
    const items = parseInstagramMediaList(
      {
        items: [
          {
            code: "DcLgk7Dtwra",
            media_type: 2,
            product_type: "clips",
            taken_at: 1787052633,
            caption: { text: "dün" },
          },
        ],
      },
      "feed"
    );
    expect(items).toHaveLength(1);
    expect(items[0].url).toContain("/reel/DcLgk7Dtwra");
    expect(items[0].publishedAt).toContain("2026-08-18");
    expect(items[0].externalRef).toBe("DcLgk7Dtwra");
  });

  it("parses reels nested under data.items[].media", () => {
    const items = parseInstagramMediaList(
      {
        status: "ok",
        data: {
          items: [{ media: { code: "AbcDef12345", taken_at: 1787052633, media_type: 2 } }],
        },
      },
      "reels"
    );
    expect(items[0].externalRef).toBe("AbcDef12345");
    expect(items[0].contentType).toBe("reels");
    expect(items[0].publishedAt).toBeTruthy();
  });
});

describe("parseYouTubeChannelVideos", () => {
  it("reads youtube138 contents[] instead of videos[]", () => {
    const items = parseYouTubeChannelVideos({
      contents: [
        { videoId: "dQw4w9WgXcQ", title: "Latest", publishedAt: "2026-08-18T10:00:00Z" },
      ],
      cursorNext: "x",
    });
    expect(items).toHaveLength(1);
    expect(items[0].url).toContain("dQw4w9WgXcQ");
    expect(items[0].publishedAt).toContain("2026-08-18");
  });

  it("marks shorts_latest as reels", () => {
    const items = parseYouTubeChannelVideos(
      { contents: [{ videoId: "short11char" }] },
      true
    );
    expect(items[0].contentType).toBe("reels");
    expect(items[0].url).toContain("/shorts/");
  });
});
