import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shop card shell (§5.4) — presentation only; the search / home owners pass
 * the data-driven pieces. The whole card is clickable through a stretched
 * link on the name; anything interactive inside (Book buttons, save heart)
 * must sit above it with `relative z-10` (BookingCta inline already does).
 *
 *   <ShopCardShell
 *     href={href(`/shop/${shop.slug}`)}
 *     name={shop.name}
 *     media={<PhotoFrame src={cover} alt={shop.name} fallbackName={shop.name} seed={shop.id} hoverZoom sizes={SHOP_CARD_SIZES} />}
 *     badges={<Pill tone="on-photo" icon={<Star />}>Top rated</Pill>}
 *     topEnd={<Pill tone="on-photo">1.2 km</Pill>}
 *     meta={<MetaLine locale={locale} items={[<RatingStars compact … />, area, openUntil]} />}
 *     footer={<><span className="text-sm font-medium text-success-text">Next: Today 5:30 pm</span><a …>See all 12</a></>}
 *     active={hoveredFromMap}
 *   >
 *     {services.slice(0, 3).map(…)}         // compact service rows (search only)
 *   </ShopCardShell>
 */
export interface ShopCardShellProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Destination of the stretched link (shop page). */
  href: string;
  /** Shop name — the link text. */
  name: React.ReactNode;
  /** Media slot: usually a <PhotoFrame ratio="4/3" hoverZoom />. */
  media?: React.ReactNode;
  /** Top-start overlay on the media (on-photo pills). */
  badges?: React.ReactNode;
  /** Top-end overlay on the media (distance chip / save button). */
  topEnd?: React.ReactNode;
  /** Meta row under the name (MetaLine / RatingStars compact). */
  meta?: React.ReactNode;
  /** Footer row, separated by a hairline (next availability + "See all"). */
  footer?: React.ReactNode;
  /** Highlight synced with the active map pin. */
  active?: boolean;
  /** Heading level for the name (default 3). */
  headingLevel?: 2 | 3 | 4;
  /** Accessible name override for the stretched link. */
  linkLabel?: string;
  prefetch?: boolean;
  onLinkClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  bodyClassName?: string;
  /** Middle content (compact service rows). */
  children?: React.ReactNode;
}

export function ShopCardShell({
  href,
  name,
  media,
  badges,
  topEnd,
  meta,
  footer,
  active = false,
  headingLevel = 3,
  linkLabel,
  prefetch,
  onLinkClick,
  className,
  bodyClassName,
  children,
  ...rest
}: ShopCardShellProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <article
      data-active={active || undefined}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-card",
        "transition-shadow duration-200 ease-standard hover:shadow-raised focus-within:shadow-raised motion-reduce:transition-none",
        "data-[active=true]:ring-2 data-[active=true]:ring-brand",
        className,
      )}
      {...rest}
    >
      {(media || badges || topEnd) && (
        <div className="relative">
          {media}
          {badges && <div className="absolute start-3 top-3 z-10 flex max-w-[70%] flex-wrap gap-1.5">{badges}</div>}
          {topEnd && <div className="absolute end-3 top-3 z-10 flex gap-1.5">{topEnd}</div>}
        </div>
      )}
      <div className={cn("flex flex-1 flex-col gap-1.5 p-4", bodyClassName)}>
        <Heading className="text-title line-clamp-1 text-ink">
          <Link
            href={href}
            prefetch={prefetch}
            onClick={onLinkClick}
            aria-label={linkLabel}
            className="rounded-sm outline-none after:absolute after:inset-0 after:z-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {name}
          </Link>
        </Heading>
        {meta}
        {children && <div className="relative z-10 mt-1">{children}</div>}
        {footer && (
          <div className="relative z-10 mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
            {footer}
          </div>
        )}
      </div>
    </article>
  );
}

export default ShopCardShell;
