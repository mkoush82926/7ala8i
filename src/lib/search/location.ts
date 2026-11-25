// Location fallback for search (§WS-1B): device location ("Near me") →
// the last city the visitor searched → Amman → the neighbourhood picker.
//
// Coordinates are never written to the URL or sent anywhere except the
// search RPC. The last-used city is a per-browser convenience in
// localStorage; every access is guarded (private mode, blocked storage).

import type { SearchCity, SearchOrigin, SearchState } from "./types";

export const DEFAULT_CITY_SLUG = "amman";
export const AMMAN_CENTER = { lat: 31.9539, lng: 35.9106 } as const;
export const LAST_CITY_STORAGE_KEY = "halaqy:search:last-city";
/** "Near me" radius. Wide enough for Amman's sprawl, tight enough to mean "near". */
export const NEAR_ME_RADIUS_KM = 25;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function isValidPoint(p: unknown): p is GeoPoint {
  if (!p || typeof p !== "object") return false;
  const { lat, lng } = p as GeoPoint;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readLastCity(store: StorageLike | null = storage()): string | null {
  try {
    const v = store?.getItem(LAST_CITY_STORAGE_KEY) ?? null;
    return v && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length <= 64 ? v : null;
  } catch {
    return null;
  }
}

export function writeLastCity(slug: string | null, store: StorageLike | null = storage()): void {
  try {
    if (!store) return;
    if (slug) store.setItem(LAST_CITY_STORAGE_KEY, slug);
    else store.removeItem(LAST_CITY_STORAGE_KEY);
  } catch {
    // Storage blocked: the fallback chain simply skips this step.
  }
}

export function findCity(cities: readonly SearchCity[], slug: string | null | undefined): SearchCity | null {
  if (!slug) return null;
  return cities.find((c) => c.slug === slug) ?? null;
}

export function findArea(city: SearchCity | null, slug: string | null | undefined) {
  if (!city || !slug) return null;
  return city.areas.find((a) => a.slug === slug) ?? null;
}

function point(lat: number | null | undefined, lng: number | null | undefined): GeoPoint | null {
  const p = { lat: Number(lat), lng: Number(lng) };
  return lat !== null && lat !== undefined && lng !== null && lng !== undefined && isValidPoint(p) ? p : null;
}

/**
 * Resolves where a search is anchored:
 *   near=1 with a device fix   → "geo"  (distance + radius filter)
 *   city (+ area) in the URL   → "area" / "city" (filter to that place, rank by distance to its centre)
 *   nothing                    → "default": no place filter, ranked by distance
 *                                to the last-used city (or Amman), so an empty
 *                                search still returns every shop.
 * near=1 without a fix (denied / unavailable) degrades to "default".
 */
export function resolveOrigin(
  state: Pick<SearchState, "near" | "city" | "area">,
  cities: readonly SearchCity[],
  opts: { geo?: GeoPoint | null; lastCity?: string | null } = {},
): SearchOrigin {
  if (state.near && opts.geo && isValidPoint(opts.geo)) {
    return { kind: "geo", lat: opts.geo.lat, lng: opts.geo.lng, cityId: null, areaId: null, radiusKm: NEAR_ME_RADIUS_KM };
  }
  const city = !state.near ? findCity(cities, state.city) : null;
  if (city) {
    const area = findArea(city, state.area);
    if (area) {
      const p = point(area.lat, area.lng) ?? point(city.lat, city.lng);
      return { kind: "area", lat: p?.lat ?? null, lng: p?.lng ?? null, cityId: city.id, areaId: area.id, radiusKm: null };
    }
    const p = point(city.lat, city.lng);
    return { kind: "city", lat: p?.lat ?? null, lng: p?.lng ?? null, cityId: city.id, areaId: null, radiusKm: null };
  }
  const hint = findCity(cities, opts.lastCity ?? null) ?? findCity(cities, DEFAULT_CITY_SLUG);
  const p = (hint && point(hint.lat, hint.lng)) ?? AMMAN_CENTER;
  return { kind: "default", lat: p.lat, lng: p.lng, cityId: null, areaId: null, radiusKm: null };
}

/** Distances are only meaningful from a real place, not the default hint. */
export function showsDistance(origin: SearchOrigin): boolean {
  return origin.kind === "geo" || origin.kind === "area";
}

export type GeoFailure = "unsupported" | "denied" | "unavailable" | "timeout";

/** One-shot device location. Never throws; resolves a point or a failure reason. */
export function requestGeolocation(timeoutMs = 8000): Promise<{ point: GeoPoint } | { error: GeoFailure }> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) {
      resolve({ error: "unsupported" });
      return;
    }
    let settled = false;
    const done = (v: { point: GeoPoint } | { error: GeoFailure }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done({ error: "timeout" }), timeoutMs + 500);
    try {
      geo.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          done(isValidPoint(p) ? { point: p } : { error: "unavailable" });
        },
        (err) => done({ error: err?.code === 1 ? "denied" : err?.code === 3 ? "timeout" : "unavailable" }),
        { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: timeoutMs },
      );
    } catch {
      done({ error: "unavailable" });
    }
  });
}
