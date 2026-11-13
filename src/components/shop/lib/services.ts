import type { ServiceCategory, ServiceData } from "./types";

export const OTHER_CATEGORY = "__other";
export const POPULAR_CATEGORY = "__all";

export interface ServiceGroup {
  /** Category id, or OTHER_CATEGORY for uncategorised services. */
  id: string;
  category: ServiceCategory | null;
  services: ServiceData[];
}

/**
 * Groups services by category in the platform's category order; services
 * without a (known) category go last under OTHER_CATEGORY. Empty groups are
 * dropped (progressive disclosure: no empty tabs).
 */
export function groupServicesByCategory(services: readonly ServiceData[], categories: readonly ServiceCategory[]): ServiceGroup[] {
  const known = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, ServiceData[]>();
  for (const s of services) {
    const id = s.category_id && known.has(s.category_id) ? s.category_id : OTHER_CATEGORY;
    buckets.set(id, [...(buckets.get(id) ?? []), s]);
  }
  const ordered = [...categories]
    .sort((a, b) => a.sort - b.sort)
    .filter((c) => buckets.has(c.id))
    .map((c): ServiceGroup => ({ id: c.id, category: c, services: buckets.get(c.id) ?? [] }));
  if (buckets.has(OTHER_CATEGORY)) ordered.push({ id: OTHER_CATEGORY, category: null, services: buckets.get(OTHER_CATEGORY) ?? [] });
  return ordered;
}

/** Lowest positive price, or null. */
export function minPrice(services: readonly Pick<ServiceData, "price">[]): number | null {
  const prices = services.map((s) => Number(s.price)).filter((p) => Number.isFinite(p) && p > 0);
  return prices.length ? Math.min(...prices) : null;
}
