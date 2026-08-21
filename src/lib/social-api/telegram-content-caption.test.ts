import { describe, expect, it } from "vitest";
import { buildContentCaption } from "./telegram-content-caption";

describe("buildContentCaption", () => {
  it("always includes the post URL", () => {
    expect(
      buildContentCaption({
        employeeName: "Ramiz",
        platform: "Instagram",
        url: "https://www.instagram.com/reel/DcTHQhvsoMp/",
        handle: "lanetkelvlog",
      })
    ).toBe("Ramiz · lanetkelvlog · Instagram\nhttps://www.instagram.com/reel/DcTHQhvsoMp/");
  });
});
