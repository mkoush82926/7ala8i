"use client";

import React from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { MetaLine } from "@/components/ui/meta-line";
import { barberPath } from "./lib/slug";
import { barberBookingHref } from "./lib/booking";
import { localizedText } from "./lib/media";
import type { BarberData } from "./lib/types";
import { ShopImage } from "./shop-image";

export function BarberAvatar({ barber, size = 64, priority }: { barber: Pick<BarberData, "full_name" | "avatar_url">; size?: number; priority?: boolean }) {
  const initial = Array.from(barber.full_name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      className="relative block shrink-0 rounded-full overflow-hidden bg-[var(--bg-secondary)]"
      style={{ width: size, height: size }}
    >
      {barber.avatar_url ? (
        <ShopImage src={barber.avatar_url} alt="" fill sizes={`${size}px`} className="object-cover" priority={priority} />
      ) : (
        <span aria-hidden="true" className="w-full h-full flex items-center justify-center font-black text-[var(--text-secondary)]" style={{ fontSize: size * 0.36 }}>
          {initial}
        </span>
      )}
    </span>
  );
}

/** Team cards: avatar, name, title, rating; link to the barber page and a Book action. */
export function TeamGrid({ barbers, shopId, src }: { barbers: readonly BarberData[]; shopId: string; src?: string | null }) {
  const { t, locale, formatNumber } = useTranslation();
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {barbers.map((barber) => {
        const title = localizedText(locale, barber.title_en, barber.title_ar, "");
        const meta = [
          barber.rating_count > 0 && barber.rating_avg != null
            ? {
                key: "rating",
                icon: <Star size={12} aria-hidden="true" style={{ color: "var(--accent-brass)", fill: "var(--accent-brass)" }} />,
                label: `${formatNumber(barber.rating_avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${formatNumber(barber.rating_count)})`,
                title: interpolate(t.shopPage.ratingLabel, {
                  rating: formatNumber(barber.rating_avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                }),
              }
            : null,
          title || null,
        ];
        const profileHref = barber.handle ? barberPath(barber.handle, locale) : null;
        const bookHref = barberBookingHref({ locale, shopId, barberId: barber.id, entry: "profile_card", src });
        return (
          <li
            key={barber.id}
            className="relative flex flex-col items-center text-center gap-2 p-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--accent-brass)] transition-colors"
          >
            <BarberAvatar barber={barber} size={72} />
            <div className="min-w-0 w-full">
              {profileHref ? (
                <Link href={profileHref} className="focus-ring font-bold text-sm text-[var(--text-primary)] line-clamp-1 after:absolute after:inset-0 after:content-['']">
                  {barber.full_name}
                </Link>
              ) : (
                <p className="font-bold text-sm text-[var(--text-primary)] line-clamp-1">{barber.full_name}</p>
              )}
              <MetaLine items={meta} as="div" truncate className="justify-center text-xs text-[var(--text-secondary)] mt-0.5" />
            </div>
            <Link
              href={bookHref}
              prefetch={false}
              aria-label={interpolate(t.barberPage.bookWith, { name: barber.full_name })}
              className="focus-ring relative z-10 inline-flex items-center justify-center h-9 px-4 rounded-full border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] hover:border-[var(--accent-brass)]"
            >
              {t.primitives.book}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default TeamGrid;
