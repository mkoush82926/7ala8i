import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  daysBetweenInclusive,
  eachDateInRange,
  formatHijri,
  fromHijri,
  hijriMonthLength,
  hijriMonthNames,
  hijriMonthRange,
  isHijriSupported,
  resolveHijriPreset,
  toHijri,
  upcomingHijriYear,
} from "./index";

describe("hijri (Umm al-Qura)", () => {
  it("is supported by the runtime", () => {
    expect(isHijriSupported()).toBe(true);
  });

  it("converts Gregorian to Hijri", () => {
    expect(toHijri("2027-02-08")).toEqual({ year: 1448, month: 9, day: 1 });
    expect(toHijri("2027-02-07")).toEqual({ year: 1448, month: 8, day: 30 });
    expect(toHijri("2026-06-16")).toEqual({ year: 1448, month: 1, day: 1 });
  });

  it("converts Hijri to Gregorian and round-trips", () => {
    expect(fromHijri(1448, 9, 1)).toBe("2027-02-08");
    expect(fromHijri(1448, 10, 1)).toBe("2027-03-09");
    expect(fromHijri(1448, 12, 10)).toBe("2027-05-16");
    expect(fromHijri(1449, 1, 1)).toBe("2027-06-06");
    for (const iso of ["2025-03-01", "2026-02-18", "2026-11-13", "2027-12-31", "2030-01-15"]) {
      const h = toHijri(iso);
      expect(fromHijri(h.year, h.month, h.day)).toBe(iso);
    }
  });

  it("rejects days that do not exist", () => {
    // Ramadan 1448 has 29 days.
    expect(hijriMonthLength(1448, 9)).toBe(29);
    expect(fromHijri(1448, 9, 30)).toBeNull();
    expect(fromHijri(1448, 13, 1)).toBeNull();
    expect(fromHijri(1448, 0, 1)).toBeNull();
    expect(fromHijri(1448.5, 1, 1)).toBeNull();
  });

  it("resolves the 1448 presets to the right Gregorian dates", () => {
    expect(resolveHijriPreset("ramadan", 1448)).toMatchObject({ start: "2027-02-08", end: "2027-03-08", days: 29 });
    expect(resolveHijriPreset("eid_al_fitr", 1448)).toMatchObject({ start: "2027-03-09", end: "2027-03-11", days: 3 });
    expect(resolveHijriPreset("arafah", 1448)).toMatchObject({ start: "2027-05-15", end: "2027-05-15", days: 1 });
    expect(resolveHijriPreset("eid_al_adha", 1448)).toMatchObject({ start: "2027-05-16", end: "2027-05-19", days: 4 });
    expect(resolveHijriPreset("islamic_new_year", 1449)).toMatchObject({ start: "2027-06-06", end: "2027-06-06" });
  });

  it("picks the upcoming occurrence year", () => {
    // 13 Nov 2026 is in Jumada al-Akhirah 1448 → Ramadan 1448 is still ahead.
    expect(upcomingHijriYear("ramadan", "2026-11-13")).toBe(1448);
    // During Shawwal 1448, the next Ramadan is 1449.
    expect(upcomingHijriYear("ramadan", "2027-03-20")).toBe(1449);
    // During Ramadan itself it is still the current one.
    expect(upcomingHijriYear("ramadan", "2027-02-20")).toBe(1448);
  });

  it("month ranges and date helpers", () => {
    expect(hijriMonthRange(1448, 9)).toEqual({ start: "2027-02-08", end: "2027-03-08", days: 29 });
    expect(addDaysIso("2027-02-28", 1)).toBe("2027-03-01");
    expect(daysBetweenInclusive("2027-02-08", "2027-03-08")).toBe(29);
    expect(eachDateInRange("2027-03-09", "2027-03-11")).toEqual(["2027-03-09", "2027-03-10", "2027-03-11"]);
    expect(eachDateInRange("2027-03-11", "2027-03-09")).toEqual([]);
  });

  it("formats labels in both languages", () => {
    expect(formatHijri("2027-02-08", "en")).toMatch(/Ramadan/);
    expect(formatHijri("2027-02-08", "en")).toMatch(/1448/);
    expect(formatHijri("2027-02-08", "ar")).toMatch(/رمضان/);
    expect(formatHijri("2027-02-08", "ar", { digits: "latn" })).toMatch(/1448/);
    expect(hijriMonthNames("en")).toHaveLength(12);
    expect(hijriMonthNames("ar")[8]).toMatch(/رمضان/);
  });
});
