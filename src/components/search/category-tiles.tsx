// Category tiles for the home page (§4: 1:1 icon tile on brand-soft).
// Server-safe (no hooks): pass the locale
// and labels. Each tile is a plain link into a search, so it works without
// JavaScript and is crawlable. "home-service" maps to the Home service
// filter instead of a text query.

import React from "react";
import Link from "next/link";
import { Baby, Brush, Droplet, Gift, House, Layers, Palette, Scissors, Slice, Sparkles, Wind, type LucideIcon } from "lucide-react";
import { searchHref, type SearchCategory, type SearchState } from "@/lib/search";
import { cn } from "@/lib/utils";
import { cardClasses, focusRing } from "@/components/ui/recipes";

const ICONS: Record<string, LucideIcon> = {
  scissors: Scissors,
  gradient: Layers,
  beard: Brush,
  razor: Slice,
  child: Baby,
  comb: Wind,
  palette: Palette,
  droplet: Droplet,
  sparkles: Sparkles,
  gift: Gift,
  home: House,
};

/** The search a category tile opens. */
export function categorySearch(category: Pick<SearchCategory, "slug" | "nameEn" | "nameAr">, locale: string): Partial<SearchState> {
  if (category.slug === "home-service") return { filters: ["home_service"] };
  return { q: locale === "ar" ? category.nameAr : category.nameEn };
}

export function CategoryTiles({
  categories,
  locale,
  label,
  className,
}: {
  categories: SearchCategory[];
  locale: string;
  /** Accessible name of the list. */
  label: string;
  className?: string;
}) {
  if (categories.length === 0) return null;
  // Phones: a two-row horizontal scroller (one row when there are few);
  // from lg a plain six-column grid.
  const rows = categories.length > 6 ? "grid-rows-2" : "grid-rows-1";
  // lg: a column count that divides the list, so no row ends with orphans.
  const n = categories.length;
  const lgCols = n % 8 === 0 ? "lg:grid-cols-8" : n % 6 === 0 ? "lg:grid-cols-6" : n % 5 === 0 ? "lg:grid-cols-5" : n % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-6";
  return (
    <ul
      aria-label={label}
      className={
        className ??
        cn(
          "no-scrollbar -mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[40%] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 pt-1",
          "sm:-mx-6 sm:scroll-px-6 sm:auto-cols-[23%] sm:px-6",
          "lg:mx-0 lg:grid-flow-row lg:grid-rows-none lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0",
          lgCols,
          rows,
        )
      }
    >
      {categories.map((c) => {
        const Icon = (c.icon && ICONS[c.icon]) || Scissors;
        const name = locale === "ar" ? c.nameAr : c.nameEn;
        return (
          <li key={c.id} className="snap-start">
            <Link
              href={searchHref(locale, categorySearch(c, locale))}
              className={cn(
                cardClasses({ elevation: "card", interactive: true }),
                "group flex aspect-square h-full flex-col items-center justify-center gap-3 p-3 text-center hover:border-brand-soft-line",
                focusRing,
              )}
            >
              <span
                aria-hidden="true"
                className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-text transition-colors duration-200 ease-standard group-hover:bg-brand group-hover:text-on-brand motion-reduce:transition-none [&_svg]:size-6"
              >
                <Icon strokeWidth={1.75} />
              </span>
              <span className="line-clamp-2 text-sm font-semibold leading-5 text-ink">{name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default CategoryTiles;
