import { describe, expect, it } from "vitest";
import {
  resolvePlanContentType,
  summarizeWeekPlans,
} from "./plan-content-types";

describe("plan-content-types", () => {
  it("maps legacy and new activity labels", () => {
    expect(resolvePlanContentType("Reels").kind).toBe("reels");
    expect(resolvePlanContentType("Yayın").kind).toBe("live");
    expect(resolvePlanContentType("Vlog Çekimi").kind).toBe("vlog");
    expect(resolvePlanContentType("Yetişkin İçerik").kind).toBe("adult");
    expect(resolvePlanContentType("Reels / kısa video çekimi").kind).toBe("reels");
  });

  it("summarizes week shoots by brand, type and day", () => {
    const weekDays = [
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ];
    const summary = summarizeWeekPlans(
      [
        {
          date: "2026-07-07",
          activity: "Reels",
          brandName: "Gala",
          status: "planned",
        },
        {
          date: "2026-07-07",
          activity: "Yetişkin İçerik",
          brandName: "Gala",
          status: "planned",
        },
        {
          date: "2026-07-09",
          activity: "Vlog Çekimi",
          brandName: "Padi",
          status: "planned",
        },
        {
          date: "2026-07-10",
          activity: "İzin",
          status: "planned",
        },
        {
          date: "2026-07-11",
          activity: "Reels",
          brandName: "Gala",
          status: "cancelled",
        },
      ],
      weekDays
    );

    expect(summary.shootCount).toBe(3);
    expect(summary.brandCount).toBe(2);
    expect(summary.activeDays).toBe(2);
    expect(summary.byType.map((t) => t.def.kind).sort()).toEqual([
      "adult",
      "reels",
      "vlog",
    ]);
    expect(summary.byBrand).toEqual([
      { name: "Gala", count: 2 },
      { name: "Padi", count: 1 },
    ]);
  });
});
