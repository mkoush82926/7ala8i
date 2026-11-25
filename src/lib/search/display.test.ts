import { describe, expect, it } from "vitest";
import { distanceParts, localName, placeLabel, priceSummary, roundRating, serviceName, slotDay, weekdayLabel } from "./display";

describe("distanceParts", () => {
  it("formats metres and kilometres", () => {
    expect(distanceParts(0.012)).toEqual({ value: 50, unit: "m" });
    expect(distanceParts(0.84)).toEqual({ value: 850, unit: "m" });
    expect(distanceParts(2.43)).toEqual({ value: 2.4, unit: "km" });
    expect(distanceParts(12.6)).toEqual({ value: 13, unit: "km" });
  });
  it("returns null for missing values", () => {
    expect(distanceParts(null)).toBeNull();
    expect(distanceParts(Number.NaN)).toBeNull();
    expect(distanceParts(-1)).toBeNull();
  });
});

describe("slotDay", () => {
  const now = new Date("2026-11-13T21:30:00Z"); // 00:30 on the 14th in Amman
  it("uses the shop's local day", () => {
    expect(slotDay({ localDate: "2026-11-14" }, now)).toBe("today");
    expect(slotDay({ localDate: "2026-11-15" }, now)).toBe("tomorrow");
    expect(slotDay({ localDate: "2026-11-19" }, now)).toBe("later");
  });
  it("weekday is independent of the viewer's zone", () => {
    expect(weekdayLabel("2026-11-19", "en")).toBe("Thu");
    expect(weekdayLabel("2026-11-19", "ar")).toBe("الخميس");
  });
});

describe("names", () => {
  it("prefers the locale and falls back", () => {
    expect(localName({ en: "Khalda", ar: "خلدا" }, "ar")).toBe("خلدا");
    expect(localName({ en: "Khalda", ar: null }, "ar")).toBe("Khalda");
    expect(localName({ en: null, ar: null }, "en")).toBe("");
    expect(serviceName({ name: "Beard", nameAr: null }, "ar")).toBe("Beard");
  });
  it("joins place parts without duplicates", () => {
    expect(placeLabel({ en: "Khalda", ar: "خلدا" }, { en: "Amman", ar: "عمّان" }, "en")).toBe("Khalda, Amman");
    expect(placeLabel({ en: "Khalda", ar: "خلدا" }, { en: "Amman", ar: "عمّان" }, "ar")).toBe("خلدا، عمّان");
    expect(placeLabel({ en: null, ar: null }, { en: "Amman", ar: null }, "en")).toBe("Amman");
    expect(placeLabel({ en: "Amman", ar: null }, { en: "Amman", ar: null }, "en")).toBe("Amman");
  });
});

describe("numbers", () => {
  it("rounds ratings", () => {
    expect(roundRating(4.86)).toBe(4.9);
  });
  it("summarises prices", () => {
    expect(priceSummary([], null)).toBeNull();
    expect(priceSummary([{ id: "a", name: "x", nameAr: null, price: 5, priceType: "fixed", duration: 30 }], 5)).toEqual({ amount: 5, from: false });
    expect(priceSummary([{ id: "a", name: "x", nameAr: null, price: 5, priceType: "from", duration: 30 }], 5)).toEqual({ amount: 5, from: true });
  });
});
