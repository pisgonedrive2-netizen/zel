import { describe, expect, it } from "vitest";
import { brandLinkFromPayload } from "@/lib/db/client-payload";

describe("brandLinkFromPayload", () => {
  it("reads ownerId from camelCase store payload", () => {
    const link = brandLinkFromPayload({
      id: "bl-1",
      brandId: "brand-x",
      platform: "Instagram",
      handle: "@ramiz",
      url: "https://instagram.com/ramiz",
      ownerId: "emp-ramiz",
      status: "active",
      notes: "",
    });
    expect(link.ownerId).toBe("emp-ramiz");
  });

  it("reads owner_id from snake_case db row", () => {
    const link = brandLinkFromPayload({
      id: "bl-1",
      brand_id: "brand-x",
      platform: "Instagram",
      handle: "@ramiz",
      url: "https://instagram.com/ramiz",
      owner_id: "emp-ramiz",
      status: "active",
      notes: "",
    });
    expect(link.ownerId).toBe("emp-ramiz");
  });
});
