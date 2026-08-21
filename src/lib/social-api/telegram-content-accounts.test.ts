import { describe, expect, it } from "vitest";
import {
  idsAfterAddAccount,
  isFreshEnoughForTelegram,
  isTelegramAccountWatched,
  matchCatalogAccountId,
  parseTelegramAccountIds,
  pickTelegramPollAccountIds,
  profileUrlFromHandle,
} from "./telegram-content-accounts";

describe("parseTelegramAccountIds", () => {
  it("treats missing as all accounts", () => {
    expect(parseTelegramAccountIds(undefined)).toBeNull();
    expect(parseTelegramAccountIds(null)).toBeNull();
  });

  it("keeps an empty list as none", () => {
    expect(parseTelegramAccountIds([])).toEqual([]);
  });

  it("dedupes ids", () => {
    expect(parseTelegramAccountIds(["a", " a ", "b"])).toEqual(["a", "b"]);
  });
});

describe("isTelegramAccountWatched", () => {
  it("watches every account when list is unset", () => {
    expect(isTelegramAccountWatched("sa-1", null)).toBe(true);
  });

  it("filters to the saved list", () => {
    expect(isTelegramAccountWatched("sa-1", ["sa-2"])).toBe(false);
    expect(isTelegramAccountWatched("sa-2", ["sa-2"])).toBe(true);
  });
});

describe("idsAfterAddAccount", () => {
  it("stays implicit-all when adding", () => {
    expect(idsAfterAddAccount(null, "sa-1")).toBeNull();
  });

  it("appends to an explicit list", () => {
    expect(idsAfterAddAccount(["sa-1"], "sa-2")).toEqual(["sa-1", "sa-2"]);
  });
});

describe("isFreshEnoughForTelegram", () => {
  it("accepts a post from a few minutes ago", () => {
    const now = Date.parse("2026-08-21T10:26:00Z");
    expect(isFreshEnoughForTelegram("2026-08-21T10:24:07.000Z", now, 4)).toBe(true);
  });

  it("rejects an older reel so archive is not dumped", () => {
    const now = Date.parse("2026-08-21T10:26:00Z");
    expect(isFreshEnoughForTelegram("2026-08-21T07:47:31.000Z", now, 2)).toBe(false);
  });
});

describe("pickTelegramPollAccountIds", () => {
  it("puts lanetkelvlog first", () => {
    expect(
      pickTelegramPollAccountIds(
        [
          { id: "ig-a", handle: "other", platform: "Instagram" },
          { id: "ig-v", handle: "lanetkelvlog", platform: "Instagram" },
          { id: "yt", handle: "lanetkelvlog", platform: "YouTube" },
        ],
        2
      )
    ).toEqual(["ig-v", "yt"]);
  });
});

describe("matchCatalogAccountId", () => {
  it("matches youtube handle case-insensitively", () => {
    expect(
      matchCatalogAccountId(
        {
          id: "sa-ramiz-yt-vlog",
          platform: "YouTube",
          handle: "lanetkelvlog",
          url: "https://www.youtube.com/@lanetkelvlog",
        },
        [{ id: "db-1", platform: "YouTube", handle: "Lanetkelvlog" }]
      )
    ).toBe("db-1");
  });
});

describe("profileUrlFromHandle", () => {
  it("builds instagram and tiktok urls", () => {
    expect(profileUrlFromHandle("Instagram", "foo", "")).toBe("https://www.instagram.com/foo/");
    expect(profileUrlFromHandle("TikTok", "@bar", "")).toBe("https://www.tiktok.com/@bar");
  });
});
