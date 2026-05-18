import { describe, expect, it } from "vitest";
import type { AppUser } from "@/store/auth";
import { canApplyUserPatch, canDeleteUser, isMainAdmin } from "@/lib/user-guards";

const baseUsers = (): AppUser[] => [
  { id: "a1", username: "admin1", pin: "x", name: "Admin", role: "admin", avatar: "A", active: true },
  { id: "a2", username: "aud1", pin: "x", name: "Den", role: "auditor", avatar: "D", active: true },
];

const withMainAdmin = (): AppUser[] => [
  { id: "u-admin", username: "orkun", pin: "x", name: "Orkun Bey", role: "admin", avatar: "O", active: true },
  { id: "a3", username: "admin2", pin: "x", name: "Admin 2", role: "admin", avatar: "B", active: true },
  { id: "a2", username: "aud1", pin: "x", name: "Den", role: "auditor", avatar: "D", active: true },
];

describe("canDeleteUser", () => {
  it("blocks deleting last active admin", () => {
    const users = baseUsers();
    const r = canDeleteUser(users, "a1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("yönetici");
  });

  it("allows deleting admin when another active admin exists", () => {
    const users: AppUser[] = [
      ...baseUsers(),
      { id: "a3", username: "admin2", pin: "x", name: "Admin2", role: "admin", avatar: "B", active: true },
    ];
    const r = canDeleteUser(users, "a1");
    expect(r.ok).toBe(true);
  });

  it("blocks deleting last active auditor", () => {
    const users: AppUser[] = [
      { id: "a1", username: "admin1", pin: "x", name: "Admin", role: "admin", avatar: "A", active: true },
      { id: "a2", username: "aud1", pin: "x", name: "Den", role: "auditor", avatar: "D", active: true },
    ];
    const r = canDeleteUser(users, "a2");
    expect(r.ok).toBe(false);
  });
});

describe("canApplyUserPatch", () => {
  it("blocks deactivating last admin", () => {
    const users = baseUsers();
    const r = canApplyUserPatch(users, "a1", { active: false });
    expect(r.ok).toBe(false);
  });

  it("blocks demoting last admin", () => {
    const users = baseUsers();
    const r = canApplyUserPatch(users, "a1", { role: "streamer" });
    expect(r.ok).toBe(false);
  });
});

describe("main admin protection", () => {
  it("isMainAdmin detects by id and username", () => {
    expect(isMainAdmin({ id: "u-admin", username: "x" })).toBe(true);
    expect(isMainAdmin({ id: "other", username: "ORKUN" })).toBe(true);
    expect(isMainAdmin({ id: "other", username: "admin" })).toBe(false);
    expect(isMainAdmin(null)).toBe(false);
  });

  it("blocks deletion of the main admin even when other admins exist", () => {
    const r = canDeleteUser(withMainAdmin(), "u-admin");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Ana yönetici/i);
  });

  it("blocks deactivating the main admin", () => {
    const r = canApplyUserPatch(withMainAdmin(), "u-admin", { active: false });
    expect(r.ok).toBe(false);
  });

  it("blocks demoting the main admin", () => {
    const r = canApplyUserPatch(withMainAdmin(), "u-admin", { role: "auditor" });
    expect(r.ok).toBe(false);
  });

  it("blocks renaming the main admin", () => {
    const r = canApplyUserPatch(withMainAdmin(), "u-admin", { username: "yenikullanici" });
    expect(r.ok).toBe(false);
  });

  it("allows updating non-critical fields on the main admin", () => {
    const r = canApplyUserPatch(withMainAdmin(), "u-admin", { name: "Orkun" });
    expect(r.ok).toBe(true);
  });

  it("allows deleting another admin while main admin exists", () => {
    const r = canDeleteUser(withMainAdmin(), "a3");
    expect(r.ok).toBe(true);
  });
});
