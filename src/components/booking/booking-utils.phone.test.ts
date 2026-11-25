import { describe, it, expect } from "vitest";
import { isValidPhone, latinDigits, normalizePhone } from "./booking-utils";

describe("booking phone input with Arabic keyboards", () => {
  it("accepts Arabic-Indic and Persian digits", () => {
    expect(isValidPhone("٠٧٩١٢٣٤٥٦٧")).toBe(true);
    expect(isValidPhone("۰۷۹ ۱۲۳ ۴۵۶۷")).toBe(true);
    expect(isValidPhone("+٩٦٢٧٩١٢٣٤٥٦٧")).toBe(true);
    expect(isValidPhone("٠٧٩")).toBe(false);
  });
  it("normalises to Latin digits for the API", () => {
    expect(normalizePhone(" ٠٧٩-١٢٣ ٤٥٦٧ ")).toBe("0791234567");
    expect(latinDigits("abc ٣")).toBe("abc 3");
  });
});
