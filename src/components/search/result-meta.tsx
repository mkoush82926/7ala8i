"use client";

// Small shared pieces of the search cards: rating, distance chip, next slot,
// badges and the matching-service rows.

import React from "react";
import { BadgeCheck, Clock, Home, Navigation, Sparkles, Star, Trophy, Baby } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { Pill } from "@/components/ui/pill";
import { Price } from "@/components/ui/price";
import { BookingCta } from "@/components/ui/booking-cta";
import { formatLocalizedNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { distanceParts, roundRating, serviceName, slotDay, weekdayLabel, type MatchedService, type NextSlot } from "@/lib/search";

export function RatingText({ rating }: { rating: { avg: number; count: number } | null }) {
  const { t, locale } = useTranslation();
  if (!rating) return null;
  const avg = formatLocalizedNumber(roundRating(rating.avg), locale, "auto", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const count = formatLocalizedNumber(rating.count, locale);
  return (
    <span className="inline-flex items-center gap-1">
      <Star size={13} aria-hidden="true" className="fill-[var(--accent-brass)] text-[var(--accent-brass)]" />
      <span aria-hidden="true">
        <span className="font-semibold text-[var(--text-primary)]">{avg}</span> ({count})
      </span>
      <span className="sr-only">{interpolate(t.explore.ratingCount, { rating: avg, count })}</span>
    </span>
  );
}

export function DistanceChip({ km }: { km: number | null }) {
  const { t, locale } = useTranslation();
  const parts = distanceParts(km);
  if (!parts) return null;
  const value = formatLocalizedNumber(parts.value, locale, "auto", { maximumFractionDigits: 1 });
  return (
    <Pill size="sm" tone="neutral" icon={<Navigation />}>
      {interpolate(parts.unit === "m" ? t.search.distanceM : t.search.distanceKm, { value })}
    </Pill>
  );
}

/** "Next: today 6:30 pm" with a clock icon; muted copy when nothing is free soon. */
export function NextSlotText({ slot, className }: { slot: NextSlot | null; className?: string }) {
  const { t, locale, formatTime } = useTranslation();
  if (!slot) {
    return (
      <span data-dynamic className={cn("text-[13px] text-[var(--text-muted)]", className)}>
        {t.search.noSlotSoon}
      </span>
    );
  }
  const day = slotDay(slot);
  const time = formatTime(slot.localTime);
  const text =
    day === "today"
      ? interpolate(t.search.nextSlotToday, { time })
      : day === "tomorrow"
        ? interpolate(t.search.nextSlotTomorrow, { time })
        : interpolate(t.search.nextSlotLater, { day: weekdayLabel(slot.localDate, locale), time });
  return (
    // data-dynamic: live availability, masked in visual snapshots.
    <span data-dynamic className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent-text)]", className)}>
      <Clock size={14} aria-hidden="true" />
      <bdi>{text}</bdi>
    </span>
  );
}

const BADGE_ICON: Record<string, React.ReactNode> = {
  verified: <BadgeCheck />,
  top_rated: <Trophy />,
  new: <Sparkles />,
  home_service: <Home />,
  kids: <Baby />,
};

export function Badges({ badges, max = 3 }: { badges: string[]; max?: number }) {
  const { t } = useTranslation();
  const label: Record<string, string> = {
    verified: t.search.badgeVerified,
    top_rated: t.search.badgeTopRated,
    new: t.search.badgeNew,
    home_service: t.search.badgeHomeService,
    kids: t.search.badgeKids,
  };
  const shown = badges.filter((b) => label[b]).slice(0, max);
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t.search.badgesLabel}>
      {shown.map((b) => (
        <li key={b}>
          <Pill size="sm" tone={b === "verified" || b === "top_rated" ? "brass" : "neutral"} icon={BADGE_ICON[b]}>
            {label[b]}
          </Pill>
        </li>
      ))}
    </ul>
  );
}

/** Up to three services that match the query, each with an inline Book. */
export function ServiceRows({
  services,
  shopKey,
  staff,
  src,
}: {
  services: MatchedService[];
  shopKey: string;
  staff?: string | null;
  src?: string | null;
}) {
  const { t, locale, formatDuration } = useTranslation();
  if (services.length === 0) return null;
  return (
    <ul className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
      {services.map((s) => {
        const name = serviceName(s, locale);
        return (
          <li key={s.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--text-primary)]">{name}</p>
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] text-[var(--text-secondary)]">
                {s.duration > 0 && <span>{formatDuration(s.duration)}</span>}
                {s.duration > 0 && (
                  <span aria-hidden="true" className="text-[var(--text-muted)]">
                    ·
                  </span>
                )}
                <Price amount={s.price} from={s.priceType === "from"} className="text-[12.5px]" />
              </p>
            </div>
            <BookingCta
              variant="inline"
              shop={shopKey}
              entry="search_card"
              services={[s.id]}
              staff={staff ?? undefined}
              src={src ?? undefined}
              ariaLabel={interpolate(t.search.bookService, { service: name })}
            />
          </li>
        );
      })}
    </ul>
  );
}
