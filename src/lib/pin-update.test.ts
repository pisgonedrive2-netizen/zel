import { describe, expect, it } from "vitest";
import { resolvePlainPin, validatePlainPin } from "./pin-update";

describe("resolvePlainPin", () => {
  it("prefers newPin over pin", () => {
    expect(resolvePlainPin({ newPin: "abc12345", pin: "other" })).toBe("abc12345");
  });

  it("accepts pin when newPin missing", () => {
    expect(resolvePlainPin({ pin: "xyz98765" })).toBe("xyz98765");
  });

  it("ignores masked or empty pin", () => {
    expect(resolvePlainPin({ pin: "***" })).toBeUndefined();
    expect(resolvePlainPin({ pin: "  " })).toBeUndefined();
    expect(resolvePlainPin({})).toBeUndefined();
  });

  it("rejects too short pin", () => {
    expect(resolvePlainPin({ pin: "123" })).toBeUndefined();
    expect(validatePlainPin("123")).toBeUndefined();
  });
});
