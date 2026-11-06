import { describe, expect, it } from "vitest";
import type { ContentExpense } from "@/store/store";
import {
  ORKUN_TRASH_TAG,
  expenseDescriptionSnippet,
  filterOrkunArchiveExpenses,
  filterOrkunTrashExpenses,
  isOrkunTrashExpired,
  isOrkunTrashed,
  markOrkunTrashed,
  orkunTrashAgeDays,
  orkunTrashAgeLabel,
  orkunTrashKind,
  stripArchiveTagsFromNotes,
  stripOrkunTrash,
} from "./orkun-archive";

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

describe("orkun trash tags", () => {
  it("detects, marks, and strips [orkun_trash]", () => {
    expect(isOrkunTrashed("")).toBe(false);
    expect(isOrkunTrashed(`not ${ORKUN_TRASH_TAG}`)).toBe(true);
    expect(markOrkunTrashed("foo")).toBe(`foo ${ORKUN_TRASH_TAG}`);
    expect(markOrkunTrashed(`foo ${ORKUN_TRASH_TAG}`)).toBe(`foo ${ORKUN_TRASH_TAG}`);
    expect(markOrkunTrashed("")).toBe(ORKUN_TRASH_TAG);
    expect(stripOrkunTrash(`a ${ORKUN_TRASH_TAG} b`)).toBe("a b");
    expect(stripOrkunTrash(null)).toBe("");
  });

  it("strips archive tags together", () => {
    expect(
      stripArchiveTagsFromNotes(`iptal [streamer_cleared] ${ORKUN_TRASH_TAG}`),
    ).toBe("iptal");
  });

  it("snippets descriptions", () => {
    expect(expenseDescriptionSnippet("")).toBe("—");
    expect(expenseDescriptionSnippet("kısa")).toBe("kısa");
    expect(expenseDescriptionSnippet("x".repeat(60)).endsWith("…")).toBe(true);
  });
});

describe("orkun archive / trash filters", () => {
  it("archive = withdrawn only", () => {
    const rows = [
      base({ id: "1", reviewStatus: "cancelled" }),
      base({ id: "2", reviewStatus: "pending" }),
      base({ id: "3", reviewStatus: "cancelled", notes: "[streamer_cleared]" }),
    ];
    expect(filterOrkunArchiveExpenses(rows).map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("trash = orkun_trash tag OR withdrawn+streamer_cleared", () => {
    const rows = [
      base({ id: "a", reviewStatus: "pending", notes: ORKUN_TRASH_TAG }),
      base({ id: "b", reviewStatus: "cancelled", notes: "[streamer_cleared]" }),
      base({ id: "c", reviewStatus: "cancelled", notes: "sadece iptal" }),
      base({ id: "d", reviewStatus: "pending" }),
    ];
    expect(filterOrkunTrashExpenses(rows).map((e) => e.id)).toEqual(["a", "b"]);
    expect(orkunTrashKind(rows[0]!)).toBe("orkun_trash");
    expect(orkunTrashKind(rows[1]!)).toBe("streamer_discarded");
  });
});

describe("orkun trash age", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");

  it("prefers reviewedAt over date", () => {
    expect(
      orkunTrashAgeDays(
        base({
          reviewedAt: "2026-09-05T10:00:00.000Z",
          date: "2026-01-01",
        }),
        now,
      ),
    ).toBe(12);
  });

  it("falls back to date then month", () => {
    expect(
      orkunTrashAgeDays(base({ reviewedAt: undefined, date: "2026-09-10" }), now),
    ).toBe(7);
    expect(
      orkunTrashAgeDays(
        base({ reviewedAt: undefined, date: "", month: "2026-08" }),
        now,
      ),
    ).toBe(47);
  });

  it("expired at >= 30 days; label is Ng", () => {
    const old = base({
      reviewedAt: "2026-08-01T00:00:00.000Z",
      date: "2026-08-01",
    });
    expect(orkunTrashAgeDays(old, now)).toBe(47);
    expect(isOrkunTrashExpired(old, 30, now)).toBe(true);
    expect(isOrkunTrashExpired(base({ date: "2026-09-10" }), 30, now)).toBe(false);
    expect(orkunTrashAgeLabel(base({ date: "2026-09-05" }), now)).toBe("12g");
  });
});
