import { describe, expect, it } from "vitest";
import {
  activeOwnerIdsOnLinks,
  countActiveLinkOwners,
  isActiveRosterEmployee,
} from "./active-streamers";
import { aggregateStreamersForMonth } from "./streamer-month-metrics";
import type { BrandLink, BrandViewership, Employee, LinkSnapshot } from "@/store/store";

const emp = (
  id: string,
  name: string,
  status: "active" | "inactive"
): Employee =>
  ({
    id,
    name,
    status,
    kind: "streamer",
    role: "Yayıncı",
    avatar: "",
    baseSalary: 0,
    currency: "USD",
  }) as unknown as Employee;

const link = (id: string, ownerId: string): BrandLink =>
  ({
    id,
    brandId: "b1",
    platform: "YouTube",
    url: "https://youtube.com/x",
    status: "active",
    ownerId,
    notes: "",
  }) as unknown as BrandLink;

describe("active-streamers", () => {
  it("counts only active roster owners", () => {
    const employees = [
      emp("ramiz", "Ramiz", "active"),
      emp("lucy", "Lucy", "inactive"),
      emp("acelya", "Acelya", "inactive"),
    ];
    const links = [
      link("l1", "ramiz"),
      link("l2", "lucy"),
      link("l3", "acelya"),
      link("l4", "ramiz"),
    ];
    expect(countActiveLinkOwners(links, employees)).toBe(1);
    expect(activeOwnerIdsOnLinks(links, employees)).toEqual(["ramiz"]);
    expect(isActiveRosterEmployee(employees[0])).toBe(true);
    expect(isActiveRosterEmployee(employees[1])).toBe(false);
  });
});

describe("aggregateStreamersForMonth activeOnly", () => {
  it("excludes inactive streamers from dashboard count", () => {
    const employees = [
      emp("ramiz", "Ramiz", "active"),
      emp("lucy", "Lucy", "inactive"),
    ];
    const brandLinks = [link("l1", "ramiz"), link("l2", "lucy")];
    const brandViewership: BrandViewership[] = [];
    const linkSnapshots: LinkSnapshot[] = [
      { id: "s1", linkId: "l1", date: "2026-07-10", views: 100, notes: "" },
      { id: "s2", linkId: "l2", date: "2026-07-10", views: 50, notes: "" },
    ];
    const rows = aggregateStreamersForMonth({
      employees,
      brandLinks,
      brandViewership,
      monthYm: "2026-07",
      linkSnapshots,
      todayYm: "2026-07",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].employeeId).toBe("ramiz");
  });
});
