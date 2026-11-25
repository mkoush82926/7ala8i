import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMMAN_CENTER,
  findArea,
  findCity,
  LAST_CITY_STORAGE_KEY,
  NEAR_ME_RADIUS_KM,
  readLastCity,
  requestGeolocation,
  resolveOrigin,
  showsDistance,
  writeLastCity,
} from "./location";
import type { SearchCity } from "./types";

const cities: SearchCity[] = [
  {
    id: "c-amman",
    slug: "amman",
    slugAr: null,
    nameEn: "Amman",
    nameAr: "عمّان",
    lat: 31.95,
    lng: 35.91,
    areas: [
      { id: "a-khalda", slug: "khalda", slugAr: null, nameEn: "Khalda", nameAr: "خلدا", lat: 31.99, lng: 35.84 },
      { id: "a-nopin", slug: "nopin", slugAr: null, nameEn: "No pin", nameAr: "بلا", lat: null, lng: null },
    ],
  },
  { id: "c-irbid", slug: "irbid", slugAr: null, nameEn: "Irbid", nameAr: "إربد", lat: 32.55, lng: 35.85, areas: [] },
];

const none = { near: false, city: "", area: "" };

describe("resolveOrigin (fallback chain)", () => {
  it("near me with a fix wins", () => {
    const o = resolveOrigin({ ...none, near: true, city: "irbid" }, cities, { geo: { lat: 32, lng: 36 } });
    expect(o).toEqual({ kind: "geo", lat: 32, lng: 36, cityId: null, areaId: null, radiusKm: NEAR_ME_RADIUS_KM });
    expect(showsDistance(o)).toBe(true);
  });

  it("near me without a fix degrades to the default (no filter)", () => {
    const o = resolveOrigin({ ...none, near: true }, cities, { geo: null, lastCity: "irbid" });
    expect(o.kind).toBe("default");
    expect(o.cityId).toBeNull();
    expect(o.lat).toBe(32.55);
  });

  it("explicit area filters and anchors on the area centre (or the city's)", () => {
    expect(resolveOrigin({ ...none, city: "amman", area: "khalda" }, cities)).toMatchObject({
      kind: "area",
      cityId: "c-amman",
      areaId: "a-khalda",
      lat: 31.99,
    });
    expect(resolveOrigin({ ...none, city: "amman", area: "nopin" }, cities)).toMatchObject({ kind: "area", lat: 31.95 });
  });

  it("explicit city filters", () => {
    const o = resolveOrigin({ ...none, city: "irbid", area: "unknown" }, cities);
    expect(o).toMatchObject({ kind: "city", cityId: "c-irbid", areaId: null });
    expect(showsDistance(o)).toBe(false);
  });

  it("nothing → last city, then Amman, then a hard-coded centre", () => {
    expect(resolveOrigin(none, cities, { lastCity: "irbid" }).lat).toBe(32.55);
    expect(resolveOrigin(none, cities, { lastCity: "nowhere" }).lat).toBe(31.95);
    expect(resolveOrigin(none, [], {})).toMatchObject({ kind: "default", lat: AMMAN_CENTER.lat, lng: AMMAN_CENTER.lng });
  });

  it("unknown city slugs fall through to the default", () => {
    expect(resolveOrigin({ ...none, city: "atlantis" }, cities).kind).toBe("default");
  });

  it("finders", () => {
    expect(findCity(cities, "amman")?.id).toBe("c-amman");
    expect(findCity(cities, null)).toBeNull();
    expect(findArea(cities[0], "khalda")?.id).toBe("a-khalda");
    expect(findArea(null, "khalda")).toBeNull();
  });
});

describe("last city storage", () => {
  it("reads and writes valid slugs only", () => {
    const store = new Map<string, string>();
    const s = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    writeLastCity("irbid", s);
    expect(store.get(LAST_CITY_STORAGE_KEY)).toBe("irbid");
    expect(readLastCity(s)).toBe("irbid");
    store.set(LAST_CITY_STORAGE_KEY, "<script>");
    expect(readLastCity(s)).toBeNull();
    writeLastCity(null, s);
    expect(store.has(LAST_CITY_STORAGE_KEY)).toBe(false);
  });

  it("never throws when storage is blocked", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readLastCity(throwing)).toBeNull();
    expect(() => writeLastCity("amman", throwing)).not.toThrow();
    expect(readLastCity(null)).toBeNull();
  });
});

describe("requestGeolocation", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "geolocation");
  afterEach(() => {
    if (original) Object.defineProperty(globalThis.navigator, "geolocation", original);
    else delete (globalThis.navigator as unknown as Record<string, unknown>).geolocation;
  });
  const setGeo = (impl: unknown) => Object.defineProperty(globalThis.navigator, "geolocation", { value: impl, configurable: true });

  it("reports unsupported", async () => {
    setGeo(undefined);
    expect(await requestGeolocation()).toEqual({ error: "unsupported" });
  });

  it("resolves a point", async () => {
    setGeo({ getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 31.9, longitude: 35.9 } } as GeolocationPosition) });
    expect(await requestGeolocation()).toEqual({ point: { lat: 31.9, lng: 35.9 } });
  });

  it("maps permission denied", async () => {
    setGeo({ getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError) });
    expect(await requestGeolocation()).toEqual({ error: "denied" });
  });

  it("times out when the browser never answers", async () => {
    vi.useFakeTimers();
    setGeo({ getCurrentPosition: () => {} });
    const p = requestGeolocation(100);
    vi.advanceTimersByTime(700);
    expect(await p).toEqual({ error: "timeout" });
    vi.useRealTimers();
  });
});
