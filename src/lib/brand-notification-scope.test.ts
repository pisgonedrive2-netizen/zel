import { describe, expect, it } from "vitest";
import { notificationMatchesBrandScope } from "./brand-notification-scope";
import type { AppNotification } from "@/store/store";

const base = (over: Partial<AppNotification>): AppNotification => ({
  id: "n1",
  type: "general",
  title: "Test",
  message: "Msg",
  forRole: "brand",
  createdAt: "2026-07-01T00:00:00.000Z",
  read: false,
  ...over,
});

describe("notificationMatchesBrandScope", () => {
  it("matches user-specific notification", () => {
    expect(notificationMatchesBrandScope(base({ forUserId: "u-1" }), "u-1", ["b-1"])).toBe(true);
    expect(notificationMatchesBrandScope(base({ forUserId: "u-2" }), "u-1", ["b-1"])).toBe(false);
  });

  it("matches brand-scoped notification", () => {
    expect(notificationMatchesBrandScope(base({ forBrandId: "b-1" }), "u-1", ["b-1"])).toBe(true);
    expect(notificationMatchesBrandScope(base({ forBrandId: "b-2" }), "u-1", ["b-1"])).toBe(false);
  });

  it("matches global brand broadcast", () => {
    expect(notificationMatchesBrandScope(base({}), "u-1", ["b-1"])).toBe(true);
  });
});
