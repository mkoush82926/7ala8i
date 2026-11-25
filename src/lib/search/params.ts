// URL <-> SearchState. Every search is a plain URL so it can be shared,
// bookmarked and crawled:
//
//   /ar/explore?q=fade&city=amman&area=khalda&when=today&time=evening
//              &sort=nearest&f=open_now&f=kids&min=3&max=10&tab=barbers&view=map
//
// Defaults are omitted when serialising, and keys are written in a stable
// order, so equal states always produce the same URL.

import {
  SEARCH_FILTERS,
  SEARCH_SORTS,
  SEARCH_TABS,
  SEARCH_VIEWS,
  TIME_WINDOWS,
  TIME_WINDOW_RANGES,
  type SearchFilter,
  type SearchSort,
  type SearchState,
  type SearchTab,
  type SearchView,
  type SearchWhen,
  type TimeWindow,
} from "./types";

export const MAX_QUERY_LENGTH = 120;
export const MAX_PRICE = 1000;
export const DEFAULT_TIMEZONE = "Asia/Amman";

export const DEFAULT_SEARCH_STATE: Readonly<SearchState> = Object.freeze({
  q: "",
  city: "",
  area: "",
  near: false,
  when: "",
  time: "",
  sort: "recommended",
  filters: [],
  priceMin: null,
  priceMax: null,
  tab: "shops",
  view: "list",
}) as Readonly<SearchState>;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ParamSource =
  | URLSearchParams
  | { get(name: string): string | null; getAll(name: string): string[] }
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function readAll(src: ParamSource, key: string): string[] {
  if (!src) return [];
  if (typeof (src as URLSearchParams).getAll === "function") {
    return (src as URLSearchParams).getAll(key);
  }
  const v = (src as Record<string, string | string[] | undefined>)[key];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function readOne(src: ParamSource, key: string): string {
  const all = readAll(src, key);
  return (all[0] ?? "").trim();
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** A real calendar date (rejects 2026-02-31). */
export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseWhen(value: string): SearchWhen {
  const v = value.toLowerCase();
  if (v === "now" || v === "today" || v === "tomorrow") return v;
  if (isIsoDate(v)) return v as SearchWhen;
  return "";
}

function parsePrice(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n * 1000) / 1000, MAX_PRICE);
}

function parseSlug(value: string): string {
  const v = value.toLowerCase();
  return v.length <= 64 && SLUG_RE.test(v) ? v : "";
}

/** Filters from `f`, `f[]` (repeated or comma-separated); unknown keys dropped, de-duplicated, canonical order. */
function parseFilters(src: ParamSource): SearchFilter[] {
  const raw = [...readAll(src, "f"), ...readAll(src, "f[]")]
    .flatMap((v) => v.split(","))
    .map((v) => v.trim().toLowerCase());
  const set = new Set(raw);
  let out = SEARCH_FILTERS.filter((f) => set.has(f));
  // men and women are mutually exclusive (one audience); keep the first only.
  if (out.includes("men") && out.includes("women")) out = out.filter((f) => f !== "women");
  return out;
}

export function parseSearchParams(src: ParamSource): SearchState {
  const q = readOne(src, "q").replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
  const city = parseSlug(readOne(src, "city"));
  const near = readOne(src, "near") === "1";
  let priceMin = parsePrice(readOne(src, "min"));
  let priceMax = parsePrice(readOne(src, "max"));
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }
  return {
    q,
    city,
    // An area only means something inside a city.
    area: city ? parseSlug(readOne(src, "area")) : "",
    near,
    when: parseWhen(readOne(src, "when")),
    time: oneOf<TimeWindow | "">(readOne(src, "time"), TIME_WINDOWS, ""),
    sort: oneOf<SearchSort>(readOne(src, "sort"), SEARCH_SORTS, "recommended"),
    filters: parseFilters(src),
    priceMin,
    priceMax,
    tab: oneOf<SearchTab>(readOne(src, "tab"), SEARCH_TABS, "shops"),
    view: oneOf<SearchView>(readOne(src, "view"), SEARCH_VIEWS, "list"),
  };
}

