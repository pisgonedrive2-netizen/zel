import { describe, it, expect } from "vitest";
import {
  hasCapability,
  hasCapabilityFor,
  routeCapability,
  sanitizePermissions,
} from "@/lib/permissions";
import { canAccess } from "@/store/auth";
import { canAccessPrim, canAccessOzet } from "@/lib/user-guards";

describe("permissions", () => {
  const orkun = { id: "u-admin", username: "orkun", role: "admin" as const };
  const ediz = { id: "u-ediz", username: "ediz", role: "admin" as const };

  it("ana yönetici (Orkun) her yetkiye sahip", () => {
    expect(hasCapability(orkun, "page.prim")).toBe(true);
    expect(hasCapability(orkun, "page.ozet")).toBe(true);
    expect(hasCapability(orkun, "data.ramiz_wallet")).toBe(true);
    expect(hasCapability(orkun, "users.impersonate")).toBe(true);
  });

  it("normal yönetici varsayılanı: prim/özet/cüzdan kapalı, gerisi açık", () => {
    expect(hasCapability(ediz, "page.prim")).toBe(false);
    expect(hasCapability(ediz, "page.ozet")).toBe(false);
    expect(hasCapability(ediz, "data.ramiz_wallet")).toBe(false);
    expect(hasCapability(ediz, "page.maaslar")).toBe(true);
    expect(hasCapability(ediz, "write.payroll")).toBe(true);
  });

  it("Orkun-only yetkiler override ile verilemez", () => {
    const granted = {
      ...ediz,
      permissions: {
        "page.prim": true,
        "page.ozet": true,
        "data.ramiz_wallet": true,
        "users.impersonate": true,
      } as const,
    };
    expect(hasCapability(granted, "page.prim")).toBe(false);
    expect(hasCapability(granted, "page.ozet")).toBe(false);
    expect(hasCapability(granted, "data.ramiz_wallet")).toBe(false);
    expect(hasCapability(granted, "users.impersonate")).toBe(false);
    expect(canAccessPrim(granted)).toBe(false);
    expect(canAccessOzet(granted)).toBe(false);
    // Dokunulmayan yetkiler rol varsayılanında kalır
    expect(hasCapability(granted, "page.maaslar")).toBe(true);
  });

  it("override ile yöneticiden sayfa alınabilir (kısıtlı yönetici)", () => {
    const limited = { ...ediz, permissions: { "page.maaslar": false, "page.kasa": false } as const };
    expect(hasCapability(limited, "page.maaslar")).toBe(false);
    expect(hasCapability(limited, "page.kasa")).toBe(false);
    expect(hasCapability(limited, "page.izlenme")).toBe(true);
  });

  it("impersonation oturumunda hassas yetkiler kapalı", () => {
    const impersonatingOrkun = { ...orkun, impersonatorId: "u-admin" };
    expect(hasCapability(impersonatingOrkun, "page.prim")).toBe(false);
    expect(hasCapability(impersonatingOrkun, "data.ramiz_wallet")).toBe(false);
    expect(canAccessPrim(impersonatingOrkun)).toBe(false);
    expect(canAccessOzet(impersonatingOrkun)).toBe(false);
  });

  it("routeCapability doğru eşler", () => {
    expect(routeCapability("/prim")).toBe("page.prim");
    expect(routeCapability("/izlenme/markalar")).toBe("page.izlenme");
    expect(routeCapability("/ozet")).toBe("page.ozet");
    expect(routeCapability("/yayinci/maas")).toBeUndefined();
  });

  it("canAccess Orkun-only sayfalara override ile girişi engeller", () => {
    expect(canAccess("/prim", "admin", null, null, ediz)).toBe(false);
    expect(canAccess("/ozet", "admin", null, null, ediz)).toBe(false);
    const granted = { ...ediz, permissions: { "page.prim": true, "page.ozet": true } };
    expect(canAccess("/prim", "admin", null, null, granted)).toBe(false);
    expect(canAccess("/ozet", "admin", null, null, granted)).toBe(false);
    expect(canAccess("/prim", "admin", null, null, orkun)).toBe(true);
    expect(canAccess("/ozet", "admin", null, null, orkun)).toBe(true);
    // Kısıtlı yönetici maaşlara giremez
    const limited = { ...ediz, permissions: { "page.maaslar": false } };
    expect(canAccess("/maaslar", "admin", null, null, limited)).toBe(false);
  });

  it("hasCapabilityFor rol + permissions ile çalışır (Orkun-only hariç)", () => {
    expect(hasCapabilityFor({ role: "auditor" }, "page.kasa")).toBe(true);
    expect(hasCapabilityFor({ role: "auditor" }, "write.kasa")).toBe(false);
    expect(hasCapabilityFor({ role: "auditor", permissions: { "write.kasa": true } }, "write.kasa")).toBe(true);
    expect(
      hasCapabilityFor(
        { role: "admin", permissions: { "page.prim": true } },
        "page.prim",
      ),
    ).toBe(false);
    expect(
      hasCapabilityFor({ isMainAdmin: true, role: "admin" }, "page.prim"),
    ).toBe(true);
    expect(
      hasCapabilityFor(
        { isMainAdmin: true, role: "admin", impersonating: true },
        "page.prim",
      ),
    ).toBe(false);
  });

  it("sanitizePermissions yalnızca bilinen boolean anahtarları tutar", () => {
    expect(sanitizePermissions({ "page.prim": true, bogus: 1, "page.kasa": "x" })).toEqual({ "page.prim": true });
    expect(sanitizePermissions({})).toBeUndefined();
    expect(sanitizePermissions(null)).toBeUndefined();
  });
});
