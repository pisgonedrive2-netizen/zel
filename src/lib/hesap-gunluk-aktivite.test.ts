import { describe, expect, it } from "vitest";
import { formatReportText } from "@/lib/hesap-gunluk-aktivite";
import {
  istanbulDayRangeEnding,
  istanbulDayToClose,
  shiftIstanbulDay,
  shouldAutoBackfillHesapGunluk,
  type HesapGunlukReport,
} from "@/lib/hesap-gunluk-aktivite-shared";

describe("hesap günlük aktivite", () => {
  it("shifts calendar days for midnight close of previous day", () => {
    expect(shiftIstanbulDay("2026-10-21", -1)).toBe("2026-10-20");
    expect(shiftIstanbulDay("2026-03-01", -1)).toBe("2026-02-28");
    // istanbulDayToClose uses "today - 1"
    const closed = istanbulDayToClose(new Date("2026-10-21T00:30:00+03:00"));
    expect(closed).toBe("2026-10-20");
  });

  it("builds inclusive day range for backfill", () => {
    expect(istanbulDayRangeEnding("2026-10-20", 3)).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
    ]);
  });

  it("auto-backfills when calendar is empty, not when fresh", () => {
    expect(shouldAutoBackfillHesapGunluk(null)).toBe(true);
    expect(
      shouldAutoBackfillHesapGunluk({
        byDate: {},
        latestDate: null,
        lastBackfillAt: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it("formats missing and posted accounts for the notification", () => {
    const report: HesapGunlukReport = {
      date: "2026-10-20",
      checkedAt: "2026-10-21T00:05:00Z",
      posted: 1,
      missing: 1,
      errors: 0,
      triggeredBy: "cron",
      final: true,
      rows: [
        {
          platform: "Instagram",
          handle: "@keladamkomedi",
          url: "https://www.instagram.com/keladamkomedi/",
          tag: "naz",
          kind: "none",
          count: 0,
          storyCount: 0,
          videoCount: 0,
          latestAt: null,
          sampleUrl: null,
        },
        {
          platform: "YouTube",
          handle: "@handekorkusuz",
          url: "https://www.youtube.com/@handekorkusuz",
          tag: "naz",
          kind: "video",
          count: 2,
          storyCount: 0,
          videoCount: 2,
          latestAt: "2026-10-20T10:00:00Z",
          sampleUrl: "https://youtube.com/watch?v=1",
        },
      ],
    };
    const text = formatReportText(report);
    expect(text).toContain("(kesin)");
    expect(text).toContain("Paylaşmayanlar:");
    expect(text).toContain("@keladamkomedi [Naz]");
    expect(text).toContain("@handekorkusuz [Naz] — 2 video");
  });
});
