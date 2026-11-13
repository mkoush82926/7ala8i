// Formatting helpers shared by the booking steps (pure).
import { formatJOD, joinMeta, formatMinutesRange } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { PriceType, ServiceRow } from "./booking-state";

/** Money in the shop's currency; JOD uses the house formatter ("5 JD" / "5 د.أ"). */
export function money(amount: number, currency: string | null | undefined, locale: string): string {
  const cur = (currency || "JOD").toUpperCase();
  if (cur === "JOD") return formatJOD(amount, { locale, trimZeros: true });
  return formatCurrency(amount, locale, cur, { trimZeros: true });
}

export interface PriceLabels {
  free: string;
  /** "from {price}" */
  fromPrice: string;
}

/** "Free" / "from 5 JD" / "5 JD" / "5–7 JD" (variants). */
export function servicePriceLabel(
  service: Pick<ServiceRow, "price" | "price_type" | "variants">,
  currency: string | null | undefined,
  locale: string,
  labels: PriceLabels,
): string {
  if (service.price_type === "free") return labels.free;
  const prices = service.variants.length ? service.variants.map((v) => v.price) : [service.price];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const base = money(min, currency, locale);
  if (service.price_type === "from" || min !== max) return labels.fromPrice.replace("{price}", base);
  return base;
}

/** "30 min" or "30–45 min" when variants differ. */
export function serviceDurationLabel(service: Pick<ServiceRow, "duration" | "variants">, locale: string): string {
  const ds = service.variants.length ? service.variants.map((v) => v.duration) : [service.duration];
  return formatMinutesRange(Math.min(...ds), Math.max(...ds), locale);
}

export function priceTypeOf(value: unknown): PriceType {
  return value === "from" || value === "free" ? value : "fixed";
}

/** Signed surcharge: "+2 JD" / "−1 JD"; null for zero. */
export function surchargeLabel(delta: number, currency: string | null | undefined, locale: string): string | null {
  if (!delta || Math.abs(delta) < 0.0005) return null;
  return `${delta > 0 ? "+" : "−"}${money(Math.abs(delta), currency, locale)}`;
}

/**
 * "Today 4:30 pm" / "Tomorrow 9:00 am" / "Thu 5:30 pm" for a next-slot hint.
 * `today` and `localDate` are shop-local "yyyy-MM-dd".
 */
export function nextSlotLabel(
  slot: { localDate: string; localTime: string },
  today: string,
  tomorrow: string,
  fmt: { weekday: (date: string) => string; time: (hhmm: string) => string },
  words: { today: string; tomorrow: string },
): string {
  const day = slot.localDate === today ? words.today : slot.localDate === tomorrow ? words.tomorrow : fmt.weekday(slot.localDate);
  return `${day} ${fmt.time(slot.localTime)}`;
}

export { joinMeta };
