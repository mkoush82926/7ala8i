"use client";

// Filter chips (toggle buttons), price range, sort and "Clear all".
// Pure presentation over SearchState: every change calls onChange with the
// next state and the results page writes it to the URL.

import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown, X } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
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

const chipBase =
  "focus-ring inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors";
const chipOff = "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--text-primary)]";
const chipOn = "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]";

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
          className="-mx-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          {SEARCH_FILTERS.map((f) => {
            const on = state.filters.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(toggleFilter(state, f))}
                className={cn(chipBase, on ? chipOn : chipOff)}
              >
                {on && <Check size={14} aria-hidden="true" />}
                {filterLabel[f]}
              </button>
            );
          })}
          <PriceChip state={state} onChange={onChange} />
        </div>

        <div className="relative hidden shrink-0 items-center md:flex">
          <label htmlFor={sortId} className="sr-only">
            {S.sortLabel}
          </label>
          <ArrowUpDown size={15} aria-hidden="true" className="pointer-events-none absolute start-3 text-[var(--text-secondary)]" />
          <select
            id={sortId}
            value={state.sort}
            onChange={(e) => onChange({ ...state, sort: e.target.value as SearchSort })}
            className="focus-ring h-9 cursor-pointer appearance-none rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] ps-8 pe-8 text-[13.5px] font-semibold text-[var(--text-primary)]"
          >
            {SEARCH_SORTS.map((s) => (
              <option key={s} value={s}>
                {sortLabel[s]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute end-3 text-[var(--text-secondary)]" />
        </div>
      </div>

      {/* Phones: sort on its own row so chips can scroll */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <div className="relative flex items-center">
          <label htmlFor={`${sortId}-m`} className="sr-only">
            {S.sortLabel}
          </label>
          <ArrowUpDown size={15} aria-hidden="true" className="pointer-events-none absolute start-3 text-[var(--text-secondary)]" />
          <select
            id={`${sortId}-m`}
            value={state.sort}
            onChange={(e) => onChange({ ...state, sort: e.target.value as SearchSort })}
            className="focus-ring h-9 cursor-pointer appearance-none rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] ps-8 pe-8 text-[13.5px] font-semibold text-[var(--text-primary)]"
          >
            {SEARCH_SORTS.map((s) => (
              <option key={s} value={s}>
                {sortLabel[s]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute end-3 text-[var(--text-secondary)]" />
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
            className="focus-ring h-9 rounded-full px-3 text-[13.5px] font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
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
  if (state.priceMin !== null && state.priceMax !== null) return interpolate(S.priceRange, { min: fmt(state.priceMin), max: fmt(state.priceMax) });
  if (state.priceMax !== null) return interpolate(S.priceUpTo, { max: fmt(state.priceMax) });
  if (state.priceMin !== null) return interpolate(S.priceFrom, { min: fmt(state.priceMin) });
  return "";
}

function RemovableChip({ label, removeLabel, onRemove }: { label: string; removeLabel: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--text-primary)] bg-[var(--bg-secondary)] ps-3.5 pe-1 text-[13.5px] font-semibold text-[var(--text-primary)]">
      <bdi>{label}</bdi>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="focus-ring flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--bg-primary)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

/** Price chip with a small popover holding min/max inputs. */
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

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMin(state.priceMin?.toString() ?? "");
    setMax(state.priceMax?.toString() ?? "");
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
  }, [open, state.priceMin, state.priceMax]);

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

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(chipBase, active ? chipOn : chipOff)}
      >
        {active ? priceText(state, locale, S) : S.filterPrice}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={S.filterPrice}
          className="fixed inset-x-4 top-1/3 z-50 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 shadow-[0_24px_60px_-20px_rgba(28,22,17,0.35)] md:absolute md:inset-x-auto md:top-11 md:start-0 md:w-72"
        >
          <form onSubmit={apply} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                <span>{S.priceMin}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_PRICE}
                  step="0.5"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                  className="field-input !h-10 w-full"
                  dir="ltr"
                />
              </label>
              <label className="space-y-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                <span>{S.priceMax}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_PRICE}
                  step="0.5"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  className="field-input !h-10 w-full"
                  dir="ltr"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange({ ...state, priceMin: null, priceMax: null });
                  setOpen(false);
                }}
                className="btn btn-ghost !min-h-[40px] !text-[14px]"
              >
                {S.priceAny}
              </button>
              <button type="submit" className="btn btn-primary !min-h-[40px] !text-[14px]">
                {S.applyPrice}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default FilterBar;
