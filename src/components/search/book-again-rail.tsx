"use client";

// "Book again" rail for signed-in customers: their recently completed visits
// with the same services and barber preselected. Renders nothing for guests,
// staff, errors or an empty history (a section only shows with content).

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { BookingCta } from "@/components/ui/booking-cta";
import { ShopImage } from "@/components/shop/shop-image";
import { shopPath } from "@/components/shop/lib/slug";
import { createClient } from "@/lib/supabase/client";
import { coverForShop, shopInitials } from "@/app/[locale]/shop/shop-utils";
import { fetchBookAgain, localName, type BookAgainItem, type SearchRpcClient } from "@/lib/search";

export function BookAgainRail() {
  const { t, locale, formatDate } = useTranslation();
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
    <section aria-labelledby="book-again-title" className="mx-auto w-full max-w-[1200px] px-4 pt-10">
      <h2 id="book-again-title" className="mb-4 flex items-center gap-2 text-[20px] font-bold text-[var(--text-primary)]">
        <RotateCcw size={18} aria-hidden="true" className="text-[var(--accent-text)]" />
        {S.bookAgainTitle}
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.map((it) => {
          const name = localName({ en: it.shop.name, ar: it.shop.nameAr }, locale) || it.shop.name;
          const cover = coverForShop(it.shop.id);
          return (
            <li key={it.shop.id} className="w-[240px] shrink-0 snap-start">
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                <Link href={shopPath(it.shop, locale)} tabIndex={-1} aria-hidden="true" className="relative block aspect-[16/9] bg-[var(--bg-secondary)]">
                  {it.shop.coverUrl ? (
                    <ShopImage src={it.shop.coverUrl} alt="" fill sizes="240px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[26px] font-extrabold" style={{ background: cover.bg, color: cover.fg }}>
                      {shopInitials(name)}
                    </span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                    <Link href={shopPath(it.shop, locale)} className="focus-ring rounded-sm hover:underline underline-offset-4">
                      {name}
                    </Link>
                  </h3>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    {[it.serviceName, it.barberName ? interpolate(S.bookAgainWith, { name: it.barberName }) : null].filter(Boolean).join(" · ")}
                  </p>
                  {it.lastVisit && (
                    <p className="text-[12px] text-[var(--text-muted)]">{interpolate(S.bookAgainLastVisit, { date: formatDate(it.lastVisit, "medium") })}</p>
                  )}
                  <div className="mt-auto pt-2">
                    <BookingCta
                      variant="inline"
                      shop={it.shop.slug || it.shop.id}
                      entry="rebook"
                      services={it.serviceIds}
                      staff={it.barberId ?? undefined}
                      label={S.bookAgainCta}
                      ariaLabel={interpolate(S.bookAgainAria, { name })}
                      className="w-full"
                    />
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default BookAgainRail;
