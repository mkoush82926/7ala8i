"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { formatJOD, formatLocalizedNumber, META_SEPARATOR, type DigitPreference } from "@/lib/format";
import { buttonClasses } from "./recipes";
import { StickyBar } from "./sticky-bar";

/**
 * The one booking entry point (§2.2). Every "Book" on the marketplace goes
 * through this component so attribution (?entry= / ?src=) is always written
 * and the teal primary action looks the same everywhere.
 *
 *   <BookingCta shop={shop.slug ?? shop.id} entry="service_row" services={[s.id]} variant="inline" />
 *   <BookingCta shop={shop.id} entry="profile_card" />                      // desktop sticky card
 *   <BookingCta shop={shop.id} entry="profile_sticky" variant="bar"
 *               summary={{ count: services.length, fromPrice: minPrice }} /> // mobile bottom bar
 */
export const BOOKING_ENTRIES = [
  "profile_card",
  "profile_sticky",
  "service_row",
  "see_all",
  "search_card",
  "map",
  "landing",
  "deal",
  "rebook",
  "share",
  "other",
] as const;
export type BookingEntry = (typeof BOOKING_ENTRIES)[number];

export interface BookingHrefInput {
  locale: string;
  /** Shop id or slug (the booking route accepts the id today). */
  shop: string;
  entry: BookingEntry;
  /** Traffic source carried from the landing URL (instagram, google, qr, …). */
  src?: string | null;
  /** Preselected service ids. One id is sent as ?service= (read by BookingEngine). */
  services?: ReadonlyArray<string>;
  /** Preselected barber (profile id). */
  staff?: string | null;
}

const SAFE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Builds `/{locale}/book/{shop}?entry=…&src=…&service(s)=…&staff=…`. */
export function buildBookingHref({ locale, shop, entry, src, services, staff }: BookingHrefInput): string {
  const params = new URLSearchParams();
  const ids = (services ?? []).filter((id) => SAFE_TOKEN.test(id));
  if (ids.length === 1) params.set("service", ids[0]);
  else if (ids.length > 1) params.set("services", ids.join(","));
  if (staff && SAFE_TOKEN.test(staff)) params.set("staff", staff);
  params.set("entry", entry);
  if (src && SAFE_TOKEN.test(src)) params.set("src", src);
  const loc = locale === "ar" ? "ar" : "en";
  return `/${loc}/book/${encodeURIComponent(shop)}?${params.toString()}`;
}

export type PluralForms = Record<"zero" | "one" | "two" | "few" | "many" | "other", string>;

/**
 * CLDR plural label: Arabic needs zero/one/two/few/many forms, English
 * one/other. `countText` is the already-localised number (digit preference).
 */
export function pluralLabel(forms: PluralForms, count: number, locale: string, countText: string): string {
  const rule = new Intl.PluralRules(locale === "ar" ? "ar" : "en").select(count) as keyof PluralForms;
  return (forms[rule] ?? forms.other).replace("{count}", countText);
}

/** Arabic needs dual/few/many forms; English one/other. */
export function servicesCountLabel(forms: PluralForms, count: number, locale: string, countText: string): string {
  return pluralLabel(forms, count, locale, countText);
}

export type BookingCtaVariant = "button" | "inline" | "bar";

export interface BookingCtaProps extends Omit<BookingHrefInput, "locale"> {
  variant?: BookingCtaVariant;
  /** Overrides the default label ("Book now" / "Book"). */
  label?: string;
  /** Bar only: "N services · from X JD". */
  summary?: { count: number; fromPrice?: number | null };
  digits?: DigitPreference;
  /** Stretch to the container width (button variant). */
  fullWidth?: boolean;
  /** Accessible name when the visible label is ambiguous (e.g. "Book Skin fade"). */
  ariaLabel?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

// Teal primary (v2 §5.1): white on #0F766E (5.47:1) in light; #042F2E on
// #2DD4BF (7.77:1) in dark. The inline "Book" is the soft variant.
const PRIMARY = buttonClasses({ variant: "primary", size: "lg" });
const BAR_PRIMARY = buttonClasses({ variant: "primary", size: "xl", className: "flex-1 max-w-[220px]" });
const INLINE = buttonClasses({ variant: "soft", size: "sm", className: "min-w-[4.5rem] px-4" });

export function BookingCta({
  variant = "button",
  label,
  summary,
  digits = "auto",
  fullWidth = false,
  ariaLabel,
  onClick,
  className,
  ...hrefInput
}: BookingCtaProps) {
  const { t, locale } = useTranslation();
  const href = buildBookingHref({ ...hrefInput, locale });

  if (variant === "inline") {
    return (
      <Link
        href={href}
        prefetch={false}
        onClick={onClick}
        aria-label={ariaLabel}
        data-entry={hrefInput.entry}
        className={cn(INLINE, "relative z-10", className)}
      >
        {label ?? t.primitives.book}
      </Link>
    );
  }

  const button = (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      aria-label={ariaLabel}
      data-entry={hrefInput.entry}
      className={cn(
        variant === "bar" ? BAR_PRIMARY : PRIMARY,
        fullWidth && "w-full max-w-none",
        variant === "button" && className,
      )}
    >
      {label ?? t.primitives.bookNow}
    </Link>
  );

  if (variant === "button") return button;

  // Sticky mobile bar (hidden ≥ lg, where the sticky side card takes over).
  const count = summary?.count ?? 0;
  const countText = formatLocalizedNumber(count, locale, digits);
  const parts: string[] = [];
  if (count > 0) parts.push(servicesCountLabel(t.primitives.servicesCount, count, locale, countText));
  if (summary?.fromPrice != null && summary.fromPrice > 0) {
    parts.push(
      t.primitives.fromPrice.replace("{price}", formatJOD(summary.fromPrice, { locale, digits, trimZeros: true })),
    );
  }

  return (
    <StickyBar
      label={t.primitives.bookingSummaryLabel}
      className={className}
      action={button}
      title={
        parts.length > 0 ? (
          <>
            {parts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span aria-hidden="true" className="mx-1.5 text-ink-disabled">
                    {META_SEPARATOR}
                  </span>
                )}
                <bdi>{part}</bdi>
              </React.Fragment>
            ))}
          </>
        ) : undefined
      }
    />
  );
}

export default BookingCta;
