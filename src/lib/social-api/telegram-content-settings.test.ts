import { describe, expect, it } from "vitest";
import { parseTelegramGroups } from "./telegram-content-settings";

describe("parseTelegramGroups", () => {
  it("keeps only negative group ids", () => {
    expect(
      parseTelegramGroups([
        { id: "-100123", title: "İçerik", type: "supergroup" },
        { id: "8861342974", title: "ben", type: "private" },
        { id: 42, title: "kişi" },
      ])
    ).toEqual([{ id: "-100123", title: "İçerik", type: "supergroup" }]);
  });
});
