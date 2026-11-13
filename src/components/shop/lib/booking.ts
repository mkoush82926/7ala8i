import { buildBookingHref, type BookingEntry } from "@/components/ui/booking-cta";

/**
 * Booking link with a preselected barber. buildBookingHref writes `staff=`;
 * the roadmap's booking flow (WS-1D) reads `barber=`, so both are sent until
 * the two converge.
 */
export function barberBookingHref({
  locale,
  shopId,
  barberId,
  entry,
  src,
  services,
}: {
  locale: string;
  shopId: string;
  barberId: string;
  entry: BookingEntry;
  src?: string | null;
  services?: ReadonlyArray<string>;
}): string {
  const href = buildBookingHref({ locale, shop: shopId, entry, src, services, staff: barberId });
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(barberId)) return href;
  return `${href}&barber=${encodeURIComponent(barberId)}`;
}

/** Reads a safe `src` attribution token from page search params. */
export function readSrc(search: Record<string, string | string[] | undefined> | URLSearchParams | null | undefined): string | null {
  if (!search) return null;
  const raw = search instanceof URLSearchParams ? search.get("src") : search.src;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(value) ? value : null;
}
