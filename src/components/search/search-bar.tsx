"use client";

// The house search bar (§2.4): service/shop/barber · area or near me · when.
// Every field has a permissive default, the state lives in the URL, and the
// same bar sits in the home hero and (sticky, pre-filled) on results.
//
// On phones it starts collapsed to a one-line summary button; tapping it
// opens the three fields inline. From 768px the fields are always visible.

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, LocateFixed, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { MetaLine } from "@/components/ui/meta-line";
import {
  addDays,
  DEFAULT_SEARCH_STATE,
  findArea,
  findCity,
  isIsoDate,
  searchHref,
  writeLastCity,
  zonedNow,
  TIME_WINDOWS,
  type SearchCategory,
  type SearchCity,
  type SearchState,
  type SearchWhen,
  type TimeWindow,
} from "@/lib/search";

export interface SearchBarProps {
  /** Current URL state (results page) or the default (home). */
  initial?: SearchState;
  cities: SearchCity[];
  categories?: SearchCategory[];
  /** "hero" = large card on the home page; "compact" = sticky bar on results. */
  variant?: "hero" | "compact";
  /** Start collapsed on phones (summary button). */
  collapsible?: boolean;
  /** Overrides navigation (tests / embedding). */
  onSearch?: (state: SearchState) => void;
  className?: string;
}

type WhenChoice = "" | "now" | "today" | "tomorrow" | "pick";

function placeValue(state: Pick<SearchState, "near" | "city" | "area">): string {
  if (state.near) return "near";
  if (state.city && state.area) return `area:${state.city}:${state.area}`;
  if (state.city) return `city:${state.city}`;
  return "";
}

function parsePlace(value: string): Pick<SearchState, "near" | "city" | "area"> {
  if (value === "near") return { near: true, city: "", area: "" };
  const [kind, city = "", area = ""] = value.split(":");
  if (kind === "city") return { near: false, city, area: "" };
  if (kind === "area") return { near: false, city, area };
  return { near: false, city: "", area: "" };
}

