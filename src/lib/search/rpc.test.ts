import { describe, expect, it, vi } from "vitest";
import {
  buildCities,
  buildSearchArgs,
  fetchBookAgain,
  fetchCategories,
  fetchPlaces,
  fetchPublicStats,
  fetchRecentReviews,
  mapBarberRow,
  mapShopRow,
  searchBarbers,
  SearchError,
  searchErrorCode,
  searchShops,
  type SearchRpcClient,
} from "./rpc";
import { DEFAULT_SEARCH_STATE } from "./params";
import type { SearchOrigin, SearchState } from "./types";

const state = (over: Partial<SearchState> = {}): SearchState => ({ ...DEFAULT_SEARCH_STATE, filters: [], ...over });
const defaultOrigin: SearchOrigin = { kind: "default", lat: 31.95, lng: 35.91, cityId: null, areaId: null, radiusKm: null };
const afternoon = new Date("2026-11-13T12:10:00Z");

const shopRow = {
  id: "s1",
  slug: "the-razor",
  slug_ar: null,
  name: "The Razor",
  name_ar: "الموس",
  cover_url: null,
  logo_url: "",
  is_verified: true,
  area_name_en: "Khalda",
  area_name_ar: "خلدا",
  city_name_en: "Amman",
  city_name_ar: "عمّان",
  lat: 31.99,
  lng: 35.85,
  distance_km: 1.234,
  rating_avg: "4.87",
  rating_count: 31,
  min_price: "5.000",
  currency: "JOD",
  services_count: 9,
  matched_services: [
    { id: "v1", name: "Beard", name_ar: "لحية", price: 5, price_type: "fixed", duration: 30 },
    { id: null, name: "broken" },
  ],
  next_slot_start: "2026-11-13T15:30:00+00:00",
  next_slot_local_date: "2026-11-13",
  next_slot_local_time: "18:30",
  open_now: true,
  open_until: "2026-11-13T20:00:00+00:00",
  badges: ["verified", "top_rated"],
  score: 6.12,
  total_count: 41,
};

describe("buildSearchArgs", () => {
  it("sends a permissive empty search", () => {
    expect(buildSearchArgs(state(), defaultOrigin, { now: afternoon })).toEqual({
      p_q: null,
      p_area_id: null,
      p_city_id: null,
      p_lat: 31.95,
      p_lng: 35.91,
      p_radius_km: null,
      p_date: null,
      p_time_from: null,
      p_time_to: null,
      p_sort: "recommended",
      p_filters: {},
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("maps filters, audience, price and 'now'", () => {
    const args = buildSearchArgs(
      state({ q: " fade ", when: "now", filters: ["kids", "card", "women"], priceMin: 2, priceMax: 9, sort: "nearest" }),
      { kind: "geo", lat: 32, lng: 35.9, cityId: null, areaId: null, radiusKm: 25 },
      { now: afternoon, offset: 40, limit: 100 },
    );
    expect(args.p_q).toBe("fade");
    expect(args.p_filters).toEqual({ kids: true, card: true, audience: "women", open_now: true, price_min: 2, price_max: 9 });
    expect(args.p_date).toBe("2026-11-13");
    expect(args.p_time_from).toBe("15:10");
    expect(args.p_radius_km).toBe(25);
    expect(args.p_limit).toBe(48);
    expect(args.p_offset).toBe(40);
  });

  it("filters to the chosen city / area", () => {
    const args = buildSearchArgs(state(), { kind: "area", lat: 1, lng: 2, cityId: "c", areaId: "a", radiusKm: null });
    expect(args.p_city_id).toBe("c");
    expect(args.p_area_id).toBe("a");
  });
});

describe("row mapping", () => {
  it("maps a shop row defensively", () => {
    const shop = mapShopRow(shopRow);
    expect(shop).toMatchObject({
      kind: "shop",
      id: "s1",
      slug: "the-razor",
      logoUrl: null,
      isVerified: true,
      area: { en: "Khalda", ar: "خلدا" },
      distanceKm: 1.234,
      rating: { avg: 4.87, count: 31 },
      minPrice: 5,
      servicesCount: 9,
      nextSlot: { startIso: "2026-11-13T15:30:00+00:00", localDate: "2026-11-13", localTime: "18:30" },
      openNow: true,
      badges: ["verified", "top_rated"],
    });
    expect(shop.matchedServices).toEqual([{ id: "v1", name: "Beard", nameAr: "لحية", price: 5, priceType: "fixed", duration: 30 }]);
  });

  it("treats zero reviews and missing slots as null", () => {
    const shop = mapShopRow({ ...shopRow, rating_avg: null, rating_count: 0, next_slot_start: null, matched_services: null, badges: null });
    expect(shop.rating).toBeNull();
    expect(shop.nextSlot).toBeNull();
    expect(shop.matchedServices).toEqual([]);
    expect(shop.badges).toEqual([]);
  });

  it("maps a barber row", () => {
    const b = mapBarberRow({
      id: "b1",
      handle: "ahmad",
      full_name: "Ahmad K",
      avatar_url: null,
      title_en: "Senior barber",
      title_ar: null,
      years_experience: 7,
      languages: ["ar", "en", 3],
      shop_id: "s1",
      shop_slug: "the-razor",
      shop_name: "The Razor",
      shop_is_verified: false,
      rating_avg: 5,
      rating_count: 2,
      min_price: 7,
      matched_services: [],
    });
    expect(b).toMatchObject({
      kind: "barber",
      handle: "ahmad",
      title: { en: "Senior barber", ar: null },
      yearsExperience: 7,
      languages: ["ar", "en"],
      shop: { id: "s1", slug: "the-razor", name: "The Razor", isVerified: false },
      rating: { avg: 5, count: 2 },
      currency: "JOD",
    });
  });
});

function fakeClient(result: { data?: unknown; error?: { message: string } | null } | Error): SearchRpcClient & { rpc: ReturnType<typeof vi.fn> } {
  return {
    rpc: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return { data: result.data ?? null, error: result.error ?? null };
    }),
  };
}

describe("searchShops / searchBarbers", () => {
  it("calls the RPC and pages by total_count", async () => {
    const client = fakeClient({ data: [shopRow] });
    const page = await searchShops(client, state({ q: "beard" }), defaultOrigin, { now: afternoon });
    expect(client.rpc).toHaveBeenCalledWith("search_shops", expect.objectContaining({ p_q: "beard", p_limit: 20, p_offset: 0 }));
    expect(page.total).toBe(41);
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(1);
  });

  it("infers hasMore from a full page when the total is unknown", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...shopRow, id: `s${i}`, total_count: null }));
    const page = await searchShops(fakeClient({ data: rows }), state({ when: "today" }), defaultOrigin);
    expect(page.total).toBeNull();
    expect(page.hasMore).toBe(true);
  });

  it("returns an empty first page with total 0", async () => {
    const page = await searchBarbers(fakeClient({ data: [] }), state(), defaultOrigin);
    expect(page).toEqual({ items: [], total: 0, hasMore: false });
  });

  it("surfaces typed errors", async () => {
    await expect(searchShops(fakeClient({ error: { message: "RATE_LIMITED" } }), state(), defaultOrigin)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    await expect(searchShops(fakeClient(new TypeError("Failed to fetch")), state(), defaultOrigin)).rejects.toBeInstanceOf(SearchError);
  });

  it("classifies error codes", () => {
    expect(searchErrorCode({ message: "INVALID_INPUT" })).toBe("INVALID_INPUT");
    expect(searchErrorCode(new TypeError("Failed to fetch"))).toBe("NETWORK");
    expect(searchErrorCode("boom")).toBe("UNKNOWN");
    expect(searchErrorCode(new SearchError("RATE_LIMITED"))).toBe("RATE_LIMITED");
  });
});

