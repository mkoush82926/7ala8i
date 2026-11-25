"use client";

// Recent 4–5★ reviews from searchable shops, as a scroll-snap row with
// previous/next buttons (mirrored in RTL). Works by touch, trackpad and
// keyboard (the row is focusable and scrolls with arrow keys). Reviewer
// names arrive already reduced to "First L." by the RPC.

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { shopPath } from "@/components/shop/lib/slug";
import { formatLocalizedNumber } from "@/lib/format";
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
    const delta = el.clientWidth * 0.85 * dir * (isRTL ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };
  const Prev = isRTL ? ChevronRight : ChevronLeft;
  const Next = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="relative">
      <div className="mb-3 hidden justify-end gap-2 md:flex">
        <button
          type="button"
          onClick={() => scroll(-1)}
          disabled={edges.start}
          aria-label={S.reviewsPrev}
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] disabled:opacity-40"
        >
          <Prev size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          disabled={edges.end}
          aria-label={S.reviewsNext}
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] disabled:opacity-40"
        >
          <Next size={18} aria-hidden="true" />
        </button>
      </div>
      <ul
        ref={row}
        tabIndex={0}
        aria-labelledby={headingId}
        className="focus-ring -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0"
      >
        {reviews.map((r) => {
          const shopName = localName({ en: r.shop.name, ar: r.shop.nameAr }, locale) || r.shop.name;
          const area = localName(r.area, locale);
          const stars = formatLocalizedNumber(r.rating, locale);
          return (
            <li key={r.id} className="w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]">
              <figure className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
                <div className="flex items-center gap-0.5" role="img" aria-label={interpolate(S.starsLabel, { rating: stars })}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      aria-hidden="true"
                      className={i < r.rating ? "fill-[var(--accent-brass)] text-[var(--accent-brass)]" : "text-[var(--border-primary)]"}
                    />
                  ))}
                </div>
                <blockquote className="flex-1 text-[15px] leading-relaxed text-[var(--text-primary)]">
                  <p>
                    <bdi>{r.comment}</bdi>
                  </p>
                </blockquote>
                <figcaption className="text-[13px] text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    <bdi>{r.reviewer ?? S.anonymousReviewer}</bdi>
                  </span>
                  {" · "}
                  <Link href={shopPath(r.shop, locale)} className="focus-ring rounded-sm underline-offset-4 hover:underline">
                    <bdi>{shopName}</bdi>
                  </Link>
                  {area ? (
                    <>
                      {" · "}
                      <bdi>{area}</bdi>
                    </>
                  ) : null}
                  {/* Relative to "now", so server and browser can differ by a minute. */}
                  {r.createdAt ? (
                    <time dateTime={r.createdAt} suppressHydrationWarning className="block text-[12px] text-[var(--text-muted)]">
                      {formatRelative(r.createdAt)}
                    </time>
                  ) : null}
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
