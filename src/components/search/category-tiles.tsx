// Category tiles for the home page. Server-safe (no hooks): pass the locale
// and labels. Each tile is a plain link into a search, so it works without
// JavaScript and is crawlable. "home-service" maps to the Home service
// filter instead of a text query.

import React from "react";
import Link from "next/link";
import {
  Baby,
  Brush,
  Droplet,
  Gift,
  House,
  Layers,
  Palette,
  Scissors,
  Slice,
  Sparkles,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { searchHref, type SearchCategory, type SearchState } from "@/lib/search";

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
  return (
    <ul aria-label={label} className={className ?? "grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6"}>
      {categories.map((c) => {
        const Icon = (c.icon && ICONS[c.icon]) || Scissors;
        const name = locale === "ar" ? c.nameAr : c.nameEn;
        return (
          <li key={c.id}>
            <Link
              href={searchHref(locale, categorySearch(c, locale))}
              className="focus-ring group flex h-full min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-3 text-center transition-colors hover:border-[var(--accent-brass)]"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--accent-text)] transition-colors group-hover:bg-[var(--cta-bg)] group-hover:text-[var(--cta-fg)]"
              >
                <Icon size={19} />
              </span>
              <span className="text-[13px] font-semibold leading-tight text-[var(--text-primary)]">{name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default CategoryTiles;