describe("home data", () => {
  it("maps public stats and degrades to null", async () => {
    const stats = await fetchPublicStats(fakeClient({ data: { shops: 3, barbers: 9, areas: 2, reviews: 10, rating_avg: "4.80", bookings_today: 5, bookings_total: 90 } }));
    expect(stats).toEqual({ shops: 3, barbers: 9, areas: 2, reviews: 10, ratingAvg: 4.8, bookingsToday: 5, bookingsTotal: 90 });
    expect(await fetchPublicStats(fakeClient({ error: { message: "x" } }))).toBeNull();
    expect(await fetchPublicStats(fakeClient(new Error("down")))).toBeNull();
  });

  it("maps reviews and drops empty comments", async () => {
    const reviews = await fetchRecentReviews(
      fakeClient({
        data: [
          { id: "r1", rating: 5, comment: "Great fade", created_at: "2026-11-01", reviewer: "Yousef R.", shop_id: "s1", shop_name: "X" },
          { id: "r2", rating: 5, comment: "", shop_id: "s1" },
        ],
      }),
    );
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ id: "r1", reviewer: "Yousef R.", shop: { id: "s1", name: "X" } });
  });

  it("book again is empty for anon/errors", async () => {
    expect(await fetchBookAgain(fakeClient({ error: { message: "permission denied" } }))).toEqual([]);
    const items = await fetchBookAgain(
      fakeClient({ data: [{ shop_id: "s1", shop_name: "X", last_visit: "2026-10-01", service_ids: ["a", 1], barber_id: "b", barber_name: "Ahmad" }] }),
    );
    expect(items[0]).toMatchObject({ shop: { id: "s1" }, serviceIds: ["a"], barberId: "b" });
  });
});

describe("places and categories", () => {
  const table = (rows: Record<string, unknown[]>, failing: string[] = []) => ({
    from: (name: string) => ({
      select: () => ({
        order: async () => (failing.includes(name) ? { data: null, error: { message: "x" } } : { data: rows[name] ?? [], error: null }),
      }),
    }),
  });

  it("groups areas under cities", () => {
    const cities = buildCities(
      [{ id: "c1", slug_en: "amman", name_en: "Amman", name_ar: "عمّان", lat: 31.9, lng: 35.9 }],
      [
        { id: "a1", city_id: "c1", slug_en: "khalda", name_en: "Khalda", name_ar: "خلدا" },
        { id: "a2", city_id: "zz", slug_en: "x", name_en: "X" },
      ],
    );
    expect(cities).toHaveLength(1);
    expect(cities[0].areas.map((a) => a.slug)).toEqual(["khalda"]);
  });

  it("fetches places and categories, empty on failure", async () => {
    const t = table({
      cities: [{ id: "c1", slug_en: "amman", name_en: "Amman", name_ar: "عمّان" }],
      areas: [],
      service_categories: [
        { id: "k1", slug: "fade", name_en: "Fade", name_ar: "تدريج", icon: "gradient", is_active: true },
        { id: "k2", slug: "old", name_en: "Old", is_active: false },
      ],
    });
    expect(await fetchPlaces(t)).toHaveLength(1);
    expect((await fetchCategories(t)).map((c) => c.slug)).toEqual(["fade"]);
    expect(await fetchPlaces(table({}, ["cities"]))).toEqual([]);
    expect(await fetchCategories(table({}, ["service_categories"]))).toEqual([]);
  });
});
