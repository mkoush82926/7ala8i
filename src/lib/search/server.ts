// Server-side loaders for the consumer home (/landing) and results (/explore)
// pages. Kept out of ./index so the browser bundle never pulls the server
// Supabase client. Every loader is best-effort: a failure (or mock mode,
// where data lives in the browser client) yields empty data and the page
// still renders; client islands fetch what they need themselves.

import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
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

const EMPTY_SHELL: SearchShellData = { cities: [], categories: [] };

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
  if (!c) return EMPTY_SHELL;
  const [cities, categories] = await Promise.all([fetchPlaces(c), fetchCategories(c)]);
  return { cities, categories };
}

/** Everything the consumer home renders on the server. */
export async function loadHomeData(): Promise<HomeData> {
  const c = await client();
  if (!c) return { ...EMPTY_SHELL, cityStats: null, stats: null, reviews: [], defaultCity: null };
  const [cities, categories] = await Promise.all([fetchPlaces(c), fetchCategories(c)]);
  const defaultCity = findCity(cities, DEFAULT_CITY_SLUG);
  const [stats, cityStats, reviews] = await Promise.all([
    fetchPublicStats(c, null),
    defaultCity ? fetchPublicStats(c, defaultCity.id) : Promise.resolve(null),
    fetchRecentReviews(c, null, 12),
  ]);
  return { cities, categories, stats, cityStats, reviews, defaultCity };
}
