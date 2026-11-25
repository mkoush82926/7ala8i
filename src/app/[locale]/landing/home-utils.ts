// Pure helpers for the consumer home page (tested in home-utils.test.ts).
import type { PublicStats, SearchArea, SearchCity } from "@/lib/search";

/** Below this many shops the stats band would undersell the product, so it hides. */
export const MIN_SHOPS_FOR_STATS = 3;

export type HomeCounter = { kind: "today"; value: number } | { kind: "shops"; value: number };

/**
 * Hero counter: "N booked today in Amman" when there were bookings today,
 * otherwise "N barbershops ready to book", otherwise nothing.
 */
export function homeCounter(stats: PublicStats | null | undefined): HomeCounter | null {
  if (!stats) return null;
  if (stats.bookingsToday > 0) return { kind: "today", value: stats.bookingsToday };
  if (stats.shops > 0) return { kind: "shops", value: stats.shops };
  return null;
}

export interface HomeStat {
  key: "shops" | "barbers" | "bookings" | "rating";
  value: number;
  /** Show a trailing "+" (rounded-down counts). */
  plus: boolean;
}

/** Rounds a count down to a friendly figure (1234 → 1200, 87 → 80, 9 → 9). */
export function roundDownCount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const v = Math.floor(n);
  if (v < 10) return v;
  if (v < 100) return Math.floor(v / 10) * 10;
  if (v < 1000) return Math.floor(v / 50) * 50;
  return Math.floor(v / 100) * 100;
}

/** Items for the stats band; empty while the marketplace is too small to show. */
export function homeStats(stats: PublicStats | null | undefined): HomeStat[] {
  if (!stats || stats.shops < MIN_SHOPS_FOR_STATS) return [];
  const out: HomeStat[] = [];
  const count = (key: HomeStat["key"], raw: number) => {
    const value = roundDownCount(raw);
    if (value > 0) out.push({ key, value, plus: value < raw });
  };
  count("shops", stats.shops);
  count("barbers", stats.barbers);
  count("bookings", stats.bookingsTotal);
  if (stats.ratingAvg !== null && stats.ratingAvg > 0 && stats.reviews >= 5) {
    out.push({ key: "rating", value: Math.round(stats.ratingAvg * 10) / 10, plus: false });
  }
  return out;
}

/** Quick-pick neighbourhoods under the hero (seed order = popularity). */
export function popularAreas(city: SearchCity | null | undefined, max = 8): SearchArea[] {
  if (!city) return [];
  return city.areas.filter((a) => a.slug && (a.nameEn || a.nameAr)).slice(0, Math.max(0, max));
}
