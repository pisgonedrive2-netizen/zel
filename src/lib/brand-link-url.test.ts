import { describe, expect, it } from "vitest";
import { dedupeBrandLinksByUrl, normalizeBrandLinkUrl } from "./brand-link-url";
import type { BrandLink } from "@/store/store";

describe("normalizeBrandLinkUrl", () => {
  it("youtube watch ve youtu.be aynı anahtar", () => {
    expect(
      normalizeBrandLinkUrl("https://www.youtube.com/watch?v=abc123&feature=share")
    ).toBe("youtube:video:abc123");
    expect(normalizeBrandLinkUrl("https://youtu.be/abc123")).toBe(
      "youtube:video:abc123"
    );
  });

  it("tiktok video id", () => {
    expect(
      normalizeBrandLinkUrl(
        "https://www.tiktok.com/@user/video/7123456789012345678?is_from_webapp=1"
      )
    ).toBe("tiktok:video:7123456789012345678");
  });
});

describe("dedupeBrandLinksByUrl", () => {
  const base = (id: string, url: string, views: number): BrandLink => ({
    id,
    brandId: "b1",
    platform: "TikTok",
    handle: "",
    url,
    status: "active",
    notes: "",
    lastViews: views,
  });

  it("aynı markada aynı video URL tek kayıt", () => {
    const a = base("1", "https://youtu.be/abc123", 100);
    const b = base("2", "https://www.youtube.com/watch?v=abc123", 5000);
    const out = dedupeBrandLinksByUrl([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("2");
  });

  it("farklı markada aynı URL korunur", () => {
    const a = { ...base("1", "https://youtu.be/abc123", 100), brandId: "b1" };
    const b = { ...base("2", "https://youtu.be/abc123", 200), brandId: "b2" };
    expect(dedupeBrandLinksByUrl([a, b])).toHaveLength(2);
  });
});
