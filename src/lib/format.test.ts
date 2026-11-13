import { describe, it, expect } from "vitest";
import {
  formatJOD,
  formatJODRange,
  formatMinutesRange,
  formatLocalizedNumber,
  joinMeta,
  localizeDigits,
  numberIntlLocale,
  parseDigitPreference,
  readDigitPreferenceCookie,
  resolveNumberingSystem,
  roundJOD,
  toArabicDigits,
  toLatinDigits,
} from "./format";

describe("formatJOD", () => {
  it("matches the roadmap acceptance example", () => {
    expect(formatJOD(7.5, "ar")).toBe("٧٫٥٠٠ د.أ");
  });

  it("uses 3-decimal fils and JD in English", () => {
    expect(formatJOD(7.5, "en")).toBe("7.500 JD");
    expect(formatJOD(1234.5, "en")).toBe("1,234.500 JD");
    expect(formatJOD(0.001, "en")).toBe("0.001 JD");
  });

  it("follows the digit preference", () => {
    expect(formatJOD(7.5, { locale: "ar", digits: "latn" })).toBe("7.500 د.أ");
    expect(formatJOD(12, { locale: "en", digits: "arab", trimZeros: true })).toBe("١٢ JD");
  });

  it("applies shop cash rounding", () => {
    expect(formatJOD(7.6, { locale: "en", rounding: 0.25 })).toBe("7.500 JD");
    expect(formatJOD(7.63, { locale: "en", rounding: 0.25 })).toBe("7.750 JD");
    expect(formatJOD(7.74, { locale: "en", rounding: 0.5 })).toBe("7.500 JD");
    expect(formatJOD(7.76, { locale: "en", rounding: "none" })).toBe("7.760 JD");
  });

  it("trims zeros on whole amounts only when asked", () => {
    expect(formatJOD(5, { locale: "en", trimZeros: true })).toBe("5 JD");
    expect(formatJOD(5.25, { locale: "en", trimZeros: true })).toBe("5.250 JD");
    expect(formatJOD(5, "en")).toBe("5.000 JD");
  });

  it("can hide the currency and survives bad input", () => {
    expect(formatJOD(3, { locale: "en", hideCurrency: true })).toBe("3.000");
    expect(formatJOD(Number.NaN, "en")).toBe("0.000 JD");
    expect(formatJOD(2, undefined)).toBe("2.000 JD");
  });
});

describe("roundJOD", () => {
  it("rounds to fils without float drift", () => {
    expect(roundJOD(1.0005)).toBe(1.001);
    expect(roundJOD(0.1 + 0.2)).toBe(0.3);
    expect(roundJOD(-1.0005)).toBe(-1.001);
  });
  it("rounds to the cash increment", () => {
    expect(roundJOD(10.125, 0.25)).toBe(10.25);
    expect(roundJOD(10.124, 0.25)).toBe(10);
  });
});

describe("ranges", () => {
  it("formats a JOD range with one label", () => {
    expect(formatJODRange(8, 5, { locale: "en", trimZeros: true })).toBe("5–8 JD");
    expect(formatJODRange(5, 5, { locale: "en", trimZeros: true })).toBe("5 JD");
    expect(formatJODRange(5, 8, { locale: "ar", trimZeros: true })).toBe("٥–٨ د.أ");
  });
  it("formats minute ranges in both locales", () => {
    expect(formatMinutesRange(30, 45, "en")).toMatch(/^30–45 min/);
    expect(formatMinutesRange(30, 30, "en")).toMatch(/^30 min/);
    expect(formatMinutesRange(30, 45, "ar")).toContain("٣٠");
  });
});

describe("digit locale", () => {
  it("resolves the numbering system", () => {
    expect(resolveNumberingSystem("ar")).toBe("arab");
    expect(resolveNumberingSystem("ar", "latn")).toBe("latn");
    expect(resolveNumberingSystem("en")).toBe("latn");
    expect(numberIntlLocale("ar-JO")).toBe("ar-JO-u-nu-arab");
    expect(numberIntlLocale("en", "auto")).toBe("en-GB-u-nu-latn");
  });

  it("converts digits both ways", () => {
    expect(toArabicDigits("12:30")).toBe("١٢:٣٠");
    expect(toLatinDigits("١٢:٣٠")).toBe("12:30");
    expect(toLatinDigits("۱۲")).toBe("12");
    expect(toLatinDigits("٧٫٥")).toBe("7.5");
    expect(localizeDigits("4.9 (312)", "ar")).toBe("٤.٩ (٣١٢)");
    expect(localizeDigits("٤", "en")).toBe("4");
  });

  it("parses preferences defensively", () => {
    expect(parseDigitPreference("arab")).toBe("arab");
    expect(parseDigitPreference("x")).toBe("auto");
    expect(parseDigitPreference(undefined)).toBe("auto");
    expect(readDigitPreferenceCookie("a=1; halaqy_digits=latn; b=2")).toBe("latn");
    expect(readDigitPreferenceCookie("")).toBe("auto");
  });

  it("formats grouped numbers", () => {
    expect(formatLocalizedNumber(12500, "en")).toBe("12,500");
    expect(formatLocalizedNumber(312, "ar")).toBe("٣١٢");
  });
});

describe("joinMeta", () => {
  it("joins non-empty parts with a middle dot", () => {
    expect(joinMeta(["4.9 (312)", null, "", false, "Khalda, Amman", 3])).toBe("4.9 (312) · Khalda, Amman · 3");
    expect(joinMeta([])).toBe("");
  });
});
