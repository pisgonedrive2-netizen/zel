import { describe, expect, it } from "vitest";
import {
  calcNetPayable,
  calcPayrollPayoutDue,
  initialEmployees,
  initialSalaryExtras,
  mergeCanonicalSalaryExtras,
  type ContentExpense,
  type SalaryExtra,
} from "@/store/store";
import {
  buildPayrollPaymentLines,
  sumUnpaidPayrollLines,
} from "@/lib/payroll-lines";

describe("Ramiz Haziran 2026 net ödenecek", () => {
  const ramiz = initialEmployees.find((e) => e.id === "emp-ramiz")!;
  const baseExtras = mergeCanonicalSalaryExtras(initialSalaryExtras);

  it("bordro neti: 10000 + 1400 kira − 3000 avans = 8400", () => {
    expect(calcNetPayable(ramiz, "2026-06", [], baseExtras, [])).toBe(8400);
  });

  it("içerik bordro kalemleri çift sayılmaz · toplam ≈ 13364", () => {
    const content = juneContentExpenses();
    const extras = initialSalaryExtrasWithJuneContent(initialSalaryExtras);
    const merged = mergeCanonicalSalaryExtras(extras);
    const due = calcPayrollPayoutDue(ramiz, "2026-06", [], merged, [], content);
    const lines = buildPayrollPaymentLines(
      ramiz,
      "2026-06",
      [],
      merged,
      content,
      [],
    );
    const unpaid = sumUnpaidPayrollLines(lines);
    const contentTotal = content.reduce((s, c) => s + c.amountUsd, 0);
    expect(unpaid).toBeCloseTo(due, 2);
    expect(unpaid).toBeCloseTo(8400 + contentTotal, 0);
    expect(unpaid).toBeCloseTo(13364, 0);
  });
});

function initialSalaryExtrasWithJuneContent(base: SalaryExtra[]): SalaryExtra[] {
  const content = juneContentExpenses();
  const linked: SalaryExtra[] = content.map((c) => ({
    id: `se-content-${c.id}`,
    employeeId: "emp-ramiz",
    month: "2026-06",
    amount: c.amountUsd,
    description: `İçerik · ${c.description}`,
    type: "expense",
    contentExpenseId: c.id,
  }));
  return [...base, ...linked];
}

/** Haziran 2026 onaylı bordro içeriği — DB toplamı ≈ $4.963,57 */
function juneContentExpenses(): ContentExpense[] {
  const amounts = [
    1000, 1000, 530, 530, 480, 304, 269, 180, 152, 132.57, 100, 94, 60, 60, 45, 27,
  ];
  return amounts.map((amountUsd, i) => ({
    id: `ce-june-${i}`,
    date: "2026-06-15",
    month: "2026-06",
    employeeId: "emp-ramiz",
    brandName: "Padi",
    category: "Vlog",
    description: `Haziran içerik ${i + 1}`,
    amountUsd,
    amountThb: 0,
    paid: false,
    submittedAt: "2026-06-28T12:00:00.000Z",
    submittedBy: "u-ramiz",
    reviewStatus: "approved" as const,
    settlementMode: "payroll" as const,
    notes: "",
  }));
}
