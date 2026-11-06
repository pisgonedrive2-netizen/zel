import { describe, expect, it } from "vitest";
import {
  reconcileKasaLinkedContentExpenses,
  canConvertPayrollToKasa,
  canStreamerDeleteExpense,
  canStreamerSeeOwnExpense,
  canStreamerWithdrawExpense,
  canViewerSeeContentExpense,
  encodeExpenseExceptionInNotes,
  hasDoubleSettlementConflict,
  listDoubleSettlementConflicts,
  isExceptionWriteOff,
  matchesSettlementFilter,
  parseExpenseException,
  contentExpenseKasaPurpose,
  contentExpenseKasaTxDate,
  withStreamerClearedNotes,
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

  it("lists only conflicting expenses", () => {
    const conflict = base({
      id: "ce-conflict",
      settlementMode: "payroll",
      salaryExtraId: "sx",
      paid: true,
      kasaTxId: "tx",
    });
    const ok = base({ id: "ce-ok", settlementMode: "payroll", salaryExtraId: "sx2" });
    expect(listDoubleSettlementConflicts([conflict, ok]).map((e) => e.id)).toEqual([
      "ce-conflict",
    ]);
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

describe("exception write-off", () => {
  it("parses and encodes notes tags", () => {
    expect(parseExpenseException("foo [exc:hibe|hesap hack]")).toEqual({
      kind: "hibe",
      note: "hesap hack",
    });
    expect(encodeExpenseExceptionInNotes("not", "hack", "güvenlik")).toContain(
      "[exc:hack|güvenlik]"
    );
  });

  it("filters awaiting and blocks payroll convert", () => {
    const hibe = base({ exceptionKind: "hibe", notes: "[exc:hibe]" });
    expect(matchesSettlementFilter(hibe, "awaiting")).toBe(false);
    expect(matchesSettlementFilter(hibe, "exception")).toBe(true);
    expect(isExceptionWriteOff(hibe)).toBe(true);
    expect(
      canConvertPayrollToKasa(
        base({ settlementMode: "payroll", salaryExtraId: "sx", exceptionKind: "hack" })
      )
    ).toBe(false);
  });

  it("streamer withdraw/delete rules", () => {
    expect(canStreamerWithdrawExpense(base({ reviewStatus: "approved" }))).toBe(true);
    expect(
      canStreamerWithdrawExpense(
        base({ settlementMode: "kasa", paid: true, kasaTxId: "tx", reviewStatus: "approved" })
      )
    ).toBe(false);
    expect(canStreamerDeleteExpense(base({ reviewStatus: "cancelled" }))).toBe(true);
    expect(
      canStreamerDeleteExpense(
        base({ reviewStatus: "cancelled", notes: "x [streamer_cleared]" })
      )
    ).toBe(false);
    expect(canStreamerDeleteExpense(base({ reviewStatus: "pending" }))).toBe(true);
    expect(canStreamerDeleteExpense(base({ reviewStatus: "approved" }))).toBe(false);
  });

  it("withdrawn expenses only visible to main admin (managers)", () => {
    const withdrawn = base({ reviewStatus: "cancelled" });
    const pendingReleased = base({
      reviewStatus: "pending",
      adminReleasedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(canViewerSeeContentExpense(pendingReleased, { id: "u-1", username: "lucy" })).toBe(
      true,
    );
    expect(canViewerSeeContentExpense(withdrawn, { id: "u-1", username: "lucy" })).toBe(false);
    expect(canViewerSeeContentExpense(withdrawn, { id: "u-admin2", username: "admin2" })).toBe(false);
    expect(canViewerSeeContentExpense(withdrawn, { id: "u-admin", username: "orkun" })).toBe(true);
  });

  it("unreleased pending only visible to main admin", () => {
    const unreleased = base({ reviewStatus: "pending" });
    expect(canViewerSeeContentExpense(unreleased, { id: "u-1", username: "lucy" })).toBe(false);
    expect(canViewerSeeContentExpense(unreleased, { id: "u-admin", username: "orkun" })).toBe(true);
  });

  it("streamer sees withdrawn until soft-cleared", () => {
    const withdrawn = base({ reviewStatus: "cancelled" });
    expect(canStreamerSeeOwnExpense(withdrawn)).toBe(true);
    expect(
      canStreamerSeeOwnExpense(
        base({ reviewStatus: "cancelled", notes: "iptal [streamer_cleared]" })
      )
    ).toBe(false);
    expect(withStreamerClearedNotes("not")).toContain("[streamer_cleared]");
  });
});

describe("kasa link reconcile", () => {
  it("reattaches expense when ICEXP kasa tx exists but paid flag was cleared", () => {
    const exp = base({
      id: "ce-oct",
      paid: false,
      reviewStatus: "approved",
      settlementMode: undefined,
      kasaTxId: undefined,
      amountUsd: 184,
    });
    const { changed } = reconcileKasaLinkedContentExpenses(
      [exp],
      [
        {
          id: "tx-1",
          date: "2026-10-02T06:08:00+00:00",
          direction: "out",
          notes: "[ICEXP:ce-oct]",
        },
      ],
    );
    expect(changed).toHaveLength(1);
    expect(changed[0]?.paid).toBe(true);
    expect(changed[0]?.settlementMode).toBe("kasa");
    expect(changed[0]?.kasaTxId).toBe("tx-1");
    expect(changed[0]?.paidDate).toBe("2026-10-02");
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
