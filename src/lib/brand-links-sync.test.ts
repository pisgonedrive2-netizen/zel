import { describe, it, expect } from "vitest";
import { filterBrandLinksWithValidBrands } from "./brand-links-sync";
import type { BrandLink } from "@/store/store";

describe("filterBrandLinksWithValidBrands", () => {
  it("drops links whose brand_id is unknown", () => {
    const links: BrandLink[] = [
      {
        id: "bl-1",
        brandId: "br-ok",
        platform: "Instagram",
        handle: "a",
        url: "https://x",
        status: "active",
        notes: "",
      },
      {
        id: "bl-2",
        brandId: "br-missing",
        platform: "YouTube",
        handle: "b",
        url: "https://y",
        status: "active",
        notes: "",
      },
    ];
    const out = filterBrandLinksWithValidBrands(links, new Set(["br-ok"]));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("bl-1");
  });
});
