"use client";

// The house search bar (§2.4): service/shop/barber · area or near me · when.
// Every field has a permissive default, the state lives in the URL, and the
// same bar sits in the home hero and (sticky, pre-filled) on results.
//
// v2 (§5.3): one big white pill with What / Where / When segments and a teal
// submit from 768px; on phones the fields stack in a rounded card. When
// `collapsible`, phones first see a one-line summary pill that expands the
// card inline. Presentation only — state and URL params are unchanged.

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { buttonClasses, focusRing } from "@/components/ui/recipes";
import { SearchBarShell, SearchDivider, SearchPill, SearchSegment } from "@/components/ui/search-bar-shell";
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

export function SearchBar({ initial, cities, categories = [], variant = "hero", collapsible = true, onSearch, className }: SearchBarProps) {
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
  // The whole segment shows focus (ring), so the bare controls inside drop
  // the forms-plugin border/padding/ring and sit flush under the label.
  const segmentCls = cn(
    "rounded-xl px-4 md:rounded-full md:px-5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
    hero ? "min-h-16 md:min-h-[60px]" : "min-h-14 md:min-h-12 md:py-1.5",
  );
  const controlCls =
    "block h-6 w-full min-w-0 truncate border-0 bg-transparent p-0 text-[15px] leading-6 text-ink shadow-none outline-none placeholder:text-ink-muted focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 md:text-sm";
  const selectCls = cn(controlCls, "cursor-pointer appearance-none bg-none pe-1");
  const labelCls = "block cursor-pointer";

  return (
    <div className={cn("w-full", className)}>
      {/* Phones: the collapsed summary pill */}
      {collapsible && (
        <SearchPill
          compact={!hero}
          ariaLabel={S.editSearch}
          summary={[q.trim() || S.allServices, placeLabel, whenLabel]}
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded) requestAnimationFrame(() => qRef.current?.focus());
          }}
          aria-expanded={expanded}
          aria-controls={ids.form}
          className="md:hidden"
        />
      )}

      <SearchBarShell
        id={ids.form}
        ariaLabel={S.searchLabel}
        onSubmit={submit}
        className={cn(
          "max-w-none flex-col gap-1 rounded-2xl p-2 md:flex-row md:items-stretch md:gap-0 md:rounded-full md:p-1.5",
          hero ? "md:max-w-4xl" : "shadow-xs md:max-w-none",
          collapsible ? (expanded ? "mt-2 flex md:mt-0" : "hidden md:flex") : "flex",
        )}
      >
        {/* What */}
        <SearchSegment
          asContainer
          className={cn(segmentCls, "md:flex-[1.15]")}
          icon={<Search />}
          label={
            <label htmlFor={ids.q} className={labelCls}>
              {S.whatLabel}
            </label>
          }
        >
          <span className="flex items-center gap-1">
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
              className={cn(controlCls, "[&::-webkit-search-cancel-button]:hidden")}
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  qRef.current?.focus();
                }}
                aria-label={S.clearQuery}
                className={cn(
                  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-card hover:text-ink",
                  focusRing,
                )}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </span>
          {categories.length > 0 && (
            <datalist id={ids.list}>
              {categories.map((c) => (
                <option key={c.id} value={locale === "ar" ? c.nameAr : c.nameEn} />
              ))}
            </datalist>
          )}
        </SearchSegment>

        <SearchDivider className="hidden md:block" />

        {/* Where */}
        <SearchSegment
          asContainer
          className={segmentCls}
          icon={place === "near" ? <LocateFixed /> : <MapPin />}
          label={
            <label htmlFor={ids.place} className={labelCls}>
              {S.whereLabel}
            </label>
          }
        >
          <select id={ids.place} value={place} onChange={(e) => setPlace(e.target.value)} className={selectCls}>
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
        </SearchSegment>

        <SearchDivider className="hidden md:block" />

        {/* When */}
        <SearchSegment
          asContainer
          className={cn(segmentCls, "md:flex-[1.45]")}
          icon={<CalendarDays />}
          label={
            <label htmlFor={ids.when} className={labelCls}>
              {S.whenLabel}
            </label>
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <select
              id={ids.when}
              value={when}
              onChange={(e) => {
                const v = e.target.value as WhenChoice;
                setWhen(v);
                if (v === "pick" && !date) setDate(today);
              }}
              className={cn(selectCls, "flex-1")}
            >
              <option value="">{S.anyTime}</option>
              <option value="now">{S.now}</option>
              <option value="today">{S.today}</option>
              <option value="tomorrow">{S.tomorrow}</option>
              <option value="pick">{S.pickDate}</option>
            </select>
            {when === "pick" && (
              <>
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
                  className={cn(controlCls, "w-auto max-w-[9.5rem] shrink-0 tabular-nums")}
                  dir="ltr"
                />
              </>
            )}
            {when !== "now" && (
              <span className="flex shrink-0 items-center gap-1 border-s border-line ps-2">
                <Clock size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
                <label htmlFor={ids.time} className="sr-only">
                  {S.timeLabel}
                </label>
                <select
                  id={ids.time}
                  value={time}
                  onChange={(e) => setTime(e.target.value as TimeWindow | "")}
                  className={cn(selectCls, "w-auto max-w-[7.5rem]")}
                >
                  <option value="">{S.anyHour}</option>
                  {TIME_WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {S[w]}
                    </option>
                  ))}
                </select>
              </span>
            )}
          </span>
        </SearchSegment>

        <button
          type="submit"
          className={buttonClasses({
            variant: "primary",
            size: "lg",
            className: cn(
              "mt-1 w-full md:mt-0 md:px-0 lg:w-auto lg:px-7",
              hero ? "h-14 md:size-14 lg:w-auto" : "h-12 md:size-12 lg:w-auto",
            ),
          })}
        >
          <Search aria-hidden="true" className={isRTL ? "-scale-x-100" : undefined} />
          <span className="md:sr-only lg:not-sr-only">{S.submit}</span>
        </button>
      </SearchBarShell>
    </div>
  );
}

export default SearchBar;
