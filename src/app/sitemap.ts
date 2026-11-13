import type { MetadataRoute } from "next";
import { MOCK_MODE, publicEnv } from "@/lib/env";
import { MOCK_SHOPS } from "@/lib/mock-data";

// Regenerated at most hourly so newly created shops appear without a deploy.
export const revalidate = 3600;

const LOCALES = ["en", "ar"] as const;

/** Public, indexable pages (without the locale prefix). /auth/login is noindex, so it is not listed. */
const STATIC_PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/landing", priority: 1, changeFrequency: "weekly" },
  { path: "/explore", priority: 0.9, changeFrequency: "daily" },
  { path: "/auth/signup", priority: 0.5, changeFrequency: "yearly" },
  { path: "/policy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

function siteOrigin(): string {
  const candidates = [
    publicEnv.siteUrl,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // try the next candidate
    }
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

interface ShopRow {
  id: string;
  created_at?: string | null;
}

/**
 * Public shops via the PostgREST endpoint with the anon key (RLS + column
 * grants allow anon to read `id, created_at`). Never throws: a sitemap
 * without shop pages is better than a 500.
 */
async function listPublicShops(): Promise<ShopRow[]> {
  if (MOCK_MODE) return MOCK_SHOPS.map((s) => ({ id: s.id }));
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return [];
  try {
    const url = new URL("/rest/v1/shops", publicEnv.supabaseUrl);
    url.searchParams.set("select", "id,created_at");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "5000");
    const res = await fetch(url, {
      headers: {
        apikey: publicEnv.supabaseAnonKey,
        Authorization: `Bearer ${publicEnv.supabaseAnonKey}`,
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate },
    });
    if (!res.ok) return [];
    const rows: unknown = await res.json();
    return Array.isArray(rows)
      ? rows.filter((r): r is ShopRow => typeof r === "object" && r !== null && typeof (r as ShopRow).id === "string")
      : [];
  } catch {
    return [];
  }
}

function localizedEntries(
  origin: string,
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
): MetadataRoute.Sitemap {
  const languages = {
    en: `${origin}/en${path}`,
    ar: `${origin}/ar${path}`,
    "x-default": `${origin}/en${path}`,
  };
  return LOCALES.map((locale) => ({
    url: `${origin}/${locale}${path}`,
    alternates: { languages },
    ...extra,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const now = new Date();

  const staticEntries = STATIC_PAGES.flatMap(({ path, priority, changeFrequency }) =>
    localizedEntries(origin, path, { lastModified: now, priority, changeFrequency }),
  );

  const shops = await listPublicShops();
  const shopEntries = shops.flatMap((shop) =>
    localizedEntries(origin, `/shop/${encodeURIComponent(shop.id)}`, {
      lastModified: shop.created_at ? new Date(shop.created_at) : now,
      priority: 0.8,
      changeFrequency: "weekly",
    }),
  );

  return [...staticEntries, ...shopEntries];
}
