import { describe, expect, it } from "vitest";
import { parseDiscoveryPayload } from "./discovery";

describe("parseDiscoveryPayload", () => {
  it("parses YouTube trending list", () => {
    const items = parseDiscoveryPayload("youtube", "trending", {
      list: [
        {
          title: "Test Video",
          videoId: "abc123",
          author: "Channel",
          viewCount: 1200000,
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Test Video");
    expect(items[0].url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(items[0].views).toBe(1200000);
  });

  it("parses YouTube search contents", () => {
    const items = parseDiscoveryPayload("youtube", "search", {
      contents: [
        {
          type: "video",
          video: {
            title: "Casino Stream",
            videoId: "xyz",
            author: { name: "Streamer" },
            stats: { views: 5000 },
          },
        },
      ],
    });
    expect(items[0].subtitle).toBe("Streamer");
    expect(items[0].url).toContain("xyz");
  });

  it("parses YouTube channel search results", () => {
    const items = parseDiscoveryPayload("youtube", "search", {
      contents: [
        {
          type: "channel",
          channel: {
            title: "Casino Channel",
            channelId: "UCabc123",
            subscriberCount: 120000,
          },
        },
      ],
    }, { searchType: "channel" });
    expect(items[0].kind).toBe("channel");
    expect(items[0].url).toContain("UCabc123");
  });

  it("parses Instagram hashtag discover results", () => {
    const items = parseDiscoveryPayload("instagram", "hashtag_discover", {
      data: {
        results: [{ name: "reels", media_count: 1200000, search_result_subtitle: "1.2M posts" }],
      },
    });
    expect(items[0].title).toBe("#reels");
    expect(items[0].kind).toBe("hashtag");
    expect(items[0].url).toContain("/explore/tags/reels");
  });

  it("parses Instagram hashtag section medias", () => {
    const items = parseDiscoveryPayload("instagram", "hashtag", {
      data: {
        sections: [
          {
            layout_content: {
              medias: [
                {
                  media: {
                    code: "ABC123",
                    media_type: 2,
                    caption: { text: "Hello reel" },
                    user: { username: "tester" },
                    play_count: 9000,
                  },
                },
              ],
            },
          },
        ],
      },
    });
    expect(items[0].title).toBe("Hello reel");
    expect(items[0].url).toBe("https://www.instagram.com/reel/ABC123/");
    expect(items[0].subtitle).toBe("@tester");
  });

  it("parses Instagram users_search root array", () => {
    const items = parseDiscoveryPayload("instagram", "user_search", [
      { username: "casino", full_name: "Casino Brand" },
    ]);
    expect(items[0].title).toBe("Casino Brand");
    expect(items[0].url).toBe("https://www.instagram.com/casino/");
  });

  it("parses TikTok feed search videos", () => {
    const items = parseDiscoveryPayload("tiktok", "search", {
      data: {
        videos: [
          {
            aweme_id: "111",
            title: "FYP clip",
            author: { unique_id: "creator" },
            play: 25000,
            digg_count: 1200,
          },
        ],
      },
    });
    expect(items[0].url).toContain("@creator/video/111");
    expect(items[0].views).toBe(25000);
    expect(items[0].likes).toBe(1200);
  });

  it("parses TikTok feed list array data", () => {
    const items = parseDiscoveryPayload("tiktok", "trending", {
      data: [{ video_id: "222", title: "Trend", region: "TR", play: 1000 }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Trend");
  });

  it("parses TikTok user search", () => {
    const items = parseDiscoveryPayload("tiktok", "user_search", {
      data: {
        user_list: [
          {
            user: { uniqueId: "c4sinooo", nickname: "CASINO" },
            stats: { followerCount: 50000 },
          },
        ],
      },
    });
    expect(items[0].subtitle).toBe("@c4sinooo");
    expect(items[0].views).toBe(50000);
  });

  it("parses TikTok challenge discover", () => {
    const items = parseDiscoveryPayload("tiktok", "hashtag_discover", {
      data: {
        challenge_list: [{ cha_name: "fyp", view_count: 999, user_count: 100 }],
      },
    });
    expect(items[0].title).toBe("#fyp");
    expect(items[0].kind).toBe("hashtag");
  });
});
