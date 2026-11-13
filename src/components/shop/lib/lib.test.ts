import { describe, expect, it } from "vitest";
import { CHECKLIST, parseIncompleteDetail, summarizeChecklist } from "./checklist";
import {
  centerCrop,
  changedOrder,
  fitWithin,
  localizedText,
  mediaPath,
  moveItem,
  pathFromPublicUrl,
  publicMediaUrl,
  validateImageFile,
} from "./media";
import { barberPath, carryQuery, normalizeHandle, parseHandle, parseShopKey, shopPath } from "./slug";
import { googleMapsDirectionsUrl, isValidLatLng, pixelToLatLng, project, tileSource, unproject, wazeUrl } from "./map";
import { buildBarberJsonLd, buildShopJsonLd, openingHoursSpecification, priceRangeText, serializeJsonLd } from "./jsonld";
import { groupServicesByCategory, minPrice, OTHER_CATEGORY } from "./services";
import { dayDiff, localDateIn, relativeDay } from "./when";
import { barberBookingHref, readSrc } from "./booking";
import { siteOrigin } from "./site";
import type { BarberData, ShopData } from "./types";

const SHOP_ID = "11111111-2222-4333-8444-555555555555";
const PROFILE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("checklist", () => {
  it("scores 0 when empty and blocks publishing on required items", () => {
    const s = summarizeChecklist({});
    expect(s.score).toBe(0);
    expect(s.canPublish).toBe(false);
    expect(s.missingRequired).toEqual(["name", "services", "hours", "location"]);
    expect(s.next?.key).toBe("name");
  });

  it("allows publishing once required items are done and suggests the next recommended one", () => {
    const s = summarizeChecklist({ name: true, services: true, hours: true, location: true });
    expect(s.canPublish).toBe(true);
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(100);
    expect(s.next?.key).toBe("photos");
  });

  it("is 100 when everything is done", () => {
    const all = Object.fromEntries(CHECKLIST.map((i) => [i.key, true]));
    const s = summarizeChecklist(all);
    expect(s.score).toBe(100);
    expect(s.next).toBeNull();
  });

  it("parses SHOP_INCOMPLETE details and ignores unknown keys", () => {
    expect(parseIncompleteDetail("services, location,bogus")).toEqual(["services", "location"]);
    expect(parseIncompleteDetail(null)).toEqual([]);
  });
});

describe("media", () => {
  it("builds object paths inside the shop folder", () => {
    expect(mediaPath("photos", SHOP_ID, "abc")).toBe(`${SHOP_ID}/photos/abc.webp`);
    expect(mediaPath("barber", SHOP_ID, "x/../y", PROFILE_ID, "JPG")).toBe(`${SHOP_ID}/barbers/${PROFILE_ID}/xy.jpg`);
    expect(() => mediaPath("photos", "../etc", "a")).toThrow("INVALID_SHOP_ID");
    expect(() => mediaPath("barber", SHOP_ID, "a")).toThrow("INVALID_PROFILE_ID");
  });

  it("round-trips public URLs", () => {
    const url = publicMediaUrl("https://x.supabase.co/", `${SHOP_ID}/photos/a b.webp`);
    expect(url).toBe(`https://x.supabase.co/storage/v1/object/public/shop-media/${SHOP_ID}/photos/a%20b.webp`);
    expect(pathFromPublicUrl(url)).toBe(`${SHOP_ID}/photos/a b.webp`);
    expect(publicMediaUrl("https://x.supabase.co", "https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
    expect(publicMediaUrl(null, "a")).toBeNull();
    expect(pathFromPublicUrl("https://elsewhere/a.png")).toBeNull();
  });

  it("validates files", () => {
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/gif", size: 1000 })).toBe("type");
    expect(validateImageFile({ type: "image/jpeg", size: 30 * 1024 * 1024 })).toBe("size");
  });

  it("fits and crops without upscaling", () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 10, 100)).toEqual({ width: 0, height: 0 });
    expect(centerCrop(1000, 1000, 16 / 9)).toEqual({ sx: 0, sy: 219, sw: 1000, sh: 563 });
    expect(centerCrop(2000, 1000, 1)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
  });

  it("reorders and reports only changed rows", () => {
    const items = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 1 },
      { id: "c", sort_order: 2 },
    ];
    const moved = moveItem(items, 2, 0);
    expect(moved.map((i) => i.id)).toEqual(["c", "a", "b"]);
    expect(changedOrder(items, moved)).toEqual([
      { id: "c", sort_order: 0 },
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
    expect(changedOrder(items, moveItem(items, 5, 0))).toEqual([]);
  });

  it("falls back between languages for alt text", () => {
    expect(localizedText("ar", "Chair", null)).toBe("Chair");
    expect(localizedText("ar", "Chair", "كرسي")).toBe("كرسي");
    expect(localizedText("en", " ", "", "Photo 1")).toBe("Photo 1");
  });
});

