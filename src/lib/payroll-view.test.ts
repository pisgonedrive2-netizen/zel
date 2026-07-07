import { describe, expect, it } from "vitest";
import {
  initialEmployees,
  initialSalaryExtras,
  mergeCanonicalPaymentStatuses,
  type MonthPaymentStatus,
} from "@/store/store";
import { employeePayrollMonthForView } from "@/lib/payroll-view";

describe("employeePayrollMonthForView", () => {
  const acelya = initialEmployees.find((e) => e.id === "emp-acelya")!;
  const ramiz = initialEmployees.find((e) => e.id === "emp-ramiz")!;
  const extras = initialSalaryExtras;
  const statuses = mergeCanonicalPaymentStatuses([]);

  it("Acelya Haziran 2026 görünür", () => {
    expect(
      employeePayrollMonthForView(acelya, "2026-06", [], extras, [], statuses),
    ).toBe("2026-06");
  });

  it("Acelya Temmuz 2026 ve sonrası görünmez", () => {
    expect(
      employeePayrollMonthForView(acelya, "2026-07", [], extras, [], statuses),
    ).toBeNull();
    expect(
      employeePayrollMonthForView(acelya, "2026-08", [], extras, [], statuses),
    ).toBeNull();
  });

  it("Ramiz Temmuz 2026 aktif bordro", () => {
    expect(
      employeePayrollMonthForView(ramiz, "2026-07", [], extras, [], statuses),
    ).toBe("2026-07");
  });
});

describe("mergeCanonicalPaymentStatuses Ramiz Haziran", () => {
  it("Haziran tam ödendi olarak işaretlenir", () => {
    const merged = mergeCanonicalPaymentStatuses([]);
    const june = merged.find(
      (p) => p.employeeId === "emp-ramiz" && p.month === "2026-06",
    );
    expect(june?.paid).toBe(true);
    expect(june?.paidDate).toBe("2026-07-05");
  });
});
