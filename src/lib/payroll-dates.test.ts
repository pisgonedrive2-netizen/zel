import { describe, expect, it } from "vitest";
import {
  payrollDueCaption,
  payrollDueShort,
  payrollPaymentMonthLongTitle,
  paymentWindowCalendarPhrase,
  parsePaymentWindow,
  nextYearMonth,
  isInPayrollReminderWindow,
} from "@/lib/payroll-dates";

describe("payroll-dates", () => {
  it("parsePaymentWindow parses range and single day", () => {
    expect(parsePaymentWindow("1-5")).toEqual({ start: 1, end: 5 });
    expect(parsePaymentWindow("17")).toEqual({ start: 17, end: 17 });
    expect(parsePaymentWindow("—")).toBeNull();
  });

  it("nextYearMonth handles month + year rollover", () => {
    expect(nextYearMonth("2026-05")).toBe("2026-06");
    expect(nextYearMonth("2026-12")).toBe("2027-01");
    expect(nextYearMonth("2026-01")).toBe("2026-02");
  });

  it("payrollPaymentMonthLongTitle returns next calendar month", () => {
    expect(payrollPaymentMonthLongTitle("2026-05")).toBe("Haziran 2026");
    expect(payrollPaymentMonthLongTitle("2026-12")).toBe("Ocak 2027");
  });

  it("paymentWindowCalendarPhrase: Mayıs bordrosu → 1–5 Haziran", () => {
    expect(paymentWindowCalendarPhrase("2026-05", "1-5")).toBe("1–5 Haziran 2026");
    expect(paymentWindowCalendarPhrase("2026-05", "17")).toBe("17 Haziran 2026");
    expect(paymentWindowCalendarPhrase("2026-12", "1-5")).toBe("1–5 Ocak 2027");
  });

  it("payrollDueCaption: bordro ay + ödeme penceresi sonraki ayda", () => {
    const s = payrollDueCaption("2026-05", "1-5");
    expect(s).toContain("Mayıs 2026 bordrosu");
    expect(s).toContain("ödeme");
    expect(s).toContain("1–5 Haziran 2026");
  });

  it("payrollDueShort: kısa metin sonraki ay ödemeyi vurgular", () => {
    expect(payrollDueShort("2026-05", "1-5")).toBe(
      "Mayıs 2026 · ödeme 1–5 Haziran 2026",
    );
  });

  it("isInPayrollReminderWindow: 29 Mayıs erken pencerede (3 gün öncesi), 6 Haziran içeride, 1 Temmuz dışarıda", () => {
    // Mayıs bordrosu → ödeme 1–5 Haziran; hatırlatma 29 Mayıs - 30 Haziran.
    const ym = "2026-05";
    const pay = "1-5";
    expect(isInPayrollReminderWindow(ym, pay, new Date(2026, 4, 29, 9))).toBe(true);
    expect(isInPayrollReminderWindow(ym, pay, new Date(2026, 5, 6, 12))).toBe(true);
    expect(isInPayrollReminderWindow(ym, pay, new Date(2026, 4, 25, 9))).toBe(false);
    expect(isInPayrollReminderWindow(ym, pay, new Date(2026, 6, 1, 9))).toBe(false);
  });
});
