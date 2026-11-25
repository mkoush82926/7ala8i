// Shared types for the consumer marketplace search (WS-1B).
//
// The URL is the source of truth for a search (shareable, crawlable); the
// SearchState below is its parsed form. RPC rows from search_shops /
// search_barbers are mapped into ShopResult / BarberResult.

export const SEARCH_TABS = ["shops", "barbers"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export const SEARCH_SORTS = ["recommended", "nearest", "top_rated", "lowest_price"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

/** Boolean facet chips. men/women map to the RPC's `audience` filter. */
export const SEARCH_FILTERS = [
  "open_now",
  "available_today",
  "kids",
  "home_service",
  "parking",
  "cliq",
  "card",
  "men",
  "women",
] as const;
export type SearchFilter = (typeof SEARCH_FILTERS)[number];

/** Preset time windows (shop-local). */
export const TIME_WINDOWS = ["morning", "afternoon", "evening"] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const TIME_WINDOW_RANGES: Record<TimeWindow, { from: string; to: string }> = {
  morning: { from: "06:00", to: "12:00" },
  afternoon: { from: "12:00", to: "17:00" },
  evening: { from: "17:00", to: "24:00" },
};

/** "" = any time; otherwise now | today | tomorrow | yyyy-MM-dd. */
export type SearchWhen = "" | "now" | "today" | "tomorrow" | `${number}-${number}-${number}`;

export const SEARCH_VIEWS = ["list", "map"] as const;
export type SearchView = (typeof SEARCH_VIEWS)[number];

export interface SearchState {
  q: string;
  /** City slug (slug_en). Empty = no explicit city. */
  city: string;
  /** Area slug (slug_en) within `city`. */
  area: string;
  /** "Near me": use the device location (coordinates never go in the URL). */
  near: boolean;
  when: SearchWhen;
  time: TimeWindow | "";
  sort: SearchSort;
  filters: SearchFilter[];
  /** Price bounds in JD (null = open). */
  priceMin: number | null;
  priceMax: number | null;
  tab: SearchTab;
  view: SearchView;
}

// ─── Places / categories (home + search bar) ────────────────────────────────

export interface SearchArea {
  id: string;
  slug: string;
  slugAr: string | null;
  nameEn: string;
  nameAr: string;
  lat: number | null;
  lng: number | null;
}

export interface SearchCity extends Omit<SearchArea, "id"> {
  id: string;
  areas: SearchArea[];
}

export interface SearchCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string | null;
}

// ─── Results ────────────────────────────────────────────────────────────────

export interface MatchedService {
  id: string;
  name: string;
  nameAr: string | null;
  price: number;
  priceType: "fixed" | "from" | "free";
  duration: number;
}

export interface NextSlot {
  startIso: string;
  /** Shop-local yyyy-MM-dd. */
  localDate: string;
  /** Shop-local HH:MM. */
  localTime: string;
}

export interface LocalizedName {
  en: string | null;
  ar: string | null;
}

export interface ShopResult {
  kind: "shop";
  id: string;
  slug: string | null;
  slugAr: string | null;
  name: string;
  nameAr: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  area: LocalizedName;
  city: LocalizedName;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  rating: { avg: number; count: number } | null;
  minPrice: number | null;
  currency: string;
  servicesCount: number;
  matchedServices: MatchedService[];
  nextSlot: NextSlot | null;
  openNow: boolean;
  openUntil: string | null;
  badges: string[];
  score: number;
}

export interface BarberResult {
  kind: "barber";
  id: string;
  handle: string;
  fullName: string;
  avatarUrl: string | null;
  title: LocalizedName;
  yearsExperience: number | null;
  languages: string[];
  shop: { id: string; slug: string | null; slugAr: string | null; name: string; nameAr: string | null; isVerified: boolean };
  area: LocalizedName;
  city: LocalizedName;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  rating: { avg: number; count: number } | null;
  minPrice: number | null;
  currency: string;
  matchedServices: MatchedService[];
  nextSlot: NextSlot | null;
  score: number;
}

export interface SearchPage<T> {
  items: T[];
  /** Exact total when known (no availability filter), else null. */
  total: number | null;
  hasMore: boolean;
}

// ─── Home page data ─────────────────────────────────────────────────────────

export interface PublicStats {
  shops: number;
  barbers: number;
  areas: number;
  reviews: number;
  ratingAvg: number | null;
  bookingsToday: number;
  bookingsTotal: number;
}

export interface RecentReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: string | null;
  shop: { id: string; slug: string | null; slugAr: string | null; name: string; nameAr: string | null };
  area: LocalizedName;
}

export interface BookAgainItem {
  shop: { id: string; slug: string | null; slugAr: string | null; name: string; nameAr: string | null; coverUrl: string | null };
  lastVisit: string;
  serviceName: string | null;
  serviceIds: string[];
  barberId: string | null;
  barberName: string | null;
}

/** Where distances and "nearest" are measured from, and what is filtered. */
export interface SearchOrigin {
  kind: "geo" | "area" | "city" | "default";
  lat: number | null;
  lng: number | null;
  /** Filter: only shops in this city / area. */
  cityId: string | null;
  areaId: string | null;
  /** Radius filter (km), only for "near me". */
  radiusKm: number | null;
}
