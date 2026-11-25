"use client";

// Search result card for a shop (§5.4): 4:3 cover (branded placeholder when
// there is no photo) with highlight and distance chips, name as a stretched
// link over the whole card, meta line (rating · place · open until) with the
// "from" price, up to three matching services with an inline Book, and a
// footer with the next free slot and "See all N" into booking.

import React from "react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { MetaLine } from "@/components/ui/meta-line";
import { Price } from "@/components/ui/price";
import { BookingCta, servicesCountLabel } from "@/components/ui/booking-cta";
import { PhotoFrame, SHOP_CARD_SIZES } from "@/components/ui/photo-frame";
import { ShopCardShell } from "@/components/ui/shop-card-shell";
import { shopPath } from "@/components/shop/lib/slug";
import { formatLocalizedNumber } from "@/lib/format";
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
  const price = priceSummary(shop.matchedServices, shop.minPrice);
  const moreCount = shop.servicesCount;
  const hasDistance = showDistance && shop.distanceKm !== null;

  return (
    <ShopCardShell
      href={href}
      name={name}
      active={active}
      data-shop-id={shop.id}
      onMouseEnter={onHover ? () => onHover(shop.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(shop.id) : undefined}
      className="h-full"
      media={
        <PhotoFrame
          src={shop.coverUrl}
          alt=""
          ratio="4/3"
          fallbackName={name}
          seed={shop.id}
          sizes={SHOP_CARD_SIZES}
          priority={priority}
          hoverZoom
        />
      }
      badges={shop.badges.length > 0 ? <Badges badges={shop.badges} max={2} onPhoto /> : undefined}
      topEnd={hasDistance ? <DistanceChip km={shop.distanceKm} onPhoto /> : undefined}
      meta={
        <div className="flex items-start justify-between gap-3">
          <MetaLine
            locale={locale}
            className="min-w-0 text-meta"
            items={[
              shop.rating ? { key: "rating", label: <RatingText rating={shop.rating} /> } : t.search.newShop,
              place,
              shop.openNow && shop.openUntil
                ? {
                    key: "open",
                    label: <span data-dynamic>{interpolate(t.search.openUntil, { time: formatTime(shop.openUntil) })}</span>,
                    className: "text-success-text",
                  }
                : null,
            ]}
          />
          {price && <Price amount={price.amount} from={moreCount > 1 || price.from} className="shrink-0 text-sm" />}
        </div>
      }
      footer={
        <>
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
              className="h-9 min-w-0 shrink-0 bg-transparent px-2 text-brand-text hover:bg-brand-soft"
            />
          )}
        </>
      }
    >
      {shop.matchedServices.length > 0 ? <ServiceRows services={shop.matchedServices} shopKey={bookKey} src={src} /> : null}
    </ShopCardShell>
  );
}

export default ShopCard;
