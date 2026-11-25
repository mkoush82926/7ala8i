"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { BookingCta, buildBookingHref } from "@/components/ui/booking-cta";
import { buttonClasses, focusRing, pressable } from "@/components/ui/recipes";
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
  const { t, locale, formatDuration, formatCurrency, formatNumber } = useTranslation();
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
        <div role="tablist" aria-label={t.booking.services} className="no-scrollbar -mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-2">
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
                  "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold",
                  focusRing,
                  pressable,
                  selected
                    ? "border-inverse bg-inverse text-on-inverse"
                    : "border-line bg-card text-ink-soft hover:border-ink-soft hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <ul
        id="svc-panel"
        role={showTabs ? "tabpanel" : undefined}
        aria-labelledby={showTabs ? `svc-tab-${active.id}` : undefined}
        className="flex flex-col"
      >
        {rows.map((service) => {
          const name = (locale === "ar" && service.name_ar) || service.name;
          return (
            <li key={service.id} className="flex items-center gap-4 border-b border-line py-4 last:border-b-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-title break-words text-ink">{name}</h3>
                {service.duration > 0 && <p className="text-meta mt-0.5 text-ink-muted">{formatDuration(service.duration)}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                <span className="text-price text-end text-ink">
                  {service.price > 0 ? (
                    <bdi>{price(service.price)}</bdi>
                  ) : (
                    <span className="text-sm font-normal text-ink-muted">{t.shopProfile.priceOnRequest}</span>
                  )}
                </span>
                {barberId ? (
                  <Link
                    href={barberBookingHref({ locale, shopId, barberId, entry: "service_row", src, services: [service.id] })}
                    prefetch={false}
                    aria-label={interpolate(t.shopPage.bookServiceLabel, { service: name })}
                    className={buttonClasses({ variant: "soft", size: "sm", className: "relative z-10 min-w-[4.5rem] px-4" })}
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
              </div>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <Link
          href={barberId ? barberBookingHref({ locale, shopId, barberId, entry: "see_all", src }) : buildBookingHref({ locale, shop: shopId, entry: "see_all", src })}
          prefetch={false}
          className={buttonClasses({ variant: "secondary", size: "md", className: "mt-4 w-full sm:w-auto" })}
        >
          {interpolate(t.shopProfile.seeAllServices, { count: formatNumber(active.services.length) })}
          <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

export default ServicesSection;
