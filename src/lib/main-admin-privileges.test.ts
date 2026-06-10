import { describe, expect, it } from "vitest";
import {
  ALL_ORG_CAPABILITIES,
  flattenMainAdminPrivileges,
  isMainAdminPrincipal,
  mainAdminHasOrgCapability,
} from "./main-admin-privileges";

describe("main-admin-privileges", () => {
  it("detects orkun by id and username", () => {
    expect(isMainAdminPrincipal({ id: "u-admin", username: "x" })).toBe(true);
    expect(isMainAdminPrincipal({ id: "other", username: "ORKUN" })).toBe(true);
    expect(isMainAdminPrincipal({ id: "other", username: "ramiz" })).toBe(false);
  });

  it("grants every org capability to main admin", () => {
    for (const cap of ALL_ORG_CAPABILITIES) {
      expect(mainAdminHasOrgCapability(cap)).toBe(true);
    }
  });

  it("lists detailed privilege catalog", () => {
    const flat = flattenMainAdminPrivileges();
    expect(flat.length).toBeGreaterThan(25);
    expect(flat.some((p) => p.key === "social_discovery")).toBe(true);
    expect(flat.some((p) => p.key === "undeletable")).toBe(true);
  });
});
