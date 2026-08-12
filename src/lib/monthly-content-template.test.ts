import { describe, expect, it } from "vitest";
import {
  computeMonthPlanKpis,
  createFoxstreamMonthlyTemplate,
  expandTemplateWeekToPlans,
  validateMonthPlanRules,
} from "./monthly-content-template";

describe("monthly-content-template", () => {
  it("matches canonical reels / adult / vlog / kick KPIs", () => {
    const t = createFoxstreamMonthlyTemplate();
    const k = computeMonthPlanKpis(t.slots);
    expect(k.totalReelsShoot).toBe(25);
    expect(k.reelsByBrand["br-padi"]).toBe(12);
    expect(k.reelsByBrand["br-gala"]).toBe(7);
    expect(k.reelsByBrand["br-boffice"]).toBe(2);
    expect(k.reelsByBrand["br-pipo"]).toBe(2);
    expect(k.reelsByBrand["br-hit"]).toBe(2);
    expect(k.galaPublish).toBe(5);
    expect(k.galaStock).toBe(2);
    expect(k.totalAdult).toBe(6);
    expect(k.totalVlog).toBe(6);
    expect(k.totalKick).toBe(2);
    expect(k.totalEdit).toBe(4);
    expect(validateMonthPlanRules(t.slots)).toEqual([]);
  });

  it("expands galagrup Monday into 5 brand plans", () => {
    const t = createFoxstreamMonthlyTemplate();
    const plans = expandTemplateWeekToPlans(t.slots, 2, "2026-08-03", "emp-ramiz");
    const mon = plans.filter((p) => p.date === "2026-08-03" && p.activity === "Reels");
    expect(mon).toHaveLength(5);
    expect(mon.map((p) => p.brandName).sort()).toEqual(
      ["Boffice", "Gala", "Hit", "Padi", "Pipo"].sort(),
    );
  });

  it("fees: Gala 25k, Padişah 5k, side brands 5k each and never streamer-visible", () => {
    const t = createFoxstreamMonthlyTemplate();
    const gala = t.brandTerms.find((b) => b.brandId === "br-gala")!;
    const padi = t.brandTerms.find((b) => b.brandId === "br-padi")!;
    expect(gala.feeUsd).toBe(25_000);
    expect(padi.feeUsd).toBe(5_000);
    for (const b of t.brandTerms) {
      expect(b.feeVisibleToStreamer).toBe(false);
    }
  });
});
