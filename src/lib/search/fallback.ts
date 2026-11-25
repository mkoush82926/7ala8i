// Static browse fallbacks for the consumer home and the search bar.
//
// The home page must never collapse to "hero → how it works" just because the
// places/categories tables are empty or unreachable (fresh database, mock
// preview, transient error). These mirror the seed rows in
// supabase/migrations/20250101001900_marketplace_spine.sql — same slugs, so
// links built from them resolve against a seeded database. IDs are synthetic
// ("fallback-…"); the search RPC ignores ids it doesn't know.

import type { SearchCategory, SearchCity } from "./types";

export const FALLBACK_CATEGORIES: SearchCategory[] = [
  { id: "fallback-cat-haircut", slug: "haircut", nameEn: "Haircut", nameAr: "قص شعر", icon: "scissors" },
  { id: "fallback-cat-fade", slug: "fade", nameEn: "Fade", nameAr: "تدريج (فيد)", icon: "gradient" },
  { id: "fallback-cat-beard", slug: "beard", nameEn: "Beard", nameAr: "لحية", icon: "beard" },
  { id: "fallback-cat-shave", slug: "shave", nameEn: "Shave", nameAr: "حلاقة على الموس", icon: "razor" },
  { id: "fallback-cat-kids", slug: "kids", nameEn: "Kids", nameAr: "أطفال", icon: "child" },
  { id: "fallback-cat-styling", slug: "styling", nameEn: "Styling", nameAr: "تسريح وسشوار", icon: "comb" },
  { id: "fallback-cat-colour", slug: "colour", nameEn: "Colour", nameAr: "صبغة", icon: "palette" },
  { id: "fallback-cat-packages", slug: "packages", nameEn: "Packages", nameAr: "باقات", icon: "gift" },
];

const area = (slug: string, nameEn: string, nameAr: string, lat: number, lng: number) => ({
  id: `fallback-area-${slug}`,
  slug,
  slugAr: null,
  nameEn,
  nameAr,
  lat,
  lng,
});

export const FALLBACK_CITY: SearchCity = {
  id: "fallback-city-amman",
  slug: "amman",
  slugAr: "عمان",
  nameEn: "Amman",
  nameAr: "عمّان",
  lat: 31.9539,
  lng: 35.9106,
  areas: [
    area("abdoun", "Abdoun", "عبدون", 31.9445, 35.884),
    area("sweifieh", "Sweifieh", "الصويفية", 31.956, 35.861),
    area("shmeisani", "Shmeisani", "الشميساني", 31.97, 35.901),
    area("jabal-amman", "Jabal Amman", "جبل عمّان", 31.952, 35.917),
    area("weibdeh", "Weibdeh", "اللويبدة", 31.961, 35.924),
    area("khalda", "Khalda", "خلدا", 31.999, 35.84),
    area("tla-al-ali", "Tla Al-Ali", "تلاع العلي", 32.001, 35.864),
    area("dabouq", "Dabouq", "دابوق", 31.993, 35.816),
  ],
};

export const FALLBACK_CITIES: SearchCity[] = [FALLBACK_CITY];
