"use client";

// "Book again" rail for signed-in customers: their recently completed visits
// with the same services and barber preselected. Renders nothing for guests,
// staff, errors or an empty history (a section only shows with content).
// The caller provides the page container; this renders the section only.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { BookingCta } from "@/components/ui/booking-cta";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { cardClasses, focusRing, railClasses } from "@/components/ui/recipes";
import { shopPath } from "@/components/shop/lib/slug";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { fetchBookAgain, localName, type BookAgainItem, type SearchRpcClient } from "@/lib/search";

export function BookAgainRail({ className }: { className?: string }) {
  const { t, locale, formatLocalDate: formatDate } = useTranslation();
  const S = t.search;
  const [items, setItems] = useState<BookAgainItem[]>([]);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data?.user) return;
        const rows = await fetchBookAgain(supabase as unknown as SearchRpcClient, 8);
        if (alive) setItems(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="book-again-title" className={cn("fade-slide-up pt-10 md:pt-14", className)}>
      <h2 id="book-again-title" className="text-h2 mb-5 flex items-center gap-2.5 text-ink">
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-text">
          <RotateCcw size={18} />
        </span>
        {S.bookAgainTitle}
      </h2>
      <ul className={cn(railClasses, "pb-2 pt-1")}>
        {items.map((it) => {
          const name = localName({ en: it.shop.name, ar: it.shop.nameAr }, locale) || it.shop.name;
          const detail = [it.serviceName, it.barberName ? interpolate(S.bookAgainWith, { name: it.barberName }) : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={it.shop.id} className="w-[82%] shrink-0 snap-start sm:w-[320px]">
              <article className={cardClasses({ elevation: "card", interactive: true, className: "flex h-full flex-col gap-4 p-3" })}>
                <div className="flex min-w-0 items-center gap-3">
                  <Link href={shopPath(it.shop, locale)} tabIndex={-1} aria-hidden="true" className="group shrink-0">
                    <PhotoFrame
                      src={it.shop.coverUrl}
                      alt=""
                      ratio="1/1"
                      rounded="lg"
                      fallbackName={name}
                      seed={it.shop.id}
                      sizes="64px"
                      hoverZoom
                      className="size-16"
                      initialsClassName="text-lg md:text-lg"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-title truncate text-ink">
                      <Link href={shopPath(it.shop, locale)} className={cn("rounded-sm underline-offset-4 hover:underline", focusRing)}>
                        {name}
                      </Link>
                    </h3>
                    {detail && <p className="truncate text-meta text-ink-soft">{detail}</p>}
                    {it.lastVisit && (
                      <p className="truncate text-meta text-ink-muted">
                        {interpolate(S.bookAgainLastVisit, { date: formatDate(it.lastVisit, "medium") })}
                      </p>
                    )}
                  </div>
                </div>
                <BookingCta
                  variant="inline"
                  shop={it.shop.slug || it.shop.id}
                  entry="rebook"
                  services={it.serviceIds}
                  staff={it.barberId ?? undefined}
                  label={S.bookAgainCta}
                  ariaLabel={interpolate(S.bookAgainAria, { name })}
                  className="mt-auto h-10 w-full"
                />
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default BookAgainRail;
