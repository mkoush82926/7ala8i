"use client";

// Small shared pieces of the search cards: rating, distance chip, next slot,
// badges and the matching-service rows (§5.4 compact service row).

import React from "react";
import { BadgeCheck, Clock, Home, Navigation, Sparkles, Trophy, Baby } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Price } from "@/components/ui/price";
import { BookingCta } from "@/components/ui/booking-cta";
import { RatingStars } from "@/components/ui/rating-stars";
import { formatLocalizedNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { distanceParts, roundRating, serviceName, slotDay, weekdayLabel, type MatchedService, type NextSlot } from "@/lib/search";

/** Compact "★ 4.9 (312)" for meta lines, with one spoken label. */
export function RatingText({ rating }: { rating: { avg: number; count: number } | null }) {
  const { t, locale } = useTranslation();
  if (!rating) return null;
  const avg = formatLocalizedNumber(roundRating(rating.avg), locale, "auto", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const count = formatLocalizedNumber(rating.count, locale);
  return (
    <RatingStars
      compact
      size="xs"
      rating={rating.avg}
      value={avg}
      count={`(${count})`}
      label={interpolate(t.explore.ratingCount, { rating: avg, count })}
    />
  );
}

/** Distance pill; `onPhoto` for the card media, neutral elsewhere. */
export function DistanceChip({ km, onPhoto = false }: { km: number | null; onPhoto?: boolean }) {
  const { t, locale } = useTranslation();
  const parts = distanceParts(km);
  if (!parts) return null;
  const value = formatLocalizedNumber(parts.value, locale, "auto", { maximumFractionDigits: 1 });
  return (
    <Pill
      size={onPhoto ? "md" : "sm"}
      tone={onPhoto ? "on-photo" : "neutral"}
      icon={<Navigation />}
      className={onPhoto ? "h-7" : undefined}
    >
      {interpolate(parts.unit === "m" ? t.search.distanceM : t.search.distanceKm, { value })}
    </Pill>
  );
}

/** "Next: today 6:30 pm" with a clock icon; muted copy when nothing is free soon. */
export function NextSlotText({ slot, className }: { slot: NextSlot | null; className?: string }) {
  const { t, locale, formatLocalTime: formatTime } = useTranslation();
  if (!slot) {
    return (
      <span data-dynamic className={cn("text-meta text-ink-muted", className)}>
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
    <span
      data-dynamic
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-success-text [&_svg]:shrink-0", className)}
    >
      <Clock size={15} aria-hidden="true" />
      <bdi className="truncate">{text}</bdi>
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

const BADGE_TONE: Record<string, PillTone> = {
  verified: "brand",
  top_rated: "accent",
};

/**
 * Highlight pills. `onPhoto` renders them as white chips over the card
 * photo (photos don't theme); otherwise brand / accent / neutral fills.
 */
export function Badges({
  badges,
  max = 3,
  onPhoto = false,
  className,
}: {
  badges: string[];
  max?: number;
  onPhoto?: boolean;
  className?: string;
}) {
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
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={t.search.badgesLabel}>
      {shown.map((b) => (
        <li key={b} className="max-w-full">
          <Pill
            size={onPhoto ? "md" : "sm"}
            tone={onPhoto ? "on-photo" : (BADGE_TONE[b] ?? "neutral")}
            icon={BADGE_ICON[b]}
            className={onPhoto ? "h-7" : undefined}
          >
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
  const { t, locale, formatLocalDuration: formatDuration } = useTranslation();
  if (services.length === 0) return null;
  return (
    <ul className="divide-y divide-line">
      {services.map((s) => {
        const name = serviceName(s, locale);
        return (
          <li key={s.id} className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-meta text-ink-muted">
                {s.duration > 0 && <span className="tabular-nums">{formatDuration(s.duration)}</span>}
                {s.duration > 0 && (
                  <span aria-hidden="true" className="text-ink-disabled">
                    ·
                  </span>
                )}
                <Price amount={s.price} from={s.priceType === "from"} trimZeros className="text-[13px] text-ink-soft" />
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
