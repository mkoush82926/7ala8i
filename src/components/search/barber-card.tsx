"use client";

// Search result card for a barber (§5.4): portrait avatar (branded initials
// when there is no photo), name, title and experience, rating + shop + place,
// matching services (book with this barber preselected) and the barber's
// next free slot.

import React from "react";
import Link from "next/link";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { MetaLine } from "@/components/ui/meta-line";
import { Price } from "@/components/ui/price";
import { BookingCta } from "@/components/ui/booking-cta";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { cardClasses, focusRing } from "@/components/ui/recipes";
import { barberPath, shopPath } from "@/components/shop/lib/slug";
import { formatLocalizedNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { localName, placeLabel, priceSummary, type BarberResult } from "@/lib/search";
import { Badges, DistanceChip, NextSlotText, RatingText, ServiceRows } from "./result-meta";

export interface BarberCardProps {
  barber: BarberResult;
  showDistance?: boolean;
  src?: string | null;
}

export function BarberCard({ barber, showDistance = false, src }: BarberCardProps) {
  const { t, locale } = useTranslation();
  const href = barber.handle ? barberPath(barber.handle, locale) : shopPath(barber.shop, locale);
  const shopName = localName({ en: barber.shop.name, ar: barber.shop.nameAr }, locale) || barber.shop.name;
  const title = localName(barber.title, locale);
  const place = placeLabel(barber.area, barber.city, locale);
  const bookKey = barber.shop.slug || barber.shop.id;
  const price = priceSummary(barber.matchedServices, barber.minPrice);
  const headingId = `barber-${barber.id}-name`;
  const hasDistance = showDistance && barber.distanceKm !== null;

  return (
    <article
      aria-labelledby={headingId}
      className={cardClasses({ elevation: "card", interactive: true, className: "flex h-full flex-col gap-4 p-4 lg:p-5" })}
    >
      <div className="flex items-start gap-4">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="group shrink-0">
          <PhotoFrame
            src={barber.avatarUrl}
            alt=""
            ratio="1/1"
            rounded="full"
            fallbackName={barber.fullName}
            seed={barber.id}
            sizes="72px"
            hoverZoom
            className="size-[72px] ring-1 ring-line"
            initialsClassName="text-[22px] md:text-[22px]"
          />
        </Link>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 id={headingId} className="text-title min-w-0 text-ink">
              <Link href={href} className={cn("rounded-sm underline-offset-4 hover:underline", focusRing)}>
                {barber.fullName}
              </Link>
            </h3>
            {price && <Price amount={price.amount} from className="shrink-0 text-sm" />}
          </div>
          <MetaLine
            locale={locale}
            className="text-meta"
            items={[
              title,
              barber.yearsExperience
                ? interpolate(t.search.yearsExp, { count: formatLocalizedNumber(barber.yearsExperience, locale) })
                : null,
            ]}
          />
          <MetaLine
            locale={locale}
            className="text-meta"
            items={[
              barber.rating ? { key: "rating", label: <RatingText rating={barber.rating} /> } : null,
              {
                key: "shop",
                label: (
                  <Link
                    href={shopPath(barber.shop, locale)}
                    className={cn("rounded-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline", focusRing)}
                  >
                    {interpolate(t.search.atShop, { shop: shopName })}
                  </Link>
                ),
              },
              place,
            ]}
          />
          {(hasDistance || barber.shop.isVerified) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {hasDistance && <DistanceChip km={barber.distanceKm} />}
              <Badges badges={barber.shop.isVerified ? ["verified"] : []} />
            </div>
          )}
        </div>
      </div>

      <ServiceRows services={barber.matchedServices} shopKey={bookKey} staff={barber.id} src={src} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <NextSlotText slot={barber.nextSlot} />
        <BookingCta
          variant="inline"
          shop={bookKey}
          entry="search_card"
          staff={barber.id}
          src={src ?? undefined}
          label={t.primitives.book}
          ariaLabel={interpolate(t.search.bookWith, { name: barber.fullName })}
        />
      </div>
    </article>
  );
}

export default BarberCard;
