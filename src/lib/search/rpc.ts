// Data access for the marketplace search and home page. Everything goes
// through SECURITY DEFINER RPCs (migration 20250101003150_search.sql) that
// only return published, marketplace-visible shops and aggregates.
//
// The client is structural ({ rpc, from }) so the Supabase browser/server
// clients fit without regenerated database types, and tests can pass fakes.

import { resolveWhen, DEFAULT_TIMEZONE } from "./params";
import type {
  BarberResult,
  BookAgainItem,
  MatchedService,
  NextSlot,
  PublicStats,
  RecentReview,
  SearchCategory,
  SearchCity,
  SearchOrigin,
  SearchPage,
  SearchState,
  ShopResult,
} from "./types";

export interface RpcResult {
  data: unknown;
  error: { message?: string; code?: string; details?: string | null } | null;
}

export interface SearchRpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
}

/** Results per page (the RPC caps at 48). */
export const SEARCH_PAGE_SIZE = 20;

export type SearchErrorCode = "RATE_LIMITED" | "INVALID_INPUT" | "NETWORK" | "UNKNOWN";

export class SearchError extends Error {
  constructor(public readonly code: SearchErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SearchError";
  }
}

export function searchErrorCode(error: unknown): SearchErrorCode {
  if (error instanceof SearchError) return error.code;
  const msg = String((error as { message?: string } | null)?.message ?? error ?? "");
  if (/RATE_LIMITED/.test(msg)) return "RATE_LIMITED";
  if (/INVALID_INPUT/.test(msg)) return "INVALID_INPUT";
  if (/Failed to fetch|NetworkError|network|fetch failed|ECONN/i.test(msg)) return "NETWORK";
  return "UNKNOWN";
}

// ─── Args ───────────────────────────────────────────────────────────────────

export interface SearchRpcArgs {
  p_q: string | null;
  p_area_id: string | null;
  p_city_id: string | null;
  p_lat: number | null;
  p_lng: number | null;
  p_radius_km: number | null;
  p_date: string | null;
  p_time_from: string | null;
  p_time_to: string | null;
  p_sort: string;
  p_filters: Record<string, boolean | number | string>;
  p_limit: number;
  p_offset: number;
}

export function buildSearchArgs(
  state: SearchState,
  origin: SearchOrigin,
  opts: { offset?: number; limit?: number; now?: Date; timeZone?: string } = {},
): SearchRpcArgs {
  const when = resolveWhen(state, opts.now ?? new Date(), opts.timeZone ?? DEFAULT_TIMEZONE);
  const filters: Record<string, boolean | number | string> = {};
  for (const f of state.filters) {
    if (f === "men" || f === "women") filters.audience = f;
    else filters[f] = true;
  }
  if (state.when === "now") filters.open_now = true;
  if (state.priceMin !== null) filters.price_min = state.priceMin;
  if (state.priceMax !== null) filters.price_max = state.priceMax;

  // "Nearest" needs a point; without one the RPC falls back to recommended order.
  return {
    p_q: state.q.trim() || null,
    p_area_id: origin.areaId,
    p_city_id: origin.cityId,
    p_lat: origin.lat,
    p_lng: origin.lng,
    p_radius_km: origin.radiusKm,
    p_date: when.date,
    p_time_from: when.timeFrom,
    p_time_to: when.timeTo,
    p_sort: state.sort,
    p_filters: filters,
    p_limit: Math.min(Math.max(opts.limit ?? SEARCH_PAGE_SIZE, 1), 48),
    p_offset: Math.max(opts.offset ?? 0, 0),
  };
}

// ─── Row mapping ────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function mapServices(raw: unknown): MatchedService[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((s: Row) => {
      const id = str(s?.id);
      if (!id) return null;
      const priceType = s.price_type === "from" || s.price_type === "free" ? s.price_type : "fixed";
      return {
        id,
        name: str(s.name) ?? "",
        nameAr: str(s.name_ar),
        price: num(s.price) ?? 0,
        priceType,
        duration: num(s.duration) ?? 0,
      } as MatchedService;
    })
    .filter((s): s is MatchedService => s !== null);
}

function mapSlot(row: Row): NextSlot | null {
  const start = str(row.next_slot_start);
  const date = str(row.next_slot_local_date);
  const time = str(row.next_slot_local_time);
  if (!start || !date || !time) return null;
  return { startIso: start, localDate: date.slice(0, 10), localTime: time.slice(0, 5) };
}

function mapRating(row: Row): { avg: number; count: number } | null {
  const count = num(row.rating_count) ?? 0;
  const avg = num(row.rating_avg);
  return count > 0 && avg !== null ? { avg, count } : null;
}