describe("slug", () => {
  it("classifies shop keys", () => {
    expect(parseShopKey(SHOP_ID.toUpperCase())).toEqual({ kind: "id", value: SHOP_ID });
    expect(parseShopKey("Abu-Ali-Barber")).toEqual({ kind: "slug", value: "abu-ali-barber" });
    expect(parseShopKey(encodeURIComponent("صالون-ابو-علي"))).toEqual({ kind: "slug_ar", value: "صالون-ابو-علي" });
    expect(parseShopKey("bad slug!")).toEqual({ kind: "invalid" });
    expect(parseShopKey("%E0%A4%A")).toEqual({ kind: "invalid" });
  });

  it("builds localized canonical paths", () => {
    const shop = { id: SHOP_ID, slug: "abu-ali", slug_ar: "ابو-علي" };
    expect(shopPath(shop, "en")).toBe("/en/shop/abu-ali");
    expect(shopPath(shop, "ar")).toBe(`/ar/shop/${encodeURIComponent("ابو-علي")}`);
    expect(shopPath({ id: SHOP_ID }, "fr")).toBe(`/en/shop/${SHOP_ID}`);
    expect(barberPath("sami", "ar")).toBe("/ar/barber/sami");
  });

  it("parses and normalises handles", () => {
    expect(parseHandle("Sami-Haddad")).toBe("sami-haddad");
    expect(parseHandle("a")).toBeNull();
    expect(parseHandle("../x")).toBeNull();
    expect(normalizeHandle("  Sámi  Haddad!! ")).toBe("sami-haddad");
  });

  it("carries only safe query params", () => {
    expect(carryQuery({ src: "ig", entry: "share", evil: "<script>", "x-y": "1", arr: ["a", "b"] })).toBe("?src=ig&entry=share&arr=a");
    expect(carryQuery(null)).toBe("");
  });
});

