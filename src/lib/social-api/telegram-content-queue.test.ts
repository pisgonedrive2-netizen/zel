import { describe, expect, it } from "vitest";
import { computeTelegramQueueStats } from "./telegram-content-queue";

describe("computeTelegramQueueStats", () => {
  it("counts sent rows by day", () => {
    const sentAt = new Date().toISOString();
    const stats = computeTelegramQueueStats([
      { status: "sent", platform: "youtube", sent_at: sentAt },
      { status: "sent", platform: "tiktok", sent_at: sentAt },
      { status: "failed", platform: "youtube", sent_at: sentAt },
      { status: "pending", platform: "instagram", sent_at: null },
    ]);
    expect(stats.today).toBe(2);
    expect(stats.week).toBe(2);
    expect(stats.byPlatform.map((p) => p.platform).sort()).toEqual(["tiktok", "youtube"]);
  });
});
