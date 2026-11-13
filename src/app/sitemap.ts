import type { MetadataRoute } from "next";
import { MOCK_MODE, publicEnv } from "@/lib/env";
import { MOCK_SHOPS } from "@/lib/mock-data";
import { barberPath, shopPath } from "@/components/shop/lib/slug";

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
  slug?: string | null;
  slug_ar?: string | null;
  created_at?: string | null;
}

interface BarberRow {
  handle: string;
  shop_id: string | null;
}

/**
 * Anonymous PostgREST read (RLS + column grants decide what anon sees).
 * Never throws: a sitemap without these pages is better than a 500.
 */
async function anonRows<T>(table: string, params: Record<string, string>, isRow: (r: unknown) => r is T): Promise<T[]> {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return [];
  try {
    const url = new URL(`/rest/v1/${table}`, publicEnv.supabaseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
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
    return Array.isArray(rows) ? rows.filter(isRow) : [];
  } catch {
    return [];
  }
}

/** Published shops that chose to be listed in the marketplace. */
async function listPublicShops(): Promise<ShopRow[]> {
  if (MOCK_MODE) return MOCK_SHOPS.map((s) => ({ id: s.id }));
  return anonRows<ShopRow>(
    "shops",
    {
      select: "id,slug,slug_ar,created_at",
      is_published: "eq.true",
      marketplace_visible: "eq.true",
      order: "created_at.desc",
      limit: "5000",
    },
    (r): r is ShopRow => typeof r === "object" && r !== null && typeof (r as ShopRow).id === "string",
  );
}

/** Public barbers with a handle, limited to the listed shops above. */
async function listPublicBarbers(shopIds: Set<string>): Promise<BarberRow[]> {
  if (MOCK_MODE || shopIds.size === 0) return [];
  const rows = await anonRows<BarberRow>(
    "profiles",
    { select: "handle,shop_id", is_public: "eq.true", handle: "not.is.null", limit: "10000" },
    (r): r is BarberRow => typeof r === "object" && r !== null && typeof (r as BarberRow).handle === "string",
  );
  return rows.filter((b) => b.shop_id && shopIds.has(b.shop_id));
}

/** One entry per locale where each locale may have its own path (Arabic slug on /ar). */
function pathEntries(
  origin: string,
  pathFor: (locale: (typeof LOCALES)[number]) => string,
  extra: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
): MetadataRoute.Sitemap {
  const languages = {
    en: `${origin}${pathFor("en")}`,
    ar: `${origin}${pathFor("ar")}`,
    "x-default": `${origin}${pathFor("en")}`,
  };
  return LOCALES.map((locale) => ({ url: languages[locale], alternates: { languages }, ...extra }));
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
    pathEntries(origin, (locale) => shopPath(shop, locale), {
      lastModified: shop.created_at ? new Date(shop.created_at) : now,
      priority: 0.8,
      changeFrequency: "weekly",
    }),
  );

  const barbers = await listPublicBarbers(new Set(shops.map((s) => s.id)));
  const barberEntries = barbers.flatMap((b) =>
    pathEntries(origin, (locale) => barberPath(b.handle, locale), {
      lastModified: now,
      priority: 0.6,
      changeFrequency: "weekly",
    }),
  );

  return [...staticEntries, ...shopEntries, ...barberEntries];
}
