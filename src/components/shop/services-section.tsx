"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { BookingCta, buildBookingHref } from "@/components/ui/booking-cta";
import { MetaLine } from "@/components/ui/meta-line";
import { formatJOD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { barberBookingHref } from "./lib/booking";
import { groupServicesByCategory, POPULAR_CATEGORY } from "./lib/services";
import type { ServiceCategory, ServiceData } from "./lib/types";

const PER_TAB = 6;

/**
 * Services with category tabs (only when there are 2+ categories), up to six
 * rows per tab, an inline Book on every row and "See all" into booking.
 */
export function ServicesSection({
  services,
  categories,
  shopId,
  src,
  barberId,
  currency = "JOD",
}: {
  services: readonly ServiceData[];
  categories: readonly ServiceCategory[];
  shopId: string;
  src?: string | null;
  /** Barber page: preselect this barber when booking. */
  barberId?: string | null;
  currency?: string;
}) {
  const { t, locale, formatDuration, formatCurrency } = useTranslation();
  const groups = useMemo(() => groupServicesByCategory(services, categories), [services, categories]);
  const tabs = useMemo(
    () => [
      { id: POPULAR_CATEGORY, label: t.shopProfile.allCategories, services: [...services] },
      ...groups.map((g) => ({
        id: g.id,
        label: g.category ? (locale === "ar" ? g.category.name_ar : g.category.name_en) : t.shopProfile.otherCategory,
        services: g.services,
      })),
    ],
    [groups, services, locale, t],
  );
  const [activeId, setActiveId] = useState(POPULAR_CATEGORY);
  const showTabs = groups.length > 1;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const rows = active.services.slice(0, PER_TAB);
  const hidden = active.services.length - rows.length;
  const price = (amount: number) =>
    currency === "JOD" ? formatJOD(amount, { locale, trimZeros: true }) : formatCurrency(amount, currency);

  const onTabKey = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const isRTL = locale === "ar";
    const next = e.key === "ArrowRight" ? (isRTL ? -1 : 1) : e.key === "ArrowLeft" ? (isRTL ? 1 : -1) : 0;
    if (!next) return;
    e.preventDefault();
    const target = tabs[(index + next + tabs.length) % tabs.length];
    setActiveId(target.id);
    document.getElementById(`svc-tab-${target.id}`)?.focus();
  };

  return (
    <div>
      {showTabs && (
        <div role="tablist" aria-label={t.booking.services} className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
          {tabs.map((tab, i) => {
            const selected = tab.id === active.id;
            return (
              <button
                key={tab.id}
                id={`svc-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="svc-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(tab.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  "focus-ring shrink-0 h-9 px-4 rounded-full text-sm font-bold border transition-colors",
                  selected
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]"
                    : "bg-transparent text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-brass)]",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <ul id="svc-panel" role={showTabs ? "tabpanel" : undefined} aria-labelledby={showTabs ? `svc-tab-${active.id}` : undefined} className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
        {rows.map((service) => {
          const name = (locale === "ar" && service.name_ar) || service.name;
          return (
            <li key={service.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <h3 className="font-bold text-[15px] text-[var(--text-primary)] break-words">{name}</h3>
                <MetaLine
                  items={[service.duration > 0 ? formatDuration(service.duration) : null, service.price > 0 ? price(service.price) : t.shopProfile.priceOnRequest]}
                  className="mt-0.5 text-sm text-[var(--text-secondary)]"
                />
              </div>
              {barberId ? (
                <Link
                  href={barberBookingHref({ locale, shopId, barberId, entry: "service_row", src, services: [service.id] })}
                  prefetch={false}
                  aria-label={interpolate(t.shopPage.bookServiceLabel, { service: name })}
                  className="focus-ring shrink-0 inline-flex items-center justify-center h-9 min-w-[4.5rem] px-4 rounded-full border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] hover:border-[var(--accent-brass)]"
                >
                  {t.primitives.book}
                </Link>
              ) : (
                <BookingCta
                  shop={shopId}
                  entry="service_row"
                  src={src}
                  services={[service.id]}
                  variant="inline"
                  ariaLabel={interpolate(t.shopPage.bookServiceLabel, { service: name })}
                  className="shrink-0"
                />
              )}
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <Link
          href={barberId ? barberBookingHref({ locale, shopId, barberId, entry: "see_all", src }) : buildBookingHref({ locale, shop: shopId, entry: "see_all", src })}
          prefetch={false}
          className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent-text)] underline-offset-4 hover:underline"
        >
          {interpolate(t.shopProfile.seeAllServices, { count: active.services.length })}
          <ChevronRight size={16} aria-hidden="true" className="rtl:-scale-x-100" />
        </Link>
      )}
    </div>
  );
}

export default ServicesSection;
