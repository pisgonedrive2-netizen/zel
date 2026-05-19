import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  cacheAdminPin,
  mergeUsersWithPinCache,
  removeCachedAdminPin,
} from "./admin-pin-cache";
import type { AppUser } from "@/store/auth";

const base = (id: string): AppUser => ({
  id,
  username: "test",
  pin: "",
  name: "Test",
  role: "streamer",
  avatar: "T",
  active: true,
});

describe("admin-pin-cache", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it("merges cached pin after simulated refresh", () => {
    cacheAdminPin("u-1", "secret99");
    const merged = mergeUsersWithPinCache([base("u-1")], []);
    expect(merged[0].pin).toBe("secret99");
  });

  it("removes cache on delete", () => {
    cacheAdminPin("u-1", "secret99");
    removeCachedAdminPin("u-1");
    const merged = mergeUsersWithPinCache([base("u-1")], []);
    expect(merged[0].pin).toBe("");
  });
});
