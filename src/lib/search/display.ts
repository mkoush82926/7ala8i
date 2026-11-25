// Pure display helpers for search cards. They return numbers and kinds, not
// copy: components pick the localized template from t.search.*.

import { addDays, zonedNow, DEFAULT_TIMEZONE } from "./params";
import type { LocalizedName, MatchedService, NextSlot } from "./types";

export interface DistanceParts {
  value: number;
  unit: "m" | "km";
}

/** 0.84 → 850 m, 2.43 → 2.4 km, 12.6 → 13 km. Null for missing/invalid. */
export function distanceParts(km: number | null | undefined): DistanceParts | null {
  if (km === null || km === undefined || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) return { value: Math.max(50, Math.round((km * 1000) / 50) * 50), unit: "m" };
  if (km < 10) return { value: Math.round(km * 10) / 10, unit: "km" };
  return { value: Math.round(km), unit: "km" };
}

export type SlotDay = "today" | "tomorrow" | "later";

/** Whether a shop-local slot date is today, tomorrow or later (in the shop's zone). */
export function slotDay(slot: Pick<NextSlot, "localDate">, now: Date = new Date(), timeZone = DEFAULT_TIMEZONE): SlotDay {
  const today = zonedNow(now, timeZone).date;
  if (slot.localDate <= today) return "today";
  if (slot.localDate === addDays(today, 1)) return "tomorrow";
  return "later";
}

/** Short weekday for a yyyy-MM-dd ("Thu" / "الخميس"), independent of the viewer's zone. */
export function weekdayLabel(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", { weekday: locale === "ar" ? "long" : "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Picks the locale's name with a fallback to the other language. */
export function localName(name: LocalizedName | { en?: string | null; ar?: string | null }, locale: string): string {
  return (locale === "ar" ? name.ar || name.en : name.en || name.ar) ?? "";
}

/** "Khalda, Amman" style place label; drops empties and duplicates. */
export function placeLabel(area: LocalizedName, city: LocalizedName, locale: string, separator = locale === "ar" ? "، " : ", "): string {
  const parts = [localName(area, locale), localName(city, locale)].filter(Boolean);
  return Array.from(new Set(parts)).join(separator);
}

export function serviceName(s: Pick<MatchedService, "name" | "nameAr">, locale: string): string {
  return (locale === "ar" ? s.nameAr || s.name : s.name || s.nameAr) ?? "";
}

/** Rating to one decimal, as a number (4.86 → 4.9). */
export function roundRating(avg: number): number {
  return Math.round(avg * 10) / 10;
}

/**
 * Lowest price among the matched services and whether it is a "from" price
 * (any variable/"from" service or more than one price in play).
 */
export function priceSummary(services: readonly MatchedService[], minPrice: number | null): { amount: number; from: boolean } | null {
  if (minPrice === null || !Number.isFinite(minPrice)) return null;
  const from = services.length > 1 || services.some((s) => s.priceType === "from");
  return { amount: minPrice, from };
}
