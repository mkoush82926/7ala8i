"use client";

// Search result card for a shop: 16:9 cover, name, meta line (rating · place
// · open until), distance chip, badges, up to three matching services with
// an inline Book, "See all N" into booking, and the next free slot.

import React from "react";
import Link from "next/link";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { MetaLine } from "@/components/ui/meta-line";
import { Price } from "@/components/ui/price";
import { BookingCta, servicesCountLabel } from "@/components/ui/booking-cta";
import { ShopImage } from "@/components/shop/shop-image";
import { shopPath } from "@/components/shop/lib/slug";
import { formatLocalizedNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { coverForShop, shopInitials } from "@/app/[locale]/shop/shop-utils";
import { localName, placeLabel, priceSummary, type ShopResult } from "@/lib/search";
import { Badges, DistanceChip, NextSlotText, RatingText, ServiceRows } from "./result-meta";

export interface ShopCardProps {
  shop: ShopResult;
  /** Show the distance chip (only when measured from a real place). */
  showDistance?: boolean;
  /** Highlighted from the map (hover/focus on a pin). */
  active?: boolean;
  /** Traffic source carried into booking links. */
  src?: string | null;
  priority?: boolean;
  onHover?: (id: string | null) => void;
}

export function ShopCard({ shop, showDistance = false, active = false, src, priority = false, onHover }: ShopCardProps) {
  const { t, locale, formatTime } = useTranslation();
  const name = localName({ en: shop.name, ar: shop.nameAr }, locale) || shop.name;
  const href = shopPath(shop, locale);
  const bookKey = shop.slug || shop.id;
  const place = placeLabel(shop.area, shop.city, locale);
  const cover = coverForShop(shop.id);
  const price = priceSummary(shop.matchedServices, shop.minPrice);
  const headingId = `shop-${shop.id}-name`;
  const moreCount = shop.servicesCount;

  return (
    <article
      aria-labelledby={headingId}
      data-shop-id={shop.id}
      onMouseEnter={onHover ? () => onHover(shop.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(shop.id) : undefined}
      className={cn(
        "flex flex-col overflow-hidden rounded-[16px] border bg-[var(--bg-primary)] transition-shadow",
        active ? "border-[var(--accent-brass)] shadow-[0_12px_32px_-16px_rgba(124,90,38,0.45)]" : "border-[var(--border-subtle)] hover:shadow-[0_12px_32px_-18px_rgba(28,22,17,0.3)]",
      )}
    >
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[16/9] w-full overflow-hidden bg-[var(--bg-secondary)]">
        {shop.coverUrl ? (
          <ShopImage
            src={shop.coverUrl}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-[34px] font-extrabold"
            style={{ background: cover.bg, color: cover.fg }}
          >
            {shopInitials(name)}
          </span>
        )}
        {showDistance && shop.distanceKm !== null && (
          <span className="absolute top-2 end-2">
            <DistanceChip km={shop.distanceKm} />
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 id={headingId} className="min-w-0 text-[17px] font-bold leading-snug text-[var(--text-primary)]">
              <Link href={href} className="focus-ring rounded-sm hover:underline underline-offset-4">
                {name}
              </Link>
            </h3>
            {price && (
              <Price amount={price.amount} from={moreCount > 1 || price.from} className="shrink-0 pt-0.5 text-[14px]" />
            )}
          </div>
          <MetaLine
            locale={locale}
            className="text-[13px]"
            items={[
              shop.rating ? { key: "rating", label: <RatingText rating={shop.rating} /> } : t.search.newShop,
              place,
              shop.openNow && shop.openUntil
                ? {
                    key: "open",
                    label: <span data-dynamic>{interpolate(t.search.openUntil, { time: formatTime(shop.openUntil) })}</span>,
                    className: "text-[var(--accent-mint,inherit)]",
                  }
                : null,
            ]}
          />
        </div>

        <Badges badges={shop.badges} />

        <ServiceRows services={shop.matchedServices} shopKey={bookKey} src={src} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <NextSlotText slot={shop.nextSlot} />
          {moreCount > shop.matchedServices.length && (
            <BookingCta
              variant="inline"
              shop={bookKey}
              entry="see_all"
              src={src ?? undefined}
              label={interpolate(t.search.seeAll, {
                count: servicesCountLabel(t.primitives.servicesCount, moreCount, locale, formatLocalizedNumber(moreCount, locale)),
              })}
              className="!border-transparent !px-2 !text-[var(--accent-text)] underline-offset-4 hover:underline"
            />
          )}
        </div>
      </div>
    </article>
  );
}

export default ShopCard;
