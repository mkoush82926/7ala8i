import { describe, expect, it } from "vitest";
import type { PublicStats, SearchCity } from "@/lib/search";
import { homeCounter, homeStats, popularAreas, roundDownCount } from "./home-utils";

const stats = (over: Partial<PublicStats> = {}): PublicStats => ({
  shops: 0,
  barbers: 0,
  areas: 0,
  reviews: 0,
  ratingAvg: null,
  bookingsToday: 0,
  bookingsTotal: 0,
  ...over,
});

describe("homeCounter", () => {
  it("prefers today's bookings", () => {
    expect(homeCounter(stats({ bookingsToday: 12, shops: 4 }))).toEqual({ kind: "today", value: 12 });
  });
  it("falls back to shop count, then nothing", () => {
    expect(homeCounter(stats({ shops: 4 }))).toEqual({ kind: "shops", value: 4 });
    expect(homeCounter(stats())).toBeNull();
    expect(homeCounter(null)).toBeNull();
  });
});

describe("roundDownCount", () => {
  it("rounds down to friendly figures", () => {
    expect(roundDownCount(9)).toBe(9);
    expect(roundDownCount(87)).toBe(80);
    expect(roundDownCount(437)).toBe(400);
    expect(roundDownCount(1234)).toBe(1200);
    expect(roundDownCount(-3)).toBe(0);
    expect(roundDownCount(Number.NaN)).toBe(0);
  });
});

describe("homeStats", () => {
  it("hides while the marketplace is small", () => {
    expect(homeStats(stats({ shops: 2, barbers: 5 }))).toEqual([]);
    expect(homeStats(null)).toEqual([]);
  });
  it("builds rounded items and only shows a rating with enough reviews", () => {
    const items = homeStats(stats({ shops: 23, barbers: 61, bookingsTotal: 1234, ratingAvg: 4.86, reviews: 3 }));
    expect(items).toEqual([
      { key: "shops", value: 20, plus: true },
      { key: "barbers", value: 60, plus: true },
      { key: "bookings", value: 1200, plus: true },
    ]);
    const withRating = homeStats(stats({ shops: 5, barbers: 5, ratingAvg: 4.86, reviews: 40 }));
    expect(withRating.at(-1)).toEqual({ key: "rating", value: 4.9, plus: false });
    expect(withRating.find((i) => i.key === "bookings")).toBeUndefined();
  });
});

describe("popularAreas", () => {
  const city: SearchCity = {
    id: "c",
    slug: "amman",
    slugAr: "عمان",
    nameEn: "Amman",
    nameAr: "عمّان",
    lat: 31.95,
    lng: 35.91,
    areas: [
      { id: "a1", slug: "abdoun", slugAr: null, nameEn: "Abdoun", nameAr: "عبدون", lat: null, lng: null },
      { id: "a2", slug: "", slugAr: null, nameEn: "Broken", nameAr: "", lat: null, lng: null },
      { id: "a3", slug: "sweifieh", slugAr: null, nameEn: "Sweifieh", nameAr: "الصويفية", lat: null, lng: null },
    ],
  };
  it("skips areas without a slug and caps the list", () => {
    expect(popularAreas(city).map((a) => a.id)).toEqual(["a1", "a3"]);
    expect(popularAreas(city, 1).map((a) => a.id)).toEqual(["a1"]);
    expect(popularAreas(null)).toEqual([]);
  });
});
