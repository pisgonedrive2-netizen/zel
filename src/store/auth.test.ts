import { describe, expect, it } from "vitest";
import { canAccess, landingFor } from "./auth";
import { canAccessPrim } from "@/lib/user-guards";
import { notificationsHrefForRole } from "@/lib/notification-href";

describe("canAccess", () => {
  it("allows public login route without role", () => {
    expect(canAccess("/login", null)).toBe(true);
  });

  it("blocks unauthenticated users from app routes", () => {
    expect(canAccess("/ozet", null)).toBe(false);
    expect(canAccess("/marka/anasayfa", null)).toBe(false);
  });

  it("allows admin on agency routes", () => {
    expect(canAccess("/ozet", "admin")).toBe(true);
    expect(canAccess("/izlenme/markalar", "admin")).toBe(true);
    expect(canAccess("/izlenme/api", "admin")).toBe(true);
  });

  it("allows auditor on read-only audit routes only", () => {
    expect(canAccess("/denetci", "auditor")).toBe(true);
    expect(canAccess("/izlenme", "auditor")).toBe(true);
    expect(canAccess("/izlenme/grafikler", "auditor")).toBe(true);
    expect(canAccess("/kullanicilar", "auditor")).toBe(false);
    expect(canAccess("/ozet", "auditor")).toBe(false);
  });

  it("scopes brand users to /marka", () => {
    expect(canAccess("/marka/izlenmeler", "brand")).toBe(true);
    expect(canAccess("/marka/kesif", "brand")).toBe(true);
    expect(canAccess("/izlenme", "brand")).toBe(false);
    expect(canAccess("/ozet", "brand")).toBe(false);
  });

  it("scopes streamer users to /yayinci", () => {
    expect(canAccess("/yayinci/izlenmeler", "streamer")).toBe(true);
    expect(canAccess("/yayinci/kesif", "streamer")).toBe(true);
    expect(canAccess("/marka/anasayfa", "streamer")).toBe(false);
  });

  it("lets admin open streamer panel while impersonating", () => {
    const panelViewAs = { employeeId: "e-1", employeeName: "Test" };
    expect(canAccess("/yayinci/maas", "admin", panelViewAs)).toBe(true);
    expect(canAccess("/yayinci/kesif", "admin", panelViewAs)).toBe(true);
  });

  it("lets admin open brand panel while impersonating", () => {
    const brandViewAs = { brandId: "b-1", brandName: "Test Brand" };
    expect(canAccess("/marka/havuz", "admin", null, brandViewAs)).toBe(true);
    expect(canAccess("/marka/kesif", "admin", null, brandViewAs)).toBe(true);
  });

  it("blocks prim route for everyone except main admin Orkun", () => {
    const orkun = { id: "u-admin", username: "orkun" };
    const otherAdmin = { id: "u-other", username: "admin2" };
    expect(canAccess("/prim", "admin", null, null, orkun)).toBe(true);
    expect(canAccess("/prim", "admin", null, null, otherAdmin)).toBe(false);
    expect(canAccess("/prim", "admin")).toBe(false);
    expect(canAccess("/prim", "auditor")).toBe(false);
    expect(canAccess("/prim", "streamer")).toBe(false);
    expect(canAccess("/prim", "brand")).toBe(false);
  });

  it("blocks prim during impersonation even for main admin session", () => {
    const impersonated = {
      id: "emp-ramiz",
      username: "ramiz",
      impersonatorId: "u-admin",
    };
    expect(canAccess("/prim", "streamer", null, null, impersonated)).toBe(false);
    expect(canAccessPrim(impersonated)).toBe(false);
    expect(canAccessPrim({ id: "u-admin", username: "orkun" })).toBe(true);
  });
});

describe("landingFor", () => {
  it("returns role-specific home routes", () => {
    expect(landingFor("admin")).toBe("/ozet");
    expect(landingFor("auditor")).toBe("/denetci");
    expect(landingFor("brand")).toBe("/marka/anasayfa");
    expect(landingFor("streamer")).toBe("/yayinci/maas");
  });
});

describe("notificationsHrefForRole", () => {
  it("returns role-aware notification center paths", () => {
    expect(notificationsHrefForRole("brand")).toBe("/marka/bildirimler");
    expect(notificationsHrefForRole("streamer")).toBe("/yayinci/bildirimler");
    expect(notificationsHrefForRole("admin")).toBe("/bildirimler");
    expect(notificationsHrefForRole("auditor")).toBe("/bildirimler");
  });
});
