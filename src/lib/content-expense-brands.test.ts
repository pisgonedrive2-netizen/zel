import { describe, it, expect } from "vitest";
import {
  brandExpenseShareUsd,
  expenseMatchesBrand,
  resolveExpenseBrandIds,
} from "./content-expense-brands";
import type { Brand, ContentExpense } from "@/store/store";

const brands: Brand[] = [
  { id: "br-padi", name: "Padişahbet", shortName: "Padi", category: "Bahis", status: "active", notes: "" },
  { id: "br-pipo", name: "Betpipo", shortName: "Pipo", category: "Bahis", status: "active", notes: "" },
];

const shared: ContentExpense = {
  id: "e1",
  date: "2026-05-01",
  month: "2026-05",
  employeeId: "emp-1",
  brandIds: ["br-padi", "br-pipo"],
  brandId: "br-padi",
  brandName: "Padi · Pipo",
  category: "Vlog",
  description: "Ortak cekim",
  amountUsd: 1000,
  paid: true,
  notes: "",
  reviewStatus: "approved",
};

describe("content-expense-brands", () => {
  it("splits shared expense equally", () => {
    expect(brandExpenseShareUsd(shared, "br-padi", brands)).toBe(500);
    expect(brandExpenseShareUsd(shared, "br-pipo", brands)).toBe(500);
  });

  it("matches both brands", () => {
    expect(expenseMatchesBrand(shared, brands[0], brands)).toBe(true);
    expect(expenseMatchesBrand(shared, brands[1], brands)).toBe(true);
  });

  it("parses legacy comma-separated brand names", () => {
    const legacy: ContentExpense = {
      ...shared,
      brandIds: undefined,
      brandId: undefined,
      brandName: "Padi, Pipo",
    };
    expect(resolveExpenseBrandIds(legacy, brands)).toEqual(["br-padi", "br-pipo"]);
  });
});
