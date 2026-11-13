import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cn,
  normalizeLocale,
  toIntlLocale,
  currencyLabel,
  formatCurrency,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  parseDateInput,
  formatDate,
  formatTime,
  formatRelative,
  formatDuration,
  getInitials,
  getDayPeriod,
  getGreeting,
} from "./utils";

const NBSP = " ";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("locale helpers", () => {
  it("normalizes any BCP-47 tag to the app locale", () => {
    expect(normalizeLocale("ar")).toBe("ar");
    expect(normalizeLocale("ar-JO")).toBe("ar");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
    expect(normalizeLocale("fr")).toBe("en");
  });

  it("maps Arabic to ar-JO with Latin digits", () => {
    expect(toIntlLocale("ar")).toBe("ar-JO-u-nu-latn");
    expect(toIntlLocale("en")).toBe("en-GB");
  });

  it("labels currencies per locale", () => {
    expect(currencyLabel("JOD", "en")).toBe("JOD");
    expect(currencyLabel("JOD", "ar")).toBe("د.أ");
    expect(currencyLabel("usd", "en")).toBe("$");
    expect(currencyLabel("XYZ", "ar")).toBe("XYZ");
  });
});

describe("formatCurrency", () => {
  it("defaults to English with two decimals and a JOD suffix", () => {
    expect(formatCurrency(25)).toBe(`25.00${NBSP}JOD`);
  });

  it("groups thousands", () => {
    expect(formatCurrency(1234.5)).toBe(`1,234.50${NBSP}JOD`);
  });

  it("uses the Arabic label and Latin digits for ar", () => {
    const out = formatCurrency(1234.5, "ar");
    expect(out).toContain("د.أ");
    expect(out).toMatch(/1.?234.50/);
    expect(out).not.toMatch(/[٠-٩]/);
  });

  it("accepts legacy BCP-47 locales", () => {
    expect(formatCurrency(5, "en-US")).toBe(`5.00${NBSP}JOD`);
  });

  it("prefixes symbol currencies in English", () => {
    expect(formatCurrency(10, "en", "USD")).toBe("$10.00");
  });

  it("can trim zeros on whole amounts and hide the label", () => {
    expect(formatCurrency(15, "en", "JOD", { trimZeros: true })).toBe(`15${NBSP}JOD`);
    expect(formatCurrency(15.5, "en", "JOD", { trimZeros: true })).toBe(`15.50${NBSP}JOD`);
    expect(formatCurrency(15, "en", "JOD", { hideCurrency: true })).toBe("15.00");
  });

  it("renders non-finite amounts as zero", () => {
    expect(formatCurrency(Number.NaN)).toBe(`0.00${NBSP}JOD`);
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(12500)).toBe("12,500");
  });

  it("forwards Intl options", () => {
    expect(formatNumber(0.25, "en", { style: "percent" })).toBe("25%");
  });

  it("uses Latin digits in Arabic", () => {
    expect(formatNumber(12500, "ar")).not.toMatch(/[٠-٩]/);
  });

  it("formats compact numbers and percents", () => {
    expect(formatCompactNumber(1500)).toMatch(/^1\.5k$/i);
    expect(formatPercent(0.256)).toBe("26%");
  });
});

describe("parseDateInput", () => {
  it("parses date-only strings as local midnight (not UTC)", () => {
    const d = parseDateInput("2026-11-12")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it("returns null for invalid input", () => {
    expect(parseDateInput("not a date")).toBeNull();
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput(new Date("x"))).toBeNull();
  });
});

describe("formatDate", () => {
  const d = new Date(2026, 10, 12, 14, 5);

  it("formats presets in English", () => {
    expect(formatDate(d, "en", "medium")).toBe("12 Nov 2026");
    expect(formatDate(d, "en", "long")).toBe("Thursday, 12 November 2026");
    expect(formatDate(d, "en", "dayMonth")).toBe("12 Nov");
    expect(formatDate(d, "en", "weekday")).toBe("Thursday");
  });

  it("formats in Arabic with Arabic month and weekday names", () => {
    const out = formatDate(d, "ar", "long");
    expect(out).toContain("الخميس");
    expect(out).toContain("2026");
  });

  it("accepts raw Intl options", () => {
    expect(formatDate(d, "en", { month: "long" })).toBe("November");
  });

  it("does not shift date-only strings by a day", () => {
    expect(formatDate("2026-11-12", "en", "dayMonth")).toBe("12 Nov");
  });

  it("returns an empty string for invalid dates", () => {
    expect(formatDate("garbage", "en")).toBe("");
  });
});

describe("formatTime", () => {
  it("formats HH:mm strings in 12h English", () => {
    expect(formatTime("14:05")).toBe("2:05 PM");
    expect(formatTime("09:30:00")).toBe("9:30 AM");
  });

  it("formats Arabic with an Arabic day period", () => {
    const out = formatTime("14:05", "ar");
    expect(out).toContain("2:05");
    expect(out).toContain("م");
  });

  it("formats Date objects and honours options", () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 5), "en", { hour12: false })).toBe("14:05");
  });

  it("returns empty string for invalid input", () => {
    expect(formatTime("nope")).toBe("");
  });
});

describe("formatRelative", () => {
  const now = new Date(2026, 10, 12, 12, 0, 0);

  it("formats past and future distances", () => {
    expect(formatRelative(new Date(2026, 10, 12, 11, 55), "en", now)).toBe("5 minutes ago");
    expect(formatRelative(new Date(2026, 10, 15, 12, 0), "en", now)).toBe("in 3 days");
    expect(formatRelative(new Date(2026, 10, 13, 12, 0), "en", now)).toBe("tomorrow");
  });

  it("treats under 45 seconds as now", () => {
    expect(formatRelative(new Date(2026, 10, 12, 11, 59, 40), "en", now)).toBe("now");
  });

  it("formats in Arabic", () => {
    expect(formatRelative(new Date(2026, 10, 12, 11, 55), "ar", now)).toContain("5");
  });

  it("returns empty string for invalid input", () => {
    expect(formatRelative("bad", "en", now)).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(45)).toBe(`45${NBSP}min`);
    expect(formatDuration(60)).toBe(`1${NBSP}h`);
    expect(formatDuration(90)).toBe(`1${NBSP}h 30${NBSP}min`);
    expect(formatDuration(45, "ar")).toBe(`45${NBSP}دقيقة`);
  });
});

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("Ahmad Hassan")).toBe("AH");
  });

  it("uppercases the result", () => {
    expect(getInitials("ahmad hassan")).toBe("AH");
  });

  it("handles a single-word name", () => {
    expect(getInitials("Ahmad")).toBe("A");
  });

  it("ignores extra whitespace and empty input", () => {
    expect(getInitials("  Ahmad   Hassan ")).toBe("AH");
    expect(getInitials("")).toBe("");
  });
});

describe("getDayPeriod / getGreeting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("buckets the hour", () => {
    expect(getDayPeriod(new Date(2026, 0, 1, 9))).toBe("morning");
    expect(getDayPeriod(new Date(2026, 0, 1, 14))).toBe("afternoon");
    expect(getDayPeriod(new Date(2026, 0, 1, 20))).toBe("evening");
  });

  it("returns a morning greeting before noon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9));
    expect(getGreeting()).toBe("Good morning");
  });

  it("returns an afternoon greeting between 12 and 17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 14));
    expect(getGreeting()).toBe("Good afternoon");
  });

  it("returns an evening greeting after 17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 20));
    expect(getGreeting()).toBe("Good evening");
  });
});
