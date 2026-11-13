export interface ExploreShop {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  rating: { avg: number; count: number } | null;
  cheapest: { price: number; duration: number } | null;
  /** Active service names (English + Arabic) for search. */
  serviceNames: string[];
}

/** Lower-cases, strips Arabic diacritics/tatweel and unifies alef/ya/ta-marbuta forms. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every whitespace-separated term must match the name, address or a service. */
export function filterShops<T extends Pick<ExploreShop, "name" | "address" | "serviceNames">>(shops: readonly T[], query: string): T[] {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [...shops];
  return shops.filter((shop) => {
    const haystack = normalizeSearch([shop.name, shop.address ?? "", ...shop.serviceNames].join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}
