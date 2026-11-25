"use client";

// Filter chips (toggle buttons), price range, sort and "Clear all".
// Pure presentation over SearchState: every change calls onChange with the
// next state and the results page writes it to the URL.

import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpDown, Check, ChevronDown, X } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { FilterChip } from "@/components/ui/pill";
import { buttonClasses, filterChipClasses, focusRing, inputClasses, labelClasses } from "@/components/ui/recipes";
import { formatJOD } from "@/lib/format";
import {
  activeFilterCount,
  clearFilters,
  MAX_PRICE,
  SEARCH_FILTERS,
  SEARCH_SORTS,
  toggleFilter,
  type SearchFilter,
  type SearchSort,
  type SearchState,
} from "@/lib/search";

export interface FilterBarProps {
  state: SearchState;
  onChange: (next: SearchState) => void;
  /** "Nearest" only makes sense with a place; still selectable (falls back to the city centre). */
  className?: string;
}

/** Sort select styled as an outline pill (§5.5 filter-chip look). */
const sortSelect = cn(
  "h-9 cursor-pointer appearance-none rounded-full border border-line-strong bg-card bg-none py-0 ps-9 pe-8 text-sm font-semibold text-ink hover:border-ink focus:border-ink focus:ring-0",
  focusRing,
);

export function FilterBar({ state, onChange, className }: FilterBarProps) {
  const { t, locale } = useTranslation();
  const S = t.search;
  const sortId = useId();

  const filterLabel: Record<SearchFilter, string> = {
    open_now: S.filterOpenNow,
    available_today: S.filterAvailableToday,
    kids: S.filterKids,
    home_service: S.filterHomeService,
    parking: S.filterParking,
    cliq: S.filterCliq,
    card: S.filterCard,
    men: S.filterMen,
    women: S.filterWomen,
  };
  const sortLabel: Record<SearchSort, string> = {
    recommended: S.sortRecommended,
    nearest: S.sortNearest,
    top_rated: S.sortTopRated,
    lowest_price: S.sortLowestPrice,
  };
  const whenLabel =
    state.when === "now"
      ? S.now
      : state.when === "today"
        ? S.today
        : state.when === "tomorrow"
          ? S.tomorrow
          : state.when
            ? new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
                new Date(`${state.when}T00:00:00Z`),
              )
            : "";

  const count = activeFilterCount(state);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label={S.filtersLabel}
          className="no-scrollbar -mx-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4 py-0.5 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          {SEARCH_FILTERS.map((f) => {
            const on = state.filters.includes(f);
            return (
              <FilterChip
                key={f}
                pressed={on}
                onClick={() => onChange(toggleFilter(state, f))}
                icon={on ? <Check aria-hidden="true" /> : undefined}
              >
                {filterLabel[f]}
              </FilterChip>
            );
          })}
          <PriceChip state={state} onChange={onChange} />
        </div>

        <div className="relative hidden shrink-0 items-center border-s border-line ps-3 md:flex">
          <label htmlFor={sortId} className="sr-only">
            {S.sortLabel}
          </label>
          <ArrowUpDown size={15} aria-hidden="true" className="pointer-events-none absolute start-6.5 text-ink-muted" />
          <select
            id={sortId}
            value={state.sort}
            onChange={(e) => onChange({ ...state, sort: e.target.value as SearchSort })}
            className={sortSelect}
          >
            {SEARCH_SORTS.map((s) => (
              <option key={s} value={s}>
                {sortLabel[s]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute end-3 text-ink-muted" />
        </div>
      </div>

      {/* Phones: sort on its own row so chips can scroll */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <div className="relative flex items-center">
          <label htmlFor={`${sortId}-m`} className="sr-only">
            {S.sortLabel}
          </label>
          <ArrowUpDown size={15} aria-hidden="true" className="pointer-events-none absolute start-3.5 text-ink-muted" />
          <select
            id={`${sortId}-m`}
            value={state.sort}
            onChange={(e) => onChange({ ...state, sort: e.target.value as SearchSort })}
            className={sortSelect}
          >
            {SEARCH_SORTS.map((s) => (
              <option key={s} value={s}>
                {sortLabel[s]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute end-3 text-ink-muted" />
        </div>
      </div>

      {/* Active refinements that are not chips above (when / time) + Clear all */}
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {state.when && (
            <RemovableChip
              label={whenLabel}
              removeLabel={interpolate(S.removeFilter, { name: whenLabel })}
              onRemove={() => onChange({ ...state, when: "" })}
            />
          )}
          {state.time && (
            <RemovableChip
              label={S[state.time]}
              removeLabel={interpolate(S.removeFilter, { name: S[state.time] })}
              onRemove={() => onChange({ ...state, time: "" })}
            />
          )}
          {(state.priceMin !== null || state.priceMax !== null) && (
            <RemovableChip
              label={priceText(state, locale, S)}
              removeLabel={interpolate(S.removeFilter, { name: priceText(state, locale, S) })}
              onRemove={() => onChange({ ...state, priceMin: null, priceMax: null })}
            />
          )}
          <button
            type="button"
            onClick={() => onChange(clearFilters(state))}
            className={buttonClasses({ variant: "link", size: "sm", className: "h-9 px-2" })}
          >
            {S.clearAll}
          </button>
        </div>
      )}
    </div>
  );
}

function priceText(state: SearchState, locale: string, S: { priceRange: string; priceUpTo: string; priceFrom: string }): string {
  const fmt = (n: number) => formatJOD(n, { locale, trimZeros: true });
  if (state.priceMin !== null && state.priceMax !== null)
    return interpolate(S.priceRange, { min: fmt(state.priceMin), max: fmt(state.priceMax) });
  if (state.priceMax !== null) return interpolate(S.priceUpTo, { max: fmt(state.priceMax) });
  if (state.priceMin !== null) return interpolate(S.priceFrom, { min: fmt(state.priceMin) });
  return "";
}

function RemovableChip({ label, removeLabel, onRemove }: { label: string; removeLabel: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full bg-brand-soft ps-3.5 pe-1 text-sm font-semibold text-brand-pressed">
      <bdi>{label}</bdi>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className={cn("grid size-7 cursor-pointer place-items-center rounded-full hover:bg-card", focusRing)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** md+ viewport (false on the server and in old browsers). */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Price chip. md+: an anchored popover with min/max inputs. Below md the same
 * form opens in the shared <Dialog> (bottom sheet, portalled, focus trap):
 * the chip row scrolls horizontally and the results bar uses backdrop-filter,
 * so an inline fixed panel would be clipped there.
 */
function PriceChip({ state, onChange }: { state: SearchState; onChange: (next: SearchState) => void }) {
  const { t, locale } = useTranslation();
  const S = t.search;
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(state.priceMin?.toString() ?? "");
  const [max, setMax] = useState(state.priceMax?.toString() ?? "");
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = state.priceMin !== null || state.priceMax !== null;
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMin(state.priceMin?.toString() ?? "");
    setMax(state.priceMax?.toString() ?? "");
    // The mobile sheet (<Dialog>) handles Escape, outside clicks and focus itself.
    if (!isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!panelRef.current?.contains(n) && !btnRef.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, state.priceMin, state.priceMax, isDesktop]);

  const parse = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_PRICE) : null;
  };

  function apply(e: React.FormEvent) {
    e.preventDefault();
    let lo = parse(min);
    let hi = parse(max);
    if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
    onChange({ ...state, priceMin: lo, priceMax: hi });
    setOpen(false);
    btnRef.current?.focus();
  }

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  const form = (
    <form onSubmit={apply} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClasses}>{S.priceMin}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_PRICE}
            step="0.5"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className={inputClasses({ className: "h-11 tabular-nums" })}
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className={labelClasses}>{S.priceMax}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_PRICE}
            step="0.5"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className={inputClasses({ className: "h-11 tabular-nums" })}
            dir="ltr"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            onChange({ ...state, priceMin: null, priceMax: null });
            close();
          }}
          className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10" })}
        >
          {S.priceAny}
        </button>
        <button type="submit" className={buttonClasses({ variant: "primary", size: "sm", className: "h-10 px-5" })}>
          {S.applyPrice}
        </button>
      </div>
    </form>
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={open && isDesktop ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(filterChipClasses, active && "border-inverse bg-inverse text-on-inverse hover:border-inverse")}
      >
        <bdi>{active ? priceText(state, locale, S) : S.filterPrice}</bdi>
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      {open && isDesktop && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={S.filterPrice}
          className="fade-slide-up absolute top-11 start-0 z-50 w-80 rounded-2xl border border-line bg-card p-4 shadow-float"
        >
          {form}
        </div>
      )}
      {!isDesktop && (
        <Dialog open={open} onClose={close} title={S.filterPrice} size="sm">
          {form}
        </Dialog>
      )}
    </div>
  );
}

export default FilterBar;
