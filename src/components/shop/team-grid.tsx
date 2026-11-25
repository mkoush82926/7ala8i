"use client";

import React from "react";
import Link from "next/link";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { PhotoFrame, placeholderFill, placeholderInitials } from "@/components/ui/photo-frame";
import { RatingStars } from "@/components/ui/rating-stars";
import { buttonClasses, cardClasses } from "@/components/ui/recipes";
import { barberPath } from "./lib/slug";
import { barberBookingHref } from "./lib/booking";
import { localizedText } from "./lib/media";
import type { BarberData } from "./lib/types";
import { ShopImage } from "./shop-image";

/**
 * Round barber avatar (§4: 1:1, rounded-full). Without a photo it shows the
 * branded placeholder (same fill for the same barber everywhere) with the
 * barber's initials — never a grey circle.
 */
export function BarberAvatar({
  barber,
  size = 64,
  priority,
  className,
}: {
  barber: Pick<BarberData, "full_name" | "avatar_url"> & { id?: string };
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  const fill = placeholderFill(barber.id ?? barber.full_name);
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden rounded-full bg-sunken", className)}
      style={{ width: size, height: size }}
    >
      {barber.avatar_url ? (
        <ShopImage src={barber.avatar_url} alt="" fill sizes={`${size}px`} className="object-cover" priority={priority} />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center font-extrabold select-none"
          style={{
            backgroundImage: `repeating-linear-gradient(135deg, ${fill.hatch} 0 2px, transparent 2px 12px), ${fill.bg}`,
            color: fill.fg,
            fontSize: Math.round(size * 0.36),
          }}
        >
          {placeholderInitials(barber.full_name)}
        </span>
      )}
    </span>
  );
}

/**
 * Team (§5.4 barber card): 4:5 portrait, name, role and rating; the card
 * links to the barber page and carries its own Book action. A swipe rail on
 * phones, a 4-up grid from lg.
 */
export function TeamGrid({ barbers, shopId, src }: { barbers: readonly BarberData[]; shopId: string; src?: string | null }) {
  const { t, locale, formatLocalNumber: formatNumber } = useTranslation();
  return (
    <ul
      className={cn(
        "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0",
        // Small teams fill the row instead of leaving empty columns.
        barbers.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      {barbers.map((barber) => {
        const title = localizedText(locale, barber.title_en, barber.title_ar, "") || t.topbar.roleBarber;
        const rated = barber.rating_count > 0 && barber.rating_avg != null;
        const ratingValue = rated ? formatNumber(barber.rating_avg!, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;
        const profileHref = barber.handle ? barberPath(barber.handle, locale) : null;
        const bookHref = barberBookingHref({ locale, shopId, barberId: barber.id, entry: "profile_card", src });
        return (
          <li
            key={barber.id}
            className={cardClasses({
              elevation: "card",
              interactive: !!profileHref,
              className: "group relative flex w-[44%] shrink-0 snap-start flex-col overflow-hidden sm:w-[30%] lg:w-auto",
            })}
          >
            <PhotoFrame
              src={barber.avatar_url}
              alt=""
              ratio="4/5"
              fallbackName={barber.full_name}
              seed={barber.id}
              sizes="(min-width: 1024px) 220px, 44vw"
              hoverZoom={!!profileHref}
            >
              {rated && (
                <span className="absolute bottom-2 start-2 inline-flex h-7 items-center rounded-full bg-white/92 px-2.5 text-xs font-semibold text-[#0F172A] shadow-xs backdrop-blur-sm">
                  <RatingStars
                    rating={barber.rating_avg!}
                    compact
                    size="xs"
                    value={ratingValue}
                    count={`(${formatNumber(barber.rating_count)})`}
                    label={interpolate(t.shopPage.ratingLabel, { rating: ratingValue ?? "" })}
                    className="text-xs [&_.text-ink]:text-[#0F172A] [&_.text-ink-muted]:text-[#334155]"
                  />
                </span>
              )}
            </PhotoFrame>
            <div className="flex flex-1 flex-col gap-0.5 p-3 sm:p-4">
              {profileHref ? (
                <Link
                  href={profileHref}
                  className="focus-ring text-title line-clamp-2 rounded-sm text-ink after:absolute after:inset-0 after:content-['']"
                >
                  <bdi>{barber.full_name}</bdi>
                </Link>
              ) : (
                <p className="text-title line-clamp-2 text-ink">
                  <bdi>{barber.full_name}</bdi>
                </p>
              )}
              <p className="text-meta line-clamp-1 text-ink-muted">{title}</p>
              <div className="mt-auto pt-3">
                <Link
                  href={bookHref}
                  prefetch={false}
                  aria-label={interpolate(t.barberPage.bookWith, { name: barber.full_name })}
                  className={buttonClasses({ variant: "soft", size: "sm", fullWidth: true, className: "relative z-10" })}
                >
                  {t.primitives.book}
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default TeamGrid;