describe("map", () => {
  it("projects and unprojects", () => {
    const p = { lat: 31.9539, lng: 35.9106 };
    const back = unproject(project(p, 15), 15);
    expect(back.lat).toBeCloseTo(p.lat, 6);
    expect(back.lng).toBeCloseTo(p.lng, 6);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng("31", 35)).toBe(false);
  });

  it("maps the viewport centre pixel back to the centre", () => {
    const center = { lat: 31.95, lng: 35.91 };
    const p = pixelToLatLng(center, 14, 400, 300, 200, 150);
    expect(p.lat).toBeCloseTo(center.lat, 6);
    expect(p.lng).toBeCloseTo(center.lng, 6);
  });

  it("uses OSM without a MapTiler key", () => {
    expect(tileSource(undefined).url({ x: 1, y: 2, z: 3 })).toBe("https://tile.openstreetmap.org/3/1/2.png");
    expect(tileSource("bad key!").url({ x: 1, y: 2, z: 3 })).toContain("openstreetmap");
    expect(tileSource("abcdefgh1234").url({ x: 1, y: 2, z: 3 })).toContain("api.maptiler.com");
  });

  it("builds Google Maps and Waze links", () => {
    expect(googleMapsDirectionsUrl({ lat: 31.1234567, lng: 35.7654321 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=31.123457,35.765432",
    );
    expect(googleMapsDirectionsUrl(null, "Khalda, Amman")).toContain("Khalda%2C%20Amman");
    expect(googleMapsDirectionsUrl(null, " ")).toBeNull();
    expect(wazeUrl({ lat: 31.9, lng: 35.9 })).toBe("https://waze.com/ul?ll=31.9,35.9&navigate=yes");
    expect(wazeUrl(null)).toBeNull();
  });
});

const baseShop: ShopData = {
  id: SHOP_ID,
  name: "Abu Ali",
  name_ar: "أبو علي",
  description: "Classic cuts",
  description_ar: null,
  address: "Khalda",
  phone: "+962790000000",
  whatsapp: null,
  instagram: null,
  google_maps_url: "https://maps.google.com/?q=x",
  currency: "JOD",
  timezone: "Asia/Amman",
  cancellation_policy_hours: 24,
  slug: "abu-ali",
  slug_ar: null,
  lat: 31.99,
  lng: 35.85,
  landmark_en: null,
  landmark_ar: null,
  city_id: null,
  area_id: null,
  is_published: true,
  marketplace_visible: true,
  is_verified: false,
  cover_url: null,
  logo_url: null,
};

describe("jsonld", () => {
  it("groups opening hours", () => {
    const spec = openingHoursSpecification([
      { day: 1, open: "09:00", close: "21:00" },
      { day: 0, open: "09:00", close: "21:00" },
      { day: 5, open: "14:00", close: "22:00" },
      { day: 6, open: null, close: null },
    ]);
    expect(spec).toHaveLength(2);
    expect(spec[0].dayOfWeek).toEqual(["https://schema.org/Sunday", "https://schema.org/Monday"]);
  });

  it("formats price ranges", () => {
    expect(priceRangeText([{ price: 5 }, { price: 12.5 }])).toBe("JOD 5-12.5");
    expect(priceRangeText([{ price: 7 }])).toBe("JOD 7");
    expect(priceRangeText([{ price: 0 }])).toBeNull();
  });

  it("builds HairSalon + BreadcrumbList with geo, offers and reserve action", () => {
    const [business, breadcrumb] = buildShopJsonLd({
      shop: baseShop,
      locale: "en",
      url: "https://halaqy.jo/en/shop/abu-ali",
      bookUrl: "https://halaqy.jo/en/book/x",
      homeUrl: "https://halaqy.jo/en",
      exploreUrl: "https://halaqy.jo/en/explore",
      city: { name_en: "Amman", name_ar: "عمّان" },
      area: { name_en: "Khalda", name_ar: "خلدا" },
      services: [{ id: "s", name: "Fade", name_ar: "فيد", duration: 30, price: 6, category_id: null }],
      hours: [{ day: 0, open: "09:00", close: "21:00" }],
      photos: [{ url: "https://img/1.webp" }],
      rating: { average: 4.86, count: 12 },
      instagramUrl: "https://instagram.com/abuali",
      labels: { home: "Home", explore: "Barbershops" },
    });
    expect(business["@type"]).toBe("HairSalon");
    expect(business.alternateName).toBe("أبو علي");
    expect(business.geo).toEqual({ "@type": "GeoCoordinates", latitude: 31.99, longitude: 35.85 });
    expect(business.priceRange).toBe("JOD 6");
    expect(business.sameAs).toEqual(["https://instagram.com/abuali", "https://maps.google.com/?q=x"]);
    expect((business.aggregateRating as { ratingValue: number }).ratingValue).toBe(4.9);
    expect((business.potentialAction as { "@type": string })["@type"]).toBe("ReserveAction");
    expect((business.hasOfferCatalog as { itemListElement: unknown[] }).itemListElement).toHaveLength(1);
    expect(breadcrumb["@type"]).toBe("BreadcrumbList");
  });

  it("builds a Person for barbers and escapes script breakers", () => {
    const barber: BarberData = {
      id: PROFILE_ID,
      full_name: "Sami",
      avatar_url: null,
      handle: "sami",
      title_en: null,
      title_ar: "حلاق أول",
      bio_en: null,
      bio_ar: null,
      languages: ["ar", "en"],
      years_experience: 5,
      is_public: true,
      rating_avg: null,
      rating_count: 0,
    };
    const p = buildBarberJsonLd({ barber, shopName: "Abu Ali", shopUrl: "u", url: "b", locale: "ar", imageUrl: null });
    expect(p.jobTitle).toBe("حلاق أول");
    expect(p.knowsLanguage).toEqual(["ar", "en"]);
    expect(serializeJsonLd({ a: "</script>\u2028" })).toBe('{"a":"\\u003c/script>\\u2028"}');
  });
});

describe("services", () => {
  it("groups by category order with uncategorised last, dropping empty groups", () => {
    const cats = [
      { id: "c2", slug: "beard", name_en: "Beard", name_ar: "دقن", sort: 2 },
      { id: "c1", slug: "haircut", name_en: "Haircut", name_ar: "حلاقة", sort: 1 },
      { id: "c3", slug: "kids", name_en: "Kids", name_ar: "أطفال", sort: 3 },
    ];
    const svc = (id: string, category_id: string | null, price = 5) => ({ id, name: id, name_ar: null, duration: 30, price, category_id });
    const groups = groupServicesByCategory([svc("a", "c2"), svc("b", null), svc("c", "c1"), svc("d", "zz")], cats);
    expect(groups.map((g) => g.id)).toEqual(["c1", "c2", OTHER_CATEGORY]);
    expect(groups[2].services.map((s) => s.id)).toEqual(["b", "d"]);
    expect(minPrice([{ price: 0 }, { price: 4.5 }, { price: 3 }])).toBe(3);
    expect(minPrice([])).toBeNull();
  });
});

describe("when / booking / site", () => {
  it("computes local dates and relative days", () => {
    expect(localDateIn(new Date("2026-11-13T22:30:00Z"), "Asia/Amman")).toBe("2026-11-14");
    expect(localDateIn(new Date("2026-11-13T10:00:00Z"), "Not/AZone")).toBe("2026-11-13");
    expect(dayDiff("2026-12-31", "2027-01-01")).toBe(1);
    expect(relativeDay("2026-11-14", "2026-11-14")).toBe("today");
    expect(relativeDay("2026-11-15", "2026-11-14")).toBe("tomorrow");
    expect(relativeDay("2026-11-20", "2026-11-14")).toBe("date");
  });

  it("preselects the barber in booking links", () => {
    const href = barberBookingHref({ locale: "en", shopId: SHOP_ID, barberId: PROFILE_ID, entry: "other", src: "barber_page" });
    expect(href).toContain(`/en/book/${SHOP_ID}`);
    expect(href).toContain(`barber=${PROFILE_ID}`);
    expect(href).toContain("src=barber_page");
  });

  it("reads only safe src tokens", () => {
    expect(readSrc({ src: "instagram" })).toBe("instagram");
    expect(readSrc(new URLSearchParams("src=<x>"))).toBeNull();
    expect(readSrc({ src: ["a", "b"] })).toBe("a");
  });

  it("resolves the site origin", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://halaqy.jo/path" })).toBe("https://halaqy.jo");
    expect(siteOrigin({ VERCEL_URL: "x.vercel.app" })).toBe("https://x.vercel.app");
    expect(siteOrigin({})).toBe("http://localhost:3000");
  });
});
