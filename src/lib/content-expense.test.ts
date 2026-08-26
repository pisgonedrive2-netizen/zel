import { describe, expect, it } from "vitest";
import {
  canConvertPayrollToKasa,
  hasDoubleSettlementConflict,
  matchesSettlementFilter,
  contentExpenseKasaPurpose,
  contentExpenseKasaTxDate,
  descriptionRequestsKasaSettlement,
} from "./content-expense";
import type { ContentExpense } from "@/store/store";

const base = (partial: Partial<ContentExpense>): ContentExpense => ({
  id: "ce-1",
  date: "2026-08-01",
  month: "2026-08",
  employeeId: "emp-1",
  brandName: "Pipo",
  category: "Vlog",
  description: "test",
  amountUsd: 100,
  paid: false,
  notes: "",
  reviewStatus: "approved",
  ...partial,
});

describe("settlement filters", () => {
  it("awaiting / payroll / kasa", () => {
    expect(matchesSettlementFilter(base({}), "awaiting")).toBe(true);
    expect(
      matchesSettlementFilter(base({ settlementMode: "payroll", salaryExtraId: "sx" }), "payroll")
    ).toBe(true);
    expect(
      matchesSettlementFilter(
        base({ settlementMode: "kasa", paid: true, kasaTxId: "tx" }),
        "kasa"
      )
    ).toBe(true);
  });
});

describe("double settlement", () => {
  it("flags payroll + kasa together", () => {
    expect(
      hasDoubleSettlementConflict(
        base({ settlementMode: "payroll", salaryExtraId: "sx", paid: true, kasaTxId: "tx" })
      )
    ).toBe(true);
    expect(hasDoubleSettlementConflict(base({ settlementMode: "payroll", salaryExtraId: "sx" }))).toBe(
      false
    );
  });
});

describe("convert payroll", () => {
  it("only payroll settled approved", () => {
    expect(
      canConvertPayrollToKasa(base({ settlementMode: "payroll", salaryExtraId: "sx" }))
    ).toBe(true);
    expect(canConvertPayrollToKasa(base({}))).toBe(false);
  });
});

describe("kasa purpose + date", () => {
  it("uses streamer description and expense date", () => {
    expect(
      contentExpenseKasaPurpose(base({ description: "Rulta ödemesi (kasadan düşülecek)" }))
    ).toBe("Rulta ödemesi (kasadan düşülecek)");
    expect(
      contentExpenseKasaTxDate(
        base({
          date: "2026-08-03",
          submittedAt: "2026-08-03T13:53:14.580Z",
        })
      )
    ).toBe("2026-08-03T13:53");
  });
});

describe("kasadan düşülecek tag", () => {
  it("detects common spellings", () => {
    expect(descriptionRequestsKasaSettlement("Telemarket (KASADAN DÜŞÜLECEK)")).toBe(true);
    expect(descriptionRequestsKasaSettlement("ads (kasadan düşükecek)")).toBe(true);
    expect(descriptionRequestsKasaSettlement("normal vlog harcama")).toBe(false);
  });
});
