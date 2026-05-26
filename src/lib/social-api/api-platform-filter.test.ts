import { describe, expect, it } from "vitest";
import { isSupportedApiPlatform, splitActiveLinksByApiSupport } from "./api-platform-filter";
import type { BrandLink } from "@/store/store";

const link = (platform: string, status: BrandLink["status"] = "active"): BrandLink =>
  ({
    id: "l1",
    brandId: "b1",
    platform,
    status,
    url: "https://example.com",
    handle: "h",
    ownerId: "e1",
  }) as BrandLink;

describe("isSupportedApiPlatform", () => {
  it("recognizes major platforms", () => {
    expect(isSupportedApiPlatform("YouTube")).toBe(true);
    expect(isSupportedApiPlatform("instagram")).toBe(true);
    expect(isSupportedApiPlatform("TikTok")).toBe(true);
  });

  it("rejects other platforms", () => {
    expect(isSupportedApiPlatform("Twitch")).toBe(false);
    expect(isSupportedApiPlatform("Kick")).toBe(false);
  });
});

describe("splitActiveLinksByApiSupport", () => {
  it("splits active links", () => {
    const { apiLinks, otherLinks } = splitActiveLinksByApiSupport([
      link("YouTube"),
      link("Twitch"),
      link("Instagram", "inactive"),
    ]);
    expect(apiLinks).toHaveLength(1);
    expect(otherLinks).toHaveLength(1);
  });
});
