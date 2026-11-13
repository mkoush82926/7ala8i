import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { summarizeRatings, UUID_RE } from "../shop-utils";
import { loadShopProfile, type ShopProfileResult } from "./shop-data";
import ShopProfileClient from "./shop-profile-client";

type Params = Promise<{ locale: string; shop_id: string }>;

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/**
 * Server fetch (deduped between generateMetadata and the page). Returns null
 * when the server cannot answer — mock mode (mock data lives in the browser
 * client) or a transient failure — and the client component fetches instead.
 */
const getShopProfile = cache(async (shopId: string): Promise<ShopProfileResult | null> => {
  if (MOCK_DATA_ENABLED) return null;
  if (!UUID_RE.test(shopId)) return { status: "not_found" };
  try {
    const supabase = await createClient();
    const result = await loadShopProfile(supabase, shopId);
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

  const { shop } = result.data;
  const title = fill(t.shopPage.metaTitle, { name: shop.name });
  const description = (shop.description?.trim() || fill(t.shopPage.metaDescription, { name: shop.name })).slice(0, 300);
  const path = (l: string) => `/${l}/shop/${shop.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: path(locale === "ar" ? "ar" : "en"),
      languages: { en: path("en"), ar: path("ar"), "x-default": path("en") },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "ar" ? "ar_JO" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_JO"],
      url: path(locale === "ar" ? "ar" : "en"),
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function ShopPage({ params }: { params: Params }) {
  const { shop_id } = await params;
  const result = await getShopProfile(shop_id);
  if (result?.status === "not_found") notFound();

  const data = result?.status === "ok" ? result.data : null;

  // schema.org structured data so search engines can show rating, address and phone.
  let jsonLd: string | null = null;
  if (data) {
    const { shop } = data;
    const ratings = summarizeRatings(data.ratings);
    const ld: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "HairSalon",
      name: shop.name,
      ...(shop.description ? { description: shop.description } : {}),
      ...(shop.address ? { address: shop.address } : {}),
      ...(shop.phone ? { telephone: shop.phone } : {}),
      ...(shop.google_maps_url ? { hasMap: shop.google_maps_url } : {}),
      ...(ratings.count > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(ratings.average.toFixed(1)),
              reviewCount: ratings.count,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    };
    // Escape "<" so a shop name can never close the script tag.
    jsonLd = JSON.stringify(ld).replace(/</g, "\\u003c");
  }

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <ShopProfileClient shopId={shop_id} initialData={data} />
    </>
  );
}
