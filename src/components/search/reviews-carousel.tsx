"use client";

// Recent 4–5★ reviews from searchable shops (§5.4 review card), as a
// scroll-snap row with previous/next buttons (mirrored in RTL). Works by
// touch, trackpad and keyboard (the row is focusable and scrolls with arrow
// keys). Reviewer names arrive already reduced to "First L." by the RPC.
//
// On md+ the prev/next buttons sit at the end of the section heading row
// (absolutely placed above the row), so the heading owner leaves room.

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { BrandedPlaceholder } from "@/components/ui/photo-frame";
import { RatingStars } from "@/components/ui/rating-stars";
import { buttonClasses, focusRing } from "@/components/ui/recipes";
import { shopPath } from "@/components/shop/lib/slug";
import { formatLocalizedNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { localName, type RecentReview } from "@/lib/search";

export function ReviewsCarousel({ reviews, headingId }: { reviews: RecentReview[]; headingId: string }) {
  const { t, locale, isRTL, formatRelative } = useTranslation();
  const S = t.search;
  const row = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => {
      // scrollLeft is negative in RTL in modern browsers.
      const x = Math.abs(el.scrollLeft);
      setEdges({ start: x < 8, end: x + el.clientWidth >= el.scrollWidth - 8 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [reviews.length]);

  if (reviews.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delta = el.clientWidth * 0.85 * dir * (isRTL ? -1 : 1);
    el.scrollBy({ left: delta, behavior: reduce ? "auto" : "smooth" });
  };
  const Prev = isRTL ? ChevronRight : ChevronLeft;
  const Next = isRTL ? ChevronLeft : ChevronRight;
  const navBtn = buttonClasses({ variant: "secondary", size: "icon-sm", className: "size-10 shadow-xs" });

  return (
    <div className="relative">
      <div className="mb-4 hidden justify-end gap-2 md:absolute md:bottom-full md:end-0 md:mb-6 md:flex">
        <button type="button" onClick={() => scroll(-1)} disabled={edges.start} aria-label={S.reviewsPrev} className={navBtn}>
          <Prev aria-hidden="true" />
        </button>
        <button type="button" onClick={() => scroll(1)} disabled={edges.end} aria-label={S.reviewsNext} className={navBtn}>
          <Next aria-hidden="true" />
        </button>
      </div>
      <ul
        ref={row}
        tabIndex={0}
        aria-labelledby={headingId}
        className={cn(
          "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 pt-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0",
          "rounded-xl",
          focusRing,
        )}
      >
        {reviews.map((r) => {
          const shopName = localName({ en: r.shop.name, ar: r.shop.nameAr }, locale) || r.shop.name;
          const area = localName(r.area, locale);
          const stars = formatLocalizedNumber(r.rating, locale);
          const reviewer = r.reviewer ?? S.anonymousReviewer;
          return (
            <li key={r.id} className="w-[86%] shrink-0 snap-start sm:w-[46%] lg:w-[calc((100%-32px)/3)]">
              <figure className="flex h-full flex-col gap-3 rounded-xl border border-line bg-card p-5 shadow-card">
                <RatingStars rating={r.rating} size="sm" label={interpolate(S.starsLabel, { rating: stars })} />
                <blockquote className="text-body line-clamp-4 flex-1 text-ink-soft">
                  <p>
                    <bdi>{r.comment}</bdi>
                  </p>
                </blockquote>
                <figcaption className="flex items-center gap-3 border-t border-line pt-3">
                  <span aria-hidden="true" className="relative size-10 shrink-0 overflow-hidden rounded-full">
                    <BrandedPlaceholder name={reviewer} seed={r.id} initialsClassName="text-sm md:text-sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      <bdi>{reviewer}</bdi>
                    </span>
                    <span className="block truncate text-meta text-ink-muted">
                      <Link
                        href={shopPath(r.shop, locale)}
                        className={cn("rounded-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline", focusRing)}
                      >
                        <bdi>{shopName}</bdi>
                      </Link>
                      {area ? (
                        <>
                          <span aria-hidden="true" className="mx-1.5 text-ink-disabled">
                            ·
                          </span>
                          <bdi>{area}</bdi>
                        </>
                      ) : null}
                      {/* Relative to "now", so server and browser can differ by a minute. */}
                      {r.createdAt ? (
                        <>
                          <span aria-hidden="true" className="mx-1.5 text-ink-disabled">
                            ·
                          </span>
                          <time dateTime={r.createdAt} suppressHydrationWarning>
                            {formatRelative(r.createdAt)}
                          </time>
                        </>
                      ) : null}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ReviewsCarousel;
