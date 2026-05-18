import { describe, it, expect } from "vitest";
import {
  paymentWindowInMonth,
  isInBrandPaymentReminderWindow,
  derivePaymentStatus,
} from "./brand-payment-schedule";

describe("brand-payment-schedule", () => {
  it("parses payment window in month", () => {
    const win = paymentWindowInMonth("1-5", "2026-05");
    expect(win).not.toBeNull();
    expect(win!.start.getDate()).toBe(1);
    expect(win!.end.getDate()).toBe(5);
  });

  it("detects reminder window", () => {
    const inWindow = isInBrandPaymentReminderWindow(
      "15",
      "2026-05",
      new Date(2026, 4, 13),
      3
    );
    expect(inWindow).toBe(true);
  });

  it("marks overdue after window", () => {
    const st = derivePaymentStatus(
      "pending",
      "2026-04",
      "1-5",
      new Date(2026, 4, 10)
    );
    expect(st).toBe("overdue");
  });
});
