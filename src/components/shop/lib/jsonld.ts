/**
 * schema.org structured data for the public shop and barber pages.
 * Pure: the page passes absolute URLs and pre-computed hours.
 */
import type { BarberData, PlaceName, ServiceData, ShopData, ShopPhoto, WorkingHourRow } from "./types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export interface DayHoursLike {
  day: number;
  open: string | null;
  close: string | null;
}

/** OpeningHoursSpecification grouped by identical open/close times. */
export function openingHoursSpecification(hours: readonly DayHoursLike[]): Record<string, unknown>[] {
  const groups = new Map<string, number[]>();
  for (const h of hours) {
    if (!h.open || !h.close) continue;
    const key = `${h.open}|${h.close}`;
    groups.set(key, [...(groups.get(key) ?? []), h.day]);
  }
  return [...groups.entries()].map(([key, days]) => {
    const [opens, closes] = key.split("|");
    return {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days.sort((a, b) => a - b).map((d) => `https://schema.org/${DAY_NAMES[d]}`),
      opens,
      closes,
    };
  });
}

/** "JOD 5–20" from service prices; null without priced services. */
export function priceRangeText(services: readonly Pick<ServiceData, "price">[], currency = "JOD"): string | null {
  const prices = services.map((s) => Number(s.price)).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${currency} ${fmt(min)}` : `${currency} ${fmt(min)}-${fmt(max)}`;
}

/** Links that identify the same business elsewhere (Instagram, Maps). */
export function sameAsLinks(shop: Pick<ShopData, "instagram" | "google_maps_url">, instagramUrl: string | null): string[] {
  const out: string[] = [];
  if (instagramUrl) out.push(instagramUrl);
  const maps = (shop.google_maps_url ?? "").trim();
  if (/^https:\/\//i.test(maps)) out.push(maps);
  return out;
}

export interface ShopJsonLdInput {
  shop: ShopData;
  locale: string;
  /** Absolute canonical page URL. */
  url: string;
  /** Absolute booking URL. */
  bookUrl: string;
  /** Absolute home URL (breadcrumb root). */
  homeUrl: string;
  /** Absolute explore URL (breadcrumb level 2). */
  exploreUrl: string;
  city: PlaceName | null;
  area: PlaceName | null;
  services: ServiceData[];
  hours: DayHoursLike[];
  photos: Pick<ShopPhoto, "url">[];
  rating: { average: number; count: number };
  instagramUrl: string | null;
  labels: { home: string; explore: string };
}

export function buildShopJsonLd(input: ShopJsonLdInput): Record<string, unknown>[] {
  const { shop, locale, url } = input;
  const ar = locale === "ar";
  const name = (ar && shop.name_ar) || shop.name;
  const description = ((ar ? shop.description_ar : shop.description) || shop.description || shop.description_ar || "").trim();
  const images = input.photos.map((p) => p.url).filter(Boolean).slice(0, 10);
  if (images.length === 0 && shop.cover_url) images.push(shop.cover_url);
  const locality = input.area ? (ar ? input.area.name_ar : input.area.name_en) : null;
  const region = input.city ? (ar ? input.city.name_ar : input.city.name_en) : null;
  const priceRange = priceRangeText(input.services, shop.currency || "JOD");
  const hoursSpec = openingHoursSpecification(input.hours);
  const sameAs = sameAsLinks(shop, input.instagramUrl);
  const priced = input.services.filter((s) => Number(s.price) > 0).slice(0, 50);

  const business: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": `${url}#business`,
    name,
    url,
    ...(shop.name_ar && !ar ? { alternateName: shop.name_ar } : {}),
    ...(ar && shop.name_ar && shop.name !== shop.name_ar ? { alternateName: shop.name } : {}),
    ...(description ? { description: description.slice(0, 500) } : {}),
    ...(images.length ? { image: images } : {}),
    ...(shop.logo_url ? { logo: shop.logo_url } : {}),
    ...(shop.phone ? { telephone: shop.phone } : {}),
    address: {
      "@type": "PostalAddress",
      ...(shop.address ? { streetAddress: shop.address } : {}),
      ...(locality ? { addressLocality: locality } : {}),
      ...(region ? { addressRegion: region } : {}),
      addressCountry: "JO",
    },
    ...(shop.lat != null && shop.lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: shop.lat, longitude: shop.lng } }
      : {}),
    ...(shop.google_maps_url && /^https:\/\//i.test(shop.google_maps_url) ? { hasMap: shop.google_maps_url } : {}),
    ...(hoursSpec.length ? { openingHoursSpecification: hoursSpec } : {}),
    ...(priceRange ? { priceRange } : {}),
    currenciesAccepted: shop.currency || "JOD",
    ...(sameAs.length ? { sameAs } : {}),
    ...(priced.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: ar ? "الخدمات" : "Services",
            itemListElement: priced.map((s) => ({
              "@type": "Offer",
              price: Number(s.price).toFixed(2),
              priceCurrency: shop.currency || "JOD",
              itemOffered: {
                "@type": "Service",
                name: (ar && s.name_ar) || s.name,
                ...(s.duration ? { duration: `PT${Math.round(s.duration)}M` } : {}),
              },
            })),
          },
        }
      : {}),
    ...(input.rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(input.rating.average.toFixed(1)),
            reviewCount: input.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: input.bookUrl,
        inLanguage: ar ? "ar" : "en",
        actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"],
      },
      result: { "@type": "Reservation", name: ar ? "حجز موعد" : "Appointment" },
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: input.labels.home, item: input.homeUrl },
      { "@type": "ListItem", position: 2, name: input.labels.explore, item: input.exploreUrl },
      { "@type": "ListItem", position: 3, name, item: url },
    ],
  };

  return [business, breadcrumb];
}

export interface BarberJsonLdInput {
  barber: BarberData;
  shopName: string;
  shopUrl: string;
  url: string;
  locale: string;
  imageUrl: string | null;
}

export function buildBarberJsonLd(input: BarberJsonLdInput): Record<string, unknown> {
  const { barber, locale } = input;
  const ar = locale === "ar";
  const title = ((ar ? barber.title_ar : barber.title_en) || barber.title_en || barber.title_ar || "").trim();
  const bio = ((ar ? barber.bio_ar : barber.bio_en) || barber.bio_en || barber.bio_ar || "").trim();
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${input.url}#person`,
    name: barber.full_name,
    url: input.url,
    jobTitle: title || (ar ? "حلاق" : "Barber"),
    ...(bio ? { description: bio.slice(0, 500) } : {}),
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    ...(barber.languages.length ? { knowsLanguage: barber.languages } : {}),
    worksFor: { "@type": "HairSalon", name: input.shopName, url: input.shopUrl },
  };
}

/** Serialises JSON-LD for a <script> tag ("<" escaped so text cannot close it). */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Narrow WorkingHourRow import for callers that only have rows. */
export type { WorkingHourRow };
