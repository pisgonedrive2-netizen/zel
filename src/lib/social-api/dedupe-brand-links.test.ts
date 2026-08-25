import { describe, expect, it } from "vitest";
import { normalizeBrandLinkUrl } from "@/lib/brand-link-url";
import {
  findDuplicateBrandLinkGroups,
  pickKeepBrandLink,
} from "@/lib/social-api/dedupe-brand-links";
import type { BrandLink } from "@/store/store";

const base = (partial: Partial<BrandLink> & Pick<BrandLink, "id" | "url">): BrandLink => ({
  brandId: "br-x",
  platform: "Instagram",
  handle: "",
  status: "active",
  notes: "",
  ...partial,
});

describe("instagram normalize media id", () => {
  it("reel ve /user/reel aynı anahtar", () => {
    expect(normalizeBrandLinkUrl("https://www.instagram.com/reel/DYgu24Js947/?igsh=x")).toBe(
      "instagram:media:DYgu24Js947"
    );
    expect(
      normalizeBrandLinkUrl("https://www.instagram.com/lanetkeliledunyaturu/reel/DYgu24Js947/?hl=tr")
    ).toBe("instagram:media:DYgu24Js947");
  });
});

describe("findDuplicateBrandLinkGroups", () => {
  it("aynı marka + aynı içerik için fazla kayıtları listeler", () => {
    const a = base({
      id: "1",
      url: "https://www.instagram.com/reel/ABC123/",
      lastViews: 100,
      createdAt: "2026-01-01",
    });
    const b = base({
      id: "2",
      url: "https://www.instagram.com/foo/reel/ABC123/",
      lastViews: 500,
      createdAt: "2026-02-01",
    });
    const groups = findDuplicateBrandLinkGroups([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepId).toBe("2");
    expect(groups[0].dropIds).toEqual(["1"]);
  });

  it("boş URL’leri çift saymaz", () => {
    const a = base({ id: "1", url: "", platform: "Instagram" });
    const b = base({ id: "2", url: "", platform: "TikTok" });
    expect(findDuplicateBrandLinkGroups([a, b])).toHaveLength(0);
  });
});

describe("pickKeepBrandLink", () => {
  it("yüksek izlenmeyi tercih eder", () => {
    const keep = pickKeepBrandLink([
      base({ id: "low", url: "https://youtu.be/x", lastViews: 10 }),
      base({ id: "high", url: "https://youtu.be/x", lastViews: 99 }),
    ]);
    expect(keep.id).toBe("high");
  });
});
