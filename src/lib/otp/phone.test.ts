import { describe, it, expect } from "vitest";
import { phoneDigits, samePhone, toJordanMobile, toLatinDigits } from "./phone";

describe("toJordanMobile", () => {
  it("normalises every local and international form of a Jordanian mobile", () => {
    for (const raw of ["0791234567", "791234567", "+962791234567", "00962791234567", "+962 0791234567", "٠٧٩١٢٣٤٥٦٧", "۰۷۹۱۲۳۴۵۶۷"]) {
      expect(toJordanMobile(raw)).toBe("962791234567");
    }
  });
  it("rejects other countries, landlines and junk", () => {
    expect(toJordanMobile("+964 779 123 4567")).toBeNull();
    expect(toJordanMobile("+9647791234567")).toBeNull();
    expect(toJordanMobile("065123456")).toBeNull();
    expect(toJordanMobile("0761234567")).toBeNull();
    expect(toJordanMobile("")).toBeNull();
    expect(toJordanMobile(null)).toBeNull();
  });
});

describe("digits", () => {
  it("reads Arabic-Indic and Persian digits", () => {
    expect(toLatinDigits("٠٧٩ ۱۲۳")).toBe("079 123");
    expect(phoneDigits("+٩٦٢ ٧٩")).toBe("96279");
  });
});

describe("samePhone", () => {
  it("compares the full international number", () => {
    expect(samePhone("0791234567", "+962791234567")).toBe(true);
    expect(samePhone("٠٧٩١٢٣٤٥٦٧", "0791234567")).toBe(true);
    // Same last 9 digits, different country: never the same subscriber.
    expect(samePhone("+9647791234567", "0791234567")).toBe(false);
  });
});