/** Query string (without "?") for a state; defaults omitted, stable key order. */
export function serializeSearchState(state: Partial<SearchState>): string {
  const s = { ...DEFAULT_SEARCH_STATE, ...state };
  const p = new URLSearchParams();
  const q = s.q.trim().slice(0, MAX_QUERY_LENGTH);
  if (q) p.set("q", q);
  if (s.near) p.set("near", "1");
  else if (s.city) {
    p.set("city", s.city);
    if (s.area) p.set("area", s.area);
  }
  if (s.when) p.set("when", s.when);
  if (s.time) p.set("time", s.time);
  if (s.sort !== "recommended") p.set("sort", s.sort);
  for (const f of SEARCH_FILTERS) if (s.filters.includes(f)) p.append("f", f);
  if (s.priceMin !== null && s.priceMin !== undefined) p.set("min", String(s.priceMin));
  if (s.priceMax !== null && s.priceMax !== undefined) p.set("max", String(s.priceMax));
  if (s.tab !== "shops") p.set("tab", s.tab);
  if (s.view !== "list") p.set("view", s.view);
  return p.toString();
}

/** `/{locale}/explore?…` for a state. */
export function searchHref(locale: string, state: Partial<SearchState> = {}): string {
  const loc = locale === "ar" ? "ar" : "en";
  const qs = serializeSearchState(state);
  return `/${loc}/explore${qs ? `?${qs}` : ""}`;
}

/** True when two states describe the same query (ignores view, which never changes results). */
export function sameQuery(a: SearchState, b: SearchState): boolean {
  const strip = (s: SearchState) => serializeSearchState({ ...s, view: "list" });
  return strip(a) === strip(b);
}

export function toggleFilter(state: SearchState, filter: SearchFilter): SearchState {
  const has = state.filters.includes(filter);
  let next = has ? state.filters.filter((f) => f !== filter) : [...state.filters, filter];
  if (!has && filter === "men") next = next.filter((f) => f !== "women");
  if (!has && filter === "women") next = next.filter((f) => f !== "men");
  return { ...state, filters: SEARCH_FILTERS.filter((f) => next.includes(f)) };
}

/** Number of active refinements shown as chips (filters + price + when/time). */
export function activeFilterCount(state: SearchState): number {
  return (
    state.filters.length +
    (state.priceMin !== null || state.priceMax !== null ? 1 : 0) +
    (state.when ? 1 : 0) +
    (state.time ? 1 : 0)
  );
}

/** "Clear all": drops filters, price and time, keeps the query, place, sort, tab and view. */
export function clearFilters(state: SearchState): SearchState {
  return { ...state, filters: [], priceMin: null, priceMax: null, when: "", time: "" };
}

// ─── Dates in the shop timezone ─────────────────────────────────────────────

/** yyyy-MM-dd and HH:MM of `now` in `timeZone`. */
export function zonedNow(now: Date, timeZone = DEFAULT_TIMEZONE): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 24 * 60);
  if (total >= 24 * 60) return "24:00";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** How far ahead "Now" looks for a free chair. */
export const NOW_WINDOW_MINUTES = 120;

export interface ResolvedWhen {
  date: string | null;
  timeFrom: string | null;
  timeTo: string | null;
}

/**
 * Turns when/time into the RPC's date + window. "now" = today, from the
 * current minute for the next two hours. A time window without a day means
 * today. Past dates collapse to "any time".
 */
export function resolveWhen(
  state: Pick<SearchState, "when" | "time">,
  now: Date = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): ResolvedWhen {
  const local = zonedNow(now, timeZone);
  let date: string | null = null;
  let timeFrom: string | null = null;
  let timeTo: string | null = null;

  if (state.when === "now") {
    return { date: local.date, timeFrom: local.time, timeTo: addMinutesToTime(local.time, NOW_WINDOW_MINUTES) };
  }
  if (state.when === "today") date = local.date;
  else if (state.when === "tomorrow") date = addDays(local.date, 1);
  else if (state.when && isIsoDate(state.when)) date = state.when < local.date ? null : state.when;

  if (state.time) {
    const range = TIME_WINDOW_RANGES[state.time];
    date = date ?? local.date;
    timeFrom = range.from;
    timeTo = range.to;
  }
  return { date, timeFrom, timeTo };
}
