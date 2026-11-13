import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { buildShopJsonLd, serializeJsonLd } from "@/components/shop/lib/jsonld";
import { carryQuery, parseShopKey, shopPath } from "@/components/shop/lib/slug";
import { readSrc } from "@/components/shop/lib/booking";
import { siteOrigin } from "@/components/shop/lib/site";
import { computeWeeklyHours, instagramUrl, summarizeRatings } from "../shop-utils";
import { loadShopProfile, type ShopProfileResult } from "./shop-data";
import ShopProfileClient from "./shop-profile-client";

type Params = Promise<{ locale: string; shop_id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/**
 * Server fetch (deduped between generateMetadata and the page). Returns null
 * when the server cannot answer — mock mode (mock data lives in the browser
 * client) or a transient failure — and the client component fetches instead.
 * Unpublished shops are "not_found" except for their own staff (preview).
 */
const getShopProfile = cache(async (key: string): Promise<ShopProfileResult | null> => {
  if (MOCK_DATA_ENABLED) return null;
  if (parseShopKey(key).kind === "invalid") return { status: "not_found" };
  try {
    const supabase = await createClient();
    const result = await loadShopProfile(supabase, key);
    return result.status === "error" ? null : result;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, shop_id } = await params;
  const t = locale === "ar" ? ar : en;
  const result = await getShopProfile(shop_id);

  if (result?.status === "not_found") {
    return { title: t.shopPage.notFoundTitle, robots: { index: false } };
  }
  if (!result || result.status !== "ok") {
    return { title: t.explore.bookNow };
  }

  const { shop, photos, preview } = result.data;
  const name = (locale === "ar" && shop.name_ar) || shop.name;
  const title = fill(t.shopPage.metaTitle, { name });
  const localDescription = (locale === "ar" ? shop.description_ar : shop.description) || shop.description || shop.description_ar;
  const description = (localDescription?.trim() || fill(t.shopPage.metaDescription, { name })).slice(0, 300);
  const image = photos[0]?.url ?? shop.cover_url ?? null;
  const loc = locale === "ar" ? "ar" : "en";

  return {
    title,
    description,
    alternates: {
      canonical: shopPath(shop, loc),
      languages: { en: shopPath(shop, "en"), ar: shopPath(shop, "ar"), "x-default": shopPath(shop, "en") },
    },
    // Previews of unpublished shops must never be indexed.
    ...(preview ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      locale: loc === "ar" ? "ar_JO" : "en_US",
      alternateLocale: loc === "ar" ? ["en_US"] : ["ar_JO"],
      url: shopPath(shop, loc),
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ShopPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, shop_id } = await params;
  const search = await searchParams;
  const result = await getShopProfile(shop_id);
  if (result?.status === "not_found") notFound();

  const data = result?.status === "ok" ? result.data : null;
  const loc = locale === "ar" ? "ar" : "en";

  // Old UUID links → readable slug URL (permanent).
  if (data && parseShopKey(shop_id).kind === "id" && data.shop.slug) {
    permanentRedirect(`${shopPath(data.shop, loc)}${carryQuery(search)}`);
  }

  let jsonLd: string | null = null;
  if (data && !data.preview) {
    const t = loc === "ar" ? ar : en;
    const origin = siteOrigin();
    const url = `${origin}${shopPath(data.shop, loc)}`;
    const ratings = summarizeRatings(data.ratings);
    jsonLd = serializeJsonLd(
      buildShopJsonLd({
        shop: data.shop,
        locale: loc,
        url,
        bookUrl: `${origin}/${loc}/book/${encodeURIComponent(data.shop.id)}?entry=other&src=schema`,
        homeUrl: `${origin}/${loc}`,
        exploreUrl: `${origin}/${loc}/explore`,
        city: data.city,
        area: data.area,
        services: data.services,
        hours: computeWeeklyHours(data.hours),
        photos: data.photos,
        rating: ratings,
        instagramUrl: instagramUrl(data.shop.instagram),
        labels: { home: t.shopPage.home, explore: t.shopPage.barbers },
      }),
    );
  }

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <ShopProfileClient shopKey={shop_id} initialData={data} src={readSrc(search)} />
    </>
  );
}