export function SearchBar({
  initial,
  cities,
  categories = [],
  variant = "hero",
  collapsible = true,
  onSearch,
  className,
}: SearchBarProps) {
  const { t, locale, isRTL } = useTranslation();
  const S = t.search;
  const router = useRouter();
  const base = initial ?? DEFAULT_SEARCH_STATE;
  const uid = useId();
  const ids = {
    q: `${uid}-q`,
    list: `${uid}-cats`,
    place: `${uid}-place`,
    when: `${uid}-when`,
    date: `${uid}-date`,
    time: `${uid}-time`,
    form: `${uid}-form`,
  };

  const [q, setQ] = useState(base.q);
  const [place, setPlace] = useState(placeValue(base));
  const initialWhen: WhenChoice = base.when && isIsoDate(base.when) ? "pick" : (base.when as WhenChoice);
  const [when, setWhen] = useState<WhenChoice>(initialWhen);
  const [date, setDate] = useState<string>(isIsoDate(base.when) ? base.when : "");
  const [time, setTime] = useState<TimeWindow | "">(base.time);
  const [expanded, setExpanded] = useState(!collapsible);
  const qRef = useRef<HTMLInputElement>(null);

  // Follow URL changes (back/forward, chips) on the results page.
  useEffect(() => {
     
    setQ(base.q);
    setPlace(placeValue(base));
    setWhen(base.when && isIsoDate(base.when) ? "pick" : (base.when as WhenChoice));
    setDate(isIsoDate(base.when) ? base.when : "");
    setTime(base.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.q, base.near, base.city, base.area, base.when, base.time]);

  const today = useMemo(() => zonedNow(new Date()).date, []);
  const maxDate = useMemo(() => addDays(today, 90), [today]);

  const cityName = (c: SearchCity) => (locale === "ar" ? c.nameAr : c.nameEn);
  const placeLabel = useMemo(() => {
    const p = parsePlace(place);
    if (p.near) return S.nearMe;
    const city = findCity(cities, p.city);
    const area = findArea(city, p.area);
    if (area) return locale === "ar" ? area.nameAr : area.nameEn;
    if (city) return cityName(city);
    return S.anywhere;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, cities, locale]);

  const whenLabel =
    when === "now"
      ? S.now
      : when === "today"
        ? S.today
        : when === "tomorrow"
          ? S.tomorrow
          : when === "pick" && date
            ? new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
                new Date(`${date}T00:00:00Z`),
              )
            : S.anyTime;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const p = parsePlace(place);
    const nextWhen: SearchWhen = when === "pick" ? (isIsoDate(date) ? (date as SearchWhen) : "") : when;
    const next: SearchState = {
      ...base,
      q: q.trim(),
      ...p,
      when: nextWhen,
      time: nextWhen === "now" ? "" : time,
    };
    if (p.city) writeLastCity(p.city);
    if (onSearch) onSearch(next);
    else router.push(searchHref(locale, next));
    if (collapsible) setExpanded(false);
  }

  const hero = variant === "hero";
  const fieldShell =
    "group relative flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md,12px)] px-3 focus-within:ring-2 focus-within:ring-[var(--accent-brass)]";
  const labelCls = "block text-[11px] font-semibold text-[var(--text-secondary)]";
  const controlCls =
    "w-full min-w-0 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none";

  return (
    <div className={cn("w-full", className)}>
      {/* Phones: the collapsed summary */}
      {collapsible && (
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded) requestAnimationFrame(() => qRef.current?.focus());
          }}
          aria-expanded={expanded}
          aria-controls={ids.form}
          className={cn(
            "focus-ring flex w-full items-center gap-3 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] ps-4 pe-2 text-start shadow-[0_8px_24px_-12px_rgba(28,22,17,0.25)] md:hidden",
            hero ? "min-h-[56px]" : "min-h-[48px]",
          )}
        >
          <Search size={18} aria-hidden="true" className="shrink-0 text-[var(--text-primary)]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-[var(--text-primary)]">{q.trim() || S.allServices}</span>
            <MetaLine as="span" truncate className="text-xs" items={[placeLabel, whenLabel]} />
          </span>
          <span className="sr-only">{S.editSearch}</span>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)]"
          >
            {expanded ? <X size={16} /> : <SlidersHorizontal size={16} />}
          </span>
        </button>
      )}

      <form
        id={ids.form}
        role="search"
        aria-label={S.searchLabel}
        onSubmit={submit}
        className={cn(
          "flex-col gap-2 rounded-[20px] border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 shadow-[0_18px_48px_-24px_rgba(28,22,17,0.35)] md:flex md:flex-row md:items-stretch md:rounded-full",
          collapsible ? (expanded ? "mt-2 flex md:mt-0" : "hidden") : "flex",
        )}
      >
        {/* What */}
        <div className={cn(fieldShell, hero ? "min-h-[56px]" : "min-h-[48px]")}>
          <Search size={18} aria-hidden="true" className="shrink-0 text-[var(--text-muted)]" />
          <div className="min-w-0 flex-1">
            <label htmlFor={ids.q} className={labelCls}>
              {S.whatLabel}
            </label>
            <input
              ref={qRef}
              id={ids.q}
              type="search"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={S.whatPlaceholder}
              list={categories.length ? ids.list : undefined}
              autoComplete="off"
              enterKeyHint="search"
              maxLength={120}
              className={controlCls}
            />
            {categories.length > 0 && (
              <datalist id={ids.list}>
                {categories.map((c) => (
                  <option key={c.id} value={locale === "ar" ? c.nameAr : c.nameEn} />
                ))}
              </datalist>
            )}
          </div>
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                qRef.current?.focus();
              }}
              aria-label={S.clearQuery}
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <span aria-hidden="true" className="hidden w-px self-stretch bg-[var(--border-subtle)] md:block" />

        {/* Where */}
        <div className={cn(fieldShell, hero ? "min-h-[56px]" : "min-h-[48px]")}>
          {place === "near" ? (
            <LocateFixed size={18} aria-hidden="true" className="shrink-0 text-[var(--text-muted)]" />
          ) : (
            <MapPin size={18} aria-hidden="true" className="shrink-0 text-[var(--text-muted)]" />
          )}
          <div className="min-w-0 flex-1">
            <label htmlFor={ids.place} className={labelCls}>
              {S.whereLabel}
            </label>
            <select id={ids.place} value={place} onChange={(e) => setPlace(e.target.value)} className={cn(controlCls, "cursor-pointer appearance-none")}>
              <option value="">{S.anywhere}</option>
              <option value="near">{S.nearMe}</option>
              {cities.map((c) => (
                <optgroup key={c.id} label={cityName(c)}>
                  <option value={`city:${c.slug}`}>{interpolate(S.allOfCity, { city: cityName(c) })}</option>
                  {c.areas.map((a) => (
                    <option key={a.id} value={`area:${c.slug}:${a.slug}`}>
                      {locale === "ar" ? a.nameAr : a.nameEn}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <span aria-hidden="true" className="hidden w-px self-stretch bg-[var(--border-subtle)] md:block" />

        {/* When */}
        <div className={cn(fieldShell, "flex-wrap", hero ? "min-h-[56px]" : "min-h-[48px]")}>
          <CalendarDays size={18} aria-hidden="true" className="shrink-0 text-[var(--text-muted)]" />
          <div className="min-w-0 flex-1">
            <label htmlFor={ids.when} className={labelCls}>
              {S.whenLabel}
            </label>
            <select
              id={ids.when}
              value={when}
              onChange={(e) => {
                const v = e.target.value as WhenChoice;
                setWhen(v);
                if (v === "pick" && !date) setDate(today);
              }}
              className={cn(controlCls, "cursor-pointer appearance-none")}
            >
              <option value="">{S.anyTime}</option>
              <option value="now">{S.now}</option>
              <option value="today">{S.today}</option>
              <option value="tomorrow">{S.tomorrow}</option>
              <option value="pick">{S.pickDate}</option>
            </select>
          </div>
          {when === "pick" && (
            <div className="min-w-[8.5rem]">
              <label htmlFor={ids.date} className="sr-only">
                {S.pickDate}
              </label>
              <input
                id={ids.date}
                type="date"
                value={date}
                min={today}
                max={maxDate}
                onChange={(e) => setDate(e.target.value)}
                className={cn(controlCls, "text-[14px]")}
                dir="ltr"
              />
            </div>
          )}
          {when !== "now" && (
            <div className="flex min-w-[7.5rem] items-center gap-1.5">
              <Clock size={14} aria-hidden="true" className="shrink-0 text-[var(--text-muted)]" />
              <label htmlFor={ids.time} className="sr-only">
                {S.timeLabel}
              </label>
              <select
                id={ids.time}
                value={time}
                onChange={(e) => setTime(e.target.value as TimeWindow | "")}
                className={cn(controlCls, "cursor-pointer appearance-none text-[14px]")}
              >
                <option value="">{S.anyHour}</option>
                {TIME_WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    {S[w]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          type="submit"
          className={cn(
            "focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--cta-bg)] px-6 font-bold text-[var(--cta-fg)] transition-opacity hover:opacity-90",
            hero ? "min-h-[52px] text-[16px]" : "min-h-[44px] text-[15px]",
          )}
        >
          <Search size={18} aria-hidden="true" className={isRTL ? "-scale-x-100" : undefined} />
          <span>{S.submit}</span>
        </button>
      </form>
    </div>
  );
}

export default SearchBar;
