import { describe, it, expect } from "vitest";
import { isPayrollActive, isPrimEligible } from "./payroll-utils";
import type { Employee } from "@/store/store";

const lucy: Employee = {
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
  status: "inactive",
  walletAddress: "",
  avatar: "L",
  notes: "",
  kind: "streamer",
};

describe("isPrimEligible", () => {
  it("Lucy Haziran bordroda ama prim için uygun değil", () => {
    expect(isPayrollActive(lucy, "2026-06")).toBe(true);
    expect(isPrimEligible(lucy, "2026-06")).toBe(false);
  });

  it("Lucy Temmuz ve sonrası bordroda da primde de yok", () => {
    expect(isPayrollActive(lucy, "2026-07")).toBe(false);
    expect(isPrimEligible(lucy, "2026-07")).toBe(false);
  });
});