export function mapShopRow(row: Row): ShopResult {
  return {
    kind: "shop",
    id: String(row.id),
    slug: str(row.slug),
    slugAr: str(row.slug_ar),
    name: str(row.name) ?? "",
    nameAr: str(row.name_ar),
    coverUrl: str(row.cover_url),
    logoUrl: str(row.logo_url),
    isVerified: row.is_verified === true,
    area: { en: str(row.area_name_en), ar: str(row.area_name_ar) },
    city: { en: str(row.city_name_en), ar: str(row.city_name_ar) },
    lat: num(row.lat),
    lng: num(row.lng),
    distanceKm: num(row.distance_km),
    rating: mapRating(row),
    minPrice: num(row.min_price),
    currency: str(row.currency) ?? "JOD",
    servicesCount: num(row.services_count) ?? 0,
    matchedServices: mapServices(row.matched_services),
    nextSlot: mapSlot(row),
    openNow: row.open_now === true,
    openUntil: str(row.open_until),
    badges: Array.isArray(row.badges) ? row.badges.filter((b): b is string => typeof b === "string") : [],
    score: num(row.score) ?? 0,
  };
}

export function mapBarberRow(row: Row): BarberResult {
  return {
    kind: "barber",
    id: String(row.id),
    handle: str(row.handle) ?? "",
    fullName: str(row.full_name) ?? "",
    avatarUrl: str(row.avatar_url),
    title: { en: str(row.title_en), ar: str(row.title_ar) },
    yearsExperience: num(row.years_experience),
    languages: Array.isArray(row.languages) ? row.languages.filter((l): l is string => typeof l === "string") : [],
    shop: {
      id: String(row.shop_id),
      slug: str(row.shop_slug),
      slugAr: str(row.shop_slug_ar),
      name: str(row.shop_name) ?? "",
      nameAr: str(row.shop_name_ar),
      isVerified: row.shop_is_verified === true,
    },
    area: { en: str(row.area_name_en), ar: str(row.area_name_ar) },
    city: { en: str(row.city_name_en), ar: str(row.city_name_ar) },
    lat: num(row.lat),
    lng: num(row.lng),
    distanceKm: num(row.distance_km),
    rating: mapRating(row),
    minPrice: num(row.min_price),
    currency: str(row.currency) ?? "JOD",
    matchedServices: mapServices(row.matched_services),
    nextSlot: mapSlot(row),
    score: num(row.score) ?? 0,
  };
}

function toPage<T>(rows: Row[], map: (r: Row) => T, limit: number, offset: number): SearchPage<T> {
  const items = rows.map(map);
  const total = rows.length > 0 ? num(rows[0].total_count) : offset === 0 ? 0 : null;
  const hasMore = total !== null ? offset + items.length < total : items.length >= limit;
  return { items, total, hasMore };
}

async function call(client: SearchRpcClient, fn: string, args: Record<string, unknown>): Promise<Row[]> {
  let res: RpcResult;
  try {
    res = await client.rpc(fn, args);
  } catch (e) {
    throw new SearchError(searchErrorCode(e), (e as Error)?.message);
  }
  if (res.error) throw new SearchError(searchErrorCode(res.error), res.error.message);
  return Array.isArray(res.data) ? (res.data as Row[]) : [];
}

export async function searchShops(
  client: SearchRpcClient,
  state: SearchState,
  origin: SearchOrigin,
  opts: { offset?: number; limit?: number; now?: Date } = {},
): Promise<SearchPage<ShopResult>> {
  const args = buildSearchArgs(state, origin, opts);
  const rows = await call(client, "search_shops", { ...args });
  return toPage(rows, mapShopRow, args.p_limit, args.p_offset);
}

export async function searchBarbers(
  client: SearchRpcClient,
  state: SearchState,
  origin: SearchOrigin,
  opts: { offset?: number; limit?: number; now?: Date } = {},
): Promise<SearchPage<BarberResult>> {
  const args = buildSearchArgs(state, origin, opts);
  const rows = await call(client, "search_barbers", { ...args });
  return toPage(rows, mapBarberRow, args.p_limit, args.p_offset);
}

// ─── Home page data ─────────────────────────────────────────────────────────

export function mapPublicStats(raw: unknown): PublicStats | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Row;
  return {
    shops: num(r.shops) ?? 0,
    barbers: num(r.barbers) ?? 0,
    areas: num(r.areas) ?? 0,
    reviews: num(r.reviews) ?? 0,
    ratingAvg: num(r.rating_avg),
    bookingsToday: num(r.bookings_today) ?? 0,
    bookingsTotal: num(r.bookings_total) ?? 0,
  };
}

export async function fetchPublicStats(client: SearchRpcClient, cityId: string | null = null): Promise<PublicStats | null> {
  try {
    const res = await client.rpc("public_stats", { p_city_id: cityId });
    return res.error ? null : mapPublicStats(res.data);
  } catch {
    return null;
  }
}

