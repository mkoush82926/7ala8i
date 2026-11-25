"use client";

// Search result card for a barber: avatar, name, title, shop + place,
// rating, matching services (book with this barber preselected) and the
// barber's next free slot.

import React from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { MetaLine } from "@/components/ui/meta-line";
import { Price } from "@/components/ui/price";
import { BookingCta } from "@/components/ui/booking-cta";
import { ShopImage } from "@/components/shop/shop-image";
import { barberPath, shopPath } from "@/components/shop/lib/slug";
import { formatLocalizedNumber } from "@/lib/format";
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

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-3 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
      <div className="flex items-start gap-3">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--bg-secondary)]"
        >
          {barber.avatarUrl ? (
            <ShopImage src={barber.avatarUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
              <UserRound size={28} />
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 id={headingId} className="min-w-0 text-[16px] font-bold leading-snug text-[var(--text-primary)]">
              <Link href={href} className="focus-ring rounded-sm hover:underline underline-offset-4">
                {barber.fullName}
              </Link>
            </h3>
            {price && <Price amount={price.amount} from className="shrink-0 text-[14px]" />}
          </div>
          <MetaLine
            locale={locale}
            className="text-[13px]"
            items={[
              title,
              barber.yearsExperience ? interpolate(t.search.yearsExp, { count: formatLocalizedNumber(barber.yearsExperience, locale) }) : null,
            ]}
          />
          <MetaLine
            locale={locale}
            className="text-[13px]"
            items={[
              barber.rating ? { key: "rating", label: <RatingText rating={barber.rating} /> } : null,
              {
                key: "shop",
                label: (
                  <Link href={shopPath(barber.shop, locale)} className="focus-ring rounded-sm underline-offset-4 hover:underline">
                    {interpolate(t.search.atShop, { shop: shopName })}
                  </Link>
                ),
              },
              place,
            ]}
          />
        </div>
      </div>

      {(showDistance && barber.distanceKm !== null) || barber.shop.isVerified ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {showDistance && <DistanceChip km={barber.distanceKm} />}
          <Badges badges={barber.shop.isVerified ? ["verified"] : []} />
        </div>
      ) : null}

      <ServiceRows services={barber.matchedServices} shopKey={bookKey} staff={barber.id} src={src} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
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
