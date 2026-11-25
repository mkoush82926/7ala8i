// Server-side loaders for the consumer home (/landing) and results (/explore)
// pages. Kept out of ./index so the browser bundle never pulls the server
// Supabase client. Every loader is best-effort: a failure (or mock mode,
// where data lives in the browser client) yields empty data and the page
// still renders; client islands fetch what they need themselves.

import { MOCK_DATA_ENABLED, MOCK_SHOPS, MOCK_REVIEWS, MOCK_BARBERS } from "@/lib/mock-data";
import { FALLBACK_CATEGORIES, FALLBACK_CITIES, FALLBACK_CITY } from "./fallback";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCategories,
  fetchPlaces,
  fetchPublicStats,
  fetchRecentReviews,
  type SearchRpcClient,
  type TableClient,
} from "./rpc";
import { DEFAULT_CITY_SLUG, findCity } from "./location";
import type { PublicStats, RecentReview, SearchCategory, SearchCity } from "./types";

export interface SearchShellData {
  cities: SearchCity[];
  categories: SearchCategory[];
}

export interface HomeData extends SearchShellData {
  /** Stats for the default city (Amman), used by the "booked today" counter. */
  cityStats: PublicStats | null;
  /** Platform-wide stats for the stats band. */
  stats: PublicStats | null;
  reviews: RecentReview[];
  /** The default city (Amman) when seeded. */
  defaultCity: SearchCity | null;
}

/** Static browse data (seed-equivalent) so the home and search bar never render empty. */
const FALLBACK_SHELL: SearchShellData = { cities: FALLBACK_CITIES, categories: FALLBACK_CATEGORIES };

function withFallbacks(shell: SearchShellData): SearchShellData {
  return {
    cities: shell.cities.length > 0 ? shell.cities : FALLBACK_SHELL.cities,
    categories: shell.categories.length > 0 ? shell.categories : FALLBACK_SHELL.categories,
  };
}

/** Mock-mode home data, derived from the same fixtures the browser mock client serves. */
function mockHomeData(): HomeData {
  const published = MOCK_SHOPS.filter((s) => s.is_published && s.marketplace_visible);
  const ratings = MOCK_REVIEWS.map((r) => r.rating);
  const stats: PublicStats = {
    shops: published.length,
    barbers: MOCK_BARBERS.length,
    areas: new Set(published.map((s) => s.area_slug)).size,
    reviews: MOCK_REVIEWS.length,
    ratingAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    bookingsToday: 0,
    bookingsTotal: 0,
  };
  const reviews: RecentReview[] = MOCK_REVIEWS.map((r) => {
    const shop = MOCK_SHOPS.find((s) => s.id === r.shop_id);
    const area = FALLBACK_CITY.areas.find((a) => a.slug === shop?.area_slug);
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      reviewer: r.reviewer_name,
      shop: { id: r.shop_id, slug: null, slugAr: null, name: shop?.name ?? "", nameAr: null },
      area: { en: area?.nameEn ?? null, ar: area?.nameAr ?? null },
    };
  }).filter((r) => r.rating >= 4);
  return { ...FALLBACK_SHELL, stats, cityStats: stats, reviews, defaultCity: FALLBACK_CITY };
}

async function client(): Promise<(TableClient & SearchRpcClient) | null> {
  if (MOCK_DATA_ENABLED) return null;
  try {
    return (await createClient()) as unknown as TableClient & SearchRpcClient;
  } catch {
    return null;
  }
}

/** Cities (with areas) and service categories for the search bar. */
export async function loadSearchShell(): Promise<SearchShellData> {
  const c = await client();
  if (!c) return FALLBACK_SHELL;
  const [cities, categories] = await Promise.all([fetchPlaces(c), fetchCategories(c)]);
  return withFallbacks({ cities, categories });
}

/** Everything the consumer home renders on the server. */
export async function loadHomeData(): Promise<HomeData> {
  if (MOCK_DATA_ENABLED) return mockHomeData();
  const c = await client();
  if (!c) return { ...FALLBACK_SHELL, cityStats: null, stats: null, reviews: [], defaultCity: FALLBACK_CITY };
  const [places, cats] = await Promise.all([fetchPlaces(c), fetchCategories(c)]);
  const { cities, categories } = withFallbacks({ cities: places, categories: cats });
  const defaultCity = findCity(cities, DEFAULT_CITY_SLUG);
  const [stats, cityStats, reviews] = await Promise.all([
    fetchPublicStats(c, null),
    defaultCity && !defaultCity.id.startsWith("fallback-") ? fetchPublicStats(c, defaultCity.id) : Promise.resolve(null),
    fetchRecentReviews(c, null, 12),
  ]);
  return { cities, categories, stats, cityStats, reviews, defaultCity };
}
