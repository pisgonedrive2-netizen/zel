import { describe, expect, it } from "vitest";
import { initialContentExpenses, mergeCanonicalContentExpenses } from "@/store/store";

describe("mergeCanonicalContentExpenses", () => {
  it("boş listede 15 Ramiz kalemini geri yükler", () => {
    const out = mergeCanonicalContentExpenses([]);
    expect(out.length).toBe(15);
    expect(out.some((e) => e.id === "ce-r-01")).toBe(true);
  });

  it("mevcut kaydı korur, eksik seed id ekler", () => {
    const custom = { ...initialContentExpenses[0], amountUsd: 999 };
    const out = mergeCanonicalContentExpenses([custom]);
    expect(out.find((e) => e.id === "ce-r-01")?.amountUsd).toBe(999);
    expect(out.length).toBe(15);
  });
});