export function mapReviewRow(r: Row): RecentReview {
  return {
    id: String(r.id),
    rating: num(r.rating) ?? 0,
    comment: str(r.comment) ?? "",
    createdAt: str(r.created_at) ?? "",
    reviewer: str(r.reviewer),
    shop: { id: String(r.shop_id), slug: str(r.shop_slug), slugAr: str(r.shop_slug_ar), name: str(r.shop_name) ?? "", nameAr: str(r.shop_name_ar) },
    area: { en: str(r.area_name_en), ar: str(r.area_name_ar) },
  };
}

export async function fetchRecentReviews(client: SearchRpcClient, cityId: string | null = null, limit = 12): Promise<RecentReview[]> {
  try {
    const res = await client.rpc("public_recent_reviews", { p_city_id: cityId, p_limit: limit });
    if (res.error || !Array.isArray(res.data)) return [];
    return (res.data as Row[]).map(mapReviewRow).filter((r) => r.comment);
  } catch {
    return [];
  }
}

export function mapBookAgainRow(r: Row): BookAgainItem {
  return {
    shop: {
      id: String(r.shop_id),
      slug: str(r.shop_slug),
      slugAr: str(r.shop_slug_ar),
      name: str(r.shop_name) ?? "",
      nameAr: str(r.shop_name_ar),
      coverUrl: str(r.cover_url),
    },
    lastVisit: str(r.last_visit) ?? "",
    serviceName: str(r.service_name),
    serviceIds: Array.isArray(r.service_ids) ? r.service_ids.filter((s): s is string => typeof s === "string") : [],
    barberId: str(r.barber_id),
    barberName: str(r.barber_name),
  };
}

/** Signed-in customers only; anything else (anon, error) is an empty rail. */
export async function fetchBookAgain(client: SearchRpcClient, limit = 8): Promise<BookAgainItem[]> {
  try {
    const res = await client.rpc("get_book_again", { p_limit: limit });
    if (res.error || !Array.isArray(res.data)) return [];
    return (res.data as Row[]).map(mapBookAgainRow);
  } catch {
    return [];
  }
}

// ─── Places and categories (public tables) ──────────────────────────────────

export interface TableClient {
  from(table: string): {
    select(cols: string): {
      order(col: string, opts?: { ascending?: boolean }): PromiseLike<RpcResult>;
    };
  };
}

export function buildCities(cityRows: Row[], areaRows: Row[]): SearchCity[] {
  const areasByCity = new Map<string, SearchCity["areas"]>();
  for (const a of areaRows) {
    const cityId = String(a.city_id);
    const list = areasByCity.get(cityId) ?? [];
    list.push({
      id: String(a.id),
      slug: str(a.slug_en) ?? "",
      slugAr: str(a.slug_ar),
      nameEn: str(a.name_en) ?? "",
      nameAr: str(a.name_ar) ?? str(a.name_en) ?? "",
      lat: num(a.lat),
      lng: num(a.lng),
    });
    areasByCity.set(cityId, list);
  }
  return cityRows
    .map((c) => ({
      id: String(c.id),
      slug: str(c.slug_en) ?? "",
      slugAr: str(c.slug_ar),
      nameEn: str(c.name_en) ?? "",
      nameAr: str(c.name_ar) ?? str(c.name_en) ?? "",
      lat: num(c.lat),
      lng: num(c.lng),
      areas: areasByCity.get(String(c.id)) ?? [],
    }))
    .filter((c) => c.slug);
}

export async function fetchPlaces(client: TableClient): Promise<SearchCity[]> {
  try {
    const [cities, areas] = await Promise.all([
      client.from("cities").select("id, slug_en, slug_ar, name_en, name_ar, lat, lng, sort").order("sort"),
      client.from("areas").select("id, city_id, slug_en, slug_ar, name_en, name_ar, lat, lng, sort").order("sort"),
    ]);
    if (cities.error || !Array.isArray(cities.data)) return [];
    return buildCities(cities.data as Row[], Array.isArray(areas.data) ? (areas.data as Row[]) : []);
  } catch {
    return [];
  }
}

export async function fetchCategories(client: TableClient): Promise<SearchCategory[]> {
  try {
    const res = await client.from("service_categories").select("id, slug, name_en, name_ar, icon, sort, is_active").order("sort");
    if (res.error || !Array.isArray(res.data)) return [];
    return (res.data as Row[])
      .filter((c) => c.is_active !== false && str(c.slug))
      .map((c) => ({
        id: String(c.id),
        slug: String(c.slug),
        nameEn: str(c.name_en) ?? String(c.slug),
        nameAr: str(c.name_ar) ?? str(c.name_en) ?? String(c.slug),
        icon: str(c.icon),
      }));
  } catch {
    return [];
  }
}
