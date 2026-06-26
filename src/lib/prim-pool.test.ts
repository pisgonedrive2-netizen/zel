import { describe, it, expect } from "vitest";
import {
  computePrimPool,
  computeWithScenario,
  buildPrimRules,
  buildPrimScenarioGuide,
  buildPrimBaseInputs,
  calcViewPoolBonus,
  describePrimFormula,
  DEFAULT_PRIM_CONFIG,
  FAIR_PRIM_CONFIG,
  DEFAULT_VIEW_POOL_TIERS,
  DEFAULT_SCENARIOS,
  monthProgress,
  projectMonthEndViews,
  type PrimBaseInputs,
} from "./prim-pool";

describe("computePrimPool", () => {
  const brands = [
    { id: "b1", name: "A", shortName: "A", category: "", status: "active" as const, notes: "" },
    { id: "b2", name: "B", shortName: "B", category: "", status: "active" as const, notes: "" },
  ];

  it("net havuz = gelir - operasyon giderleri", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 15_000,
      contentExpenseUsd: 3_000,
      generalExpenseUsd: 2_000,
      recipients: [{ id: "e1", name: "X", kind: "streamer", weight: 1 }],
    });
    expect(r.totalRevenueUsd).toBe(20_000);
    expect(r.totalOpsUsd).toBe(20_000);
    expect(r.netPoolUsd).toBe(0);
    expect(r.basePrimUsd).toBe(0);
  });

  it("pozitif net havuzda sabit prim uygular", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 800_000, b2: 700_000 },
      payrollUsd: 10_000,
      contentExpenseUsd: 2_000,
      generalExpenseUsd: 1_000,
      recipients: [
        { id: "e1", name: "A", kind: "streamer", weight: 1 },
        { id: "e2", name: "B", kind: "streamer", weight: 1 },
      ],
      config: { ...DEFAULT_PRIM_CONFIG, basePrimNetBasis: "distributable" },
    });
    expect(r.netPoolUsd).toBe(7_000);
    expect(r.basePrimUsd).toBe(7_000 * DEFAULT_PRIM_CONFIG.basePrimRate);
    expect(r.viewTriggered).toBe(false);
    expect(r.viewBonusUsd).toBe(0);
    expect(r.recipients).toHaveLength(2);
    expect(r.recipients[0].totalUsd).toBeCloseTo(r.basePrimUsd / 2, 0);
  });

  it("izlenme hedefi aşıldığında view bonus tetiklenir", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 1_500_000, b2: 1_200_000 },
      payrollUsd: 10_000,
      contentExpenseUsd: 2_000,
      generalExpenseUsd: 1_000,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { basePrimRate: 0.2, viewTriggerStepRate: 0.1, viewTriggerCap: 0.5 },
    });
    expect(r.viewTriggered).toBe(true);
    expect(r.totalActualViews).toBe(2_700_000);
    expect(r.totalGuaranteedViews).toBe(2_000_000);
    expect(r.viewBonusUsd).toBeGreaterThan(0);
    expect(r.totalPrimUsd).toBe(r.basePrimUsd + r.viewBonusUsd);
  });

  it("revenue_share modeli giderlerden bağımsız prim üretir", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 100_000, b2: 100_000 },
      payrollUsd: 50_000, // net negatif
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { ...DEFAULT_PRIM_CONFIG, model: "revenue_share", revenueShareRate: 0.1 },
    });
    expect(r.netPoolUsd).toBeLessThan(0);
    expect(r.basePrimUsd).toBeCloseTo(2_000, 0); // 20000 * 0.1
  });

  it("cpm bonus modu garanti üstü izlenmeyi ödüllendirir", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 2_000_000, b2: 1_000_000 },
      payrollUsd: 5_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { ...DEFAULT_PRIM_CONFIG, viewBonusMode: "cpm", viewCpmBonusUsd: 3 },
    });
    // 1.000.000 garanti üstü → 1000 * 3 = 3000
    expect(r.viewBonusUsd).toBeCloseTo(3_000, 0);
  });

  it("minNetFloor altında prim dağıtılmaz", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 2_000_000, b2: 2_000_000 },
      payrollUsd: 12_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { ...DEFAULT_PRIM_CONFIG, minNetFloorUsd: 20_000 },
    });
    expect(r.netPoolUsd).toBe(8_000); // floor 20k altında
    expect(r.basePrimUsd).toBe(0);
    expect(r.viewBonusUsd).toBe(0);
  });

  it("equal dağıtım ağırlığa bakmaksızın eşit böler", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 5_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [
        { id: "e1", name: "A", kind: "streamer", weight: 1 },
        { id: "e2", name: "B", kind: "moderator", weight: 0.85 },
      ],
      config: { ...DEFAULT_PRIM_CONFIG, distributionMode: "equal" },
    });
    expect(r.recipients[0].totalUsd).toBeCloseTo(r.recipients[1].totalUsd, 5);
  });

  it("sabit prim modu belirlenen tutarı dağıtır", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 5_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "fixed", fixedPrimUsd: 8_000 },
    });
    // net 15.000, sabit 8.000 dağıtılabilirin altında → 8.000
    expect(r.basePrimUsd).toBe(8_000);
    expect(r.totalPrimUsd).toBe(8_000);
  });

  it("sabit prim dağıtılabilir havuzu aşamaz (net_share)", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 16_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "fixed", fixedPrimUsd: 20_000 },
    });
    // net 4.000, rezerv yok → sabit 20k ama dağıtılabilir 4k ile sınırlı
    expect(r.distributablePoolUsd).toBe(4_000);
    expect(r.basePrimUsd).toBe(4_000);
  });

  it("rezerv dağıtımdan önce pay ayırır", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { ...DEFAULT_PRIM_CONFIG, reserveRate: 0.2, monthlyReserveUsd: 2_000, basePrimRate: 0.5, basePrimNetBasis: "distributable" },
    });
    // net 20.000, rezerv = 2.000 + 20.000*0.2 = 6.000 → dağıtılabilir 14.000
    expect(r.reserveUsd).toBe(6_000);
    expect(r.distributablePoolUsd).toBe(14_000);
    expect(r.basePrimUsd).toBe(7_000); // 14.000 * 0.5
  });

  it("kişi başı tavan aşırı yüksek primi kırpar", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "fixed", fixedPrimUsd: 18_000, maxPrimPerPersonUsd: 6_000 },
    });
    expect(r.recipients[0].totalUsd).toBe(6_000);
    expect(r.totalPrimUsd).toBe(6_000);
    expect(r.cappedAmountUsd).toBe(12_000);
  });

  it("toplam prim tavanı havuzu sınırlar", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [
        { id: "e1", name: "A", kind: "streamer", weight: 1 },
        { id: "e2", name: "B", kind: "streamer", weight: 1 },
      ],
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "fixed", fixedPrimUsd: 18_000, maxTotalPrimUsd: 10_000 },
    });
    expect(r.totalPrimUsd).toBeCloseTo(10_000, 0);
    expect(r.recipients[0].totalUsd).toBeCloseTo(5_000, 0);
  });

  it("kasa payı modu kasa bakiyesinin yüzdesini kullanır", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      kasaBalanceUsd: 100_000,
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "kasa_share", basePrimRate: 0.12 },
    });
    expect(r.basePrimUsd).toBe(12_000);
    expect(r.totalPrimUsd).toBe(12_000);
  });

  it("sabit prim modunda senaryolar farklı prim üretir", () => {
    const base: PrimBaseInputs = {
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 600_000, b2: 600_000 },
      payrollUsd: 8_000,
      contentExpenseUsd: 2_000,
      generalExpenseUsd: 1_000,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      kasaBalanceUsd: 80_000,
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "fixed", fixedPrimUsd: 12_000, basePrimRate: 0.15 },
    };
    const worst = computeWithScenario(base, DEFAULT_SCENARIOS[0]);
    const aggressive = computeWithScenario(base, DEFAULT_SCENARIOS[4]);
    expect(aggressive.totalPrimUsd).toBeGreaterThan(worst.totalPrimUsd);
    expect(worst.totalPrimUsd).toBeLessThan(12_000);
  });

  it("senaryolar baz girdiyi çarpanlarla ölçekler", () => {
    const base: PrimBaseInputs = {
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 600_000, b2: 600_000 },
      payrollUsd: 8_000,
      contentExpenseUsd: 2_000,
      generalExpenseUsd: 1_000,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      kasaBalanceUsd: 50_000,
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "kasa_share", basePrimRate: 0.12 },
    };
    const worst = computeWithScenario(base, DEFAULT_SCENARIOS[0]);
    const aggressive = computeWithScenario(base, DEFAULT_SCENARIOS[4]);
    expect(aggressive.totalRevenueUsd).toBeGreaterThan(worst.totalRevenueUsd);
    expect(aggressive.totalPrimUsd).toBeGreaterThan(worst.totalPrimUsd);
  });

  it("puan sistemi havuzu puana göre böler (2 puan = 1 puanın 2 katı)", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [
        { id: "e1", name: "A", kind: "streamer", weight: 1, points: 2 },
        { id: "e2", name: "B", kind: "streamer", weight: 1, points: 1 },
      ],
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "fixed", fixedPrimUsd: 9_000 },
    });
    expect(r.totalPoints).toBe(3);
    expect(r.perPointUsd).toBeCloseTo(3_000, 0);
    expect(r.recipients[0].totalUsd).toBeCloseTo(6_000, 0);
    expect(r.recipients[1].totalUsd).toBeCloseTo(3_000, 0);
  });

  it("elle eklenen giderler net havuzu düşürür", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 5_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        manualExpenses: [{ id: "x", label: "Reklam", amountUsd: 4_000 }],
      },
    });
    expect(r.manualExpenseUsd).toBe(4_000);
    expect(r.totalOpsUsd).toBe(9_000);
    expect(r.netPoolUsd).toBe(11_000);
  });

  it("izlenme havuz bonusu eşik geçilince havuza para ekler", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 1_500_000, b2: 1_000_000 }, // toplam 2.5M
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        viewPoolBonusEnabled: true,
        viewPoolBonusMinViews: 0,
        viewPoolBonusThresholdViews: 1_000_000,
        viewPoolBonusPerStepUsd: 100,
      },
    });
    expect(r.viewPoolBonusSteps).toBe(2); // floor(2.5M / 1M)
    expect(r.viewPoolBonusUsd).toBe(200);
    expect(r.poolBonusUsd).toBe(200);
    expect(r.distributablePoolUsd).toBe(20_000);
    expect(r.totalPrimUsd).toBeGreaterThanOrEqual(200);
  });

  it("projeksiyon run-rate ile ay sonu izlenmeyi tahmin eder", () => {
    expect(monthProgress("2020-01")).toBe(1); // geçmiş ay tamamlandı
    expect(projectMonthEndViews(500_000, 0.5)).toBe(1_000_000);
    expect(projectMonthEndViews(500_000, 1)).toBe(500_000);
  });

  it("her 1M izlenme 100$ havuza girer ve kişilere dağıtılır", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 2_000_000, b2: 500_000 }, // 2.5M → 2 adım
      payrollUsd: 5_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1, points: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        basePrimMode: "fixed",
        fixedPrimUsd: 8_000,
        viewBonusMode: "off",
        viewPoolBonusEnabled: true,
        viewPoolBonusMinViews: 0,
        viewPoolBonusTiers: [],
        viewPoolBonusThresholdViews: 1_000_000,
        viewPoolBonusPerStepUsd: 100,
        minNetFloorUsd: 0,
      },
    });
    expect(r.poolBonusUsd).toBe(200);
    expect(r.totalPrimUsd).toBe(8_200);
    expect(r.recipients[0].poolShareUsd).toBe(200);
    expect(r.recipients[0].baseShareUsd).toBe(8_000);
  });

  it("içerik kalitesi aynı puanda farklı prim üretir", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [
        { id: "e1", name: "A", kind: "streamer", weight: 1, points: 1, qualityMultiplier: 1.5 },
        { id: "e2", name: "B", kind: "streamer", weight: 1, points: 1, qualityMultiplier: 0.75 },
      ],
      config: { ...DEFAULT_PRIM_CONFIG, basePrimMode: "fixed", fixedPrimUsd: 9_000, viewBonusMode: "off" },
    });
    expect(r.recipients[0].effectivePoints).toBe(1.5);
    expect(r.recipients[1].effectivePoints).toBe(0.75);
    expect(r.recipients[0].totalUsd).toBeCloseTo(6_000, 0);
    expect(r.recipients[1].totalUsd).toBeCloseTo(3_000, 0);
  });

  it("buildPrimScenarioGuide somut if-then satırları üretir", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 1_500_000, b2: 1_000_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1, points: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        basePrimMode: "fixed",
        fixedPrimUsd: 8_000,
        viewPoolBonusEnabled: true,
        viewPoolBonusMinViews: 0,
        viewPoolBonusTiers: [],
        viewPoolBonusThresholdViews: 1_000_000,
        viewPoolBonusPerStepUsd: 100,
        minNetFloorUsd: 5_000,
      },
    });
    const guide = buildPrimScenarioGuide(r);
    expect(guide.length).toBeGreaterThan(3);
    expect(guide.some((row) => row.when.includes("1 milyon") || row.when.includes("1M"))).toBe(true);
    expect(guide.some((row) => row.when.includes("kalite"))).toBe(true);
  });

  it("100 milyon izlenme 10.000$ havuza girer ve dağıtılır", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands: [{ id: "b1", name: "A", shortName: "A", category: "", status: "active" as const, notes: "" }],
      brandFees: { b1: 50_000 },
      brandGuarantees: { b1: 1_000_000 },
      brandViews: { b1: 100_000_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1, points: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        basePrimMode: "fixed",
        fixedPrimUsd: 8_000,
        viewBonusMode: "off",
        viewPoolBonusEnabled: true,
        viewPoolBonusMinViews: 0,
        viewPoolBonusTiers: [],
        viewPoolBonusThresholdViews: 1_000_000,
        viewPoolBonusPerStepUsd: 100,
        viewPoolBonusUncapped: true,
        minNetFloorUsd: 0,
        maxPrimPerPersonUsd: 0,
      },
    });
    expect(r.viewPoolBonusSteps).toBe(100);
    expect(r.poolBonusUsd).toBe(10_000);
    expect(r.recipients[0].poolShareUsd).toBe(10_000);
    expect(r.totalPrimUsd).toBe(18_000);
  });

  it("kâr tabanı altında izlenme havuz bonusu yine ödenir", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 1_500_000, b2: 1_000_000 },
      payrollUsd: 12_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        minNetFloorUsd: 20_000,
        viewPoolBonusEnabled: true,
        viewPoolBonusMinViews: 0,
        viewPoolBonusTiers: [],
        viewPoolBonusUncapped: true,
        viewPoolBonusThresholdViews: 1_000_000,
        viewPoolBonusPerStepUsd: 100,
      },
    });
    expect(r.netPoolUsd).toBe(8_000);
    expect(r.basePrimUsd).toBe(0);
    expect(r.poolBonusUsd).toBe(200);
    expect(r.totalPrimUsd).toBe(200);
  });

  it("kişi başı tavan havuz payını kırpmaz", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 2_000_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1, points: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        basePrimMode: "fixed",
        fixedPrimUsd: 8_000,
        viewBonusMode: "off",
        viewPoolBonusEnabled: true,
        viewPoolBonusMinViews: 0,
        viewPoolBonusTiers: [],
        viewPoolBonusPerStepUsd: 100,
        maxPrimPerPersonUsd: 5_000,
      },
    });
    expect(r.recipients[0].baseShareUsd).toBe(5_000);
    expect(r.recipients[0].poolShareUsd).toBe(200);
    expect(r.recipients[0].totalUsd).toBe(5_200);
  });

  it("kalan (gelir−maaş−içerik) üzerinden %10 taban prim hesaplar", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 8_000,
      contentExpenseUsd: 2_000,
      generalExpenseUsd: 1_000,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1 }],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        basePrimMode: "rate",
        basePrimRate: 0.1,
        basePrimNetBasis: "after_payroll_content",
        viewPoolBonusEnabled: false,
        viewBonusMode: "off",
      },
    });
    expect(r.payrollContentNetUsd).toBe(10_000);
    expect(r.basePrimUsd).toBe(1_000);
    expect(r.netPoolUsd).toBe(9_000);
  });

  it("buildPrimRules sabit minimal prim + izlenme kurallarını üretir", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 1_500_000, b2: 1_200_000 },
      payrollUsd: 5_000,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [
        { id: "e1", name: "A", kind: "streamer", weight: 2, points: 2 },
        { id: "e2", name: "B", kind: "streamer", weight: 1, points: 1 },
      ],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        basePrimMode: "fixed",
        fixedPrimUsd: 8_000,
        viewBonusMode: "cpm",
        viewCpmBonusUsd: 2,
        viewPoolBonusEnabled: true,
        viewPoolBonusMinViews: 0,
        viewPoolBonusTiers: [],
        viewPoolBonusThresholdViews: 1_000_000,
        viewPoolBonusPerStepUsd: 100,
        minNetFloorUsd: 5_000,
      },
    });
    const rules = buildPrimRules(r);
    expect(rules).toHaveLength(7);
    expect(rules.find((x) => x.id === "base")?.title).toMatch(/taban prim/i);
    expect(rules.find((x) => x.id === "quality")?.title).toBe("İçerik kalitesi");
    expect(rules.find((x) => x.id === "views")?.status).toBe("ok");
    expect(describePrimFormula(r)).toContain("taban");
    expect(describePrimFormula(r)).toContain("izlenme");
  });

  it("taban prim rezervden etkilenmez, yalnızca gerçek net kârı aşamaz", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands: [brands[0]],
      brandFees: { b1: 100_000 },
      brandGuarantees: { b1: 1_000_000 },
      brandViews: { b1: 500_000 },
      payrollUsd: 50_000,
      contentExpenseUsd: 50_000,
      generalExpenseUsd: 50_000,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1, points: 1 }],
      config: {
        ...FAIR_PRIM_CONFIG,
        reserveRate: 0.9,
        viewPoolBonusEnabled: false,
        viewBonusMode: "off",
      },
    });
    expect(r.payrollContentNetUsd).toBe(0);
    expect(r.netPoolUsd).toBe(-50_000);
    expect(r.basePrimUsd).toBe(0);
  });

  it("yüksek rezerv varken taban prim dağıtılabilir havuzdan değil net kârdan sınırlanır", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands: [brands[0]],
      brandFees: { b1: 200_000 },
      brandGuarantees: { b1: 1_000_000 },
      brandViews: { b1: 500_000 },
      payrollUsd: 50_000,
      contentExpenseUsd: 50_000,
      generalExpenseUsd: 50_000,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1, points: 1 }],
      config: {
        ...FAIR_PRIM_CONFIG,
        reserveRate: 0.9,
        viewPoolBonusEnabled: false,
        viewBonusMode: "off",
      },
    });
    expect(r.payrollContentNetUsd).toBe(100_000);
    expect(r.basePrimUsd).toBe(10_000);
    expect(r.distributablePoolUsd).toBe(5_000);
  });

  it("işten ayrılan (inactive) çalışan prim listesine girmez", () => {
    const lucy = {
      id: "emp-lucy",
      name: "Lucy",
      role: "Yayıncı",
      department: "Yayın",
      baseSalary: 3000,
      rentSupport: 500,
      initialAdvance: 0,
      paymentDay: "1-5",
      payrollStartMonth: "2026-04",
      payrollEndMonth: "2026-06",
      exitDate: "2026-06-18",
      startDate: "2026-01-01",
      status: "inactive" as const,
      walletAddress: "",
      avatar: "L",
      notes: "",
      kind: "streamer" as const,
    };
    const active = {
      id: "emp-ramiz",
      name: "Ramiz",
      role: "Yayıncı",
      department: "Yayın",
      baseSalary: 3000,
      rentSupport: 0,
      initialAdvance: 0,
      paymentDay: "1-5",
      payrollStartMonth: "2026-01",
      startDate: "2026-01-01",
      status: "active" as const,
      walletAddress: "",
      avatar: "R",
      notes: "",
      kind: "streamer" as const,
    };
    const base = buildPrimBaseInputs({
      monthYm: "2026-06",
      brands,
      brandLinks: [],
      linkSnapshots: [],
      employees: [lucy, active],
      advances: [],
      salaryExtras: [],
      paymentStatuses: [],
      contentExpenses: [],
      expenses: [],
    });
    expect(base.recipients.map((r) => r.id)).toEqual(["emp-ramiz"]);
  });

  it("5M barajı altında izlenme havuz bonusu yok", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands: [brands[0]],
      brandFees: { b1: 10_000 },
      brandGuarantees: { b1: 1_000_000 },
      brandViews: { b1: 4_000_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [{ id: "e1", name: "A", kind: "streamer", weight: 1, points: 1 }],
      config: { ...FAIR_PRIM_CONFIG, viewBonusMode: "off" },
    });
    expect(r.viewPoolBonusBillableViews).toBe(0);
    expect(r.poolBonusUsd).toBe(0);
  });

  it("5M barajı sonrası kademeli izlenme bonusu hesaplar", () => {
    const poolCfg = {
      viewPoolBonusEnabled: true,
      viewPoolBonusMinViews: 5_000_000,
      viewPoolBonusThresholdViews: 1_000_000,
      viewPoolBonusPerStepUsd: 125,
      viewPoolBonusTiers: DEFAULT_VIEW_POOL_TIERS,
    };
    expect(calcViewPoolBonus(10_000_000, poolCfg).bonusUsd).toBe(625);
    expect(calcViewPoolBonus(100_000_000, poolCfg).bonusUsd).toBe(8_625);
    const extreme = calcViewPoolBonus(200_000_000, poolCfg);
    expect(extreme.bonusUsd).toBe(12_375);
    expect(extreme.steps).toBe(145);
  });

  it("puan oranına göre prim bölünür", () => {
    const r = computePrimPool({
      monthYm: "2026-06",
      brands,
      brandFees: { b1: 10_000, b2: 10_000 },
      brandGuarantees: { b1: 1_000_000, b2: 1_000_000 },
      brandViews: { b1: 500_000, b2: 500_000 },
      payrollUsd: 0,
      contentExpenseUsd: 0,
      generalExpenseUsd: 0,
      recipients: [
        { id: "e1", name: "A", kind: "streamer", weight: 2, points: 2 },
        { id: "e2", name: "B", kind: "streamer", weight: 1, points: 1 },
        { id: "e3", name: "C", kind: "moderator", weight: 1, points: 1 },
      ],
      config: {
        ...DEFAULT_PRIM_CONFIG,
        basePrimMode: "fixed",
        fixedPrimUsd: 4_000,
        viewBonusMode: "off",
        viewPoolBonusEnabled: false,
        distributionMode: "weighted",
      },
    });
    expect(r.recipients[0].totalUsd).toBeCloseTo(2_000, 0);
    expect(r.recipients[1].totalUsd).toBeCloseTo(1_000, 0);
    expect(r.recipients[2].totalUsd).toBeCloseTo(1_000, 0);
    expect(r.recipients[0].sharePct).toBeCloseTo(0.5, 2);
  });
});
