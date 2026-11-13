// ═══════════════════════════════════════════════════════════════════════════
// Hijri (Umm al-Qura) dates without dependencies (WS-1F).
//
// Uses the platform's Intl "islamic-umalqura" calendar, which carries the
// official Umm al-Qura tables. Gregorian dates are plain "YYYY-MM-DD" strings
// (shop-local calendar dates, no time zone), the same shape the hours tables
// (special_hours.date, closed_periods.start_date/end_date) store.
//
//   toHijri("2027-02-08")            → { year: 1448, month: 9, day: 1 }
//   fromHijri(1448, 9, 1)            → "2027-02-08"
//   hijriMonthRange(1448, 9)         → { start: "2027-02-08", end: "2027-03-08", days: 29 }
//   resolveHijriPreset("ramadan", 1448) → { start: "2027-02-08", end: "2027-03-08", … }
//
// Announced moon sightings can shift a month by a day; the UI shows the
// resolved Gregorian dates so the owner can adjust them before saving.
// ═══════════════════════════════════════════════════════════════════════════

export interface HijriDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
}

export interface GregorianRange {
  /** First day, inclusive, YYYY-MM-DD. */
  start: string;
  /** Last day, inclusive, YYYY-MM-DD. */
  end: string;
  /** Number of days, inclusive. */
  days: number;
}

export type HijriPresetId = "ramadan" | "eid_al_fitr" | "arafah" | "eid_al_adha" | "islamic_new_year" | "mawlid";

export interface HijriPreset {
  id: HijriPresetId;
  /** Hijri month and first day of the range. */
  month: number;
  day: number;
  /** Length in days; null = to the end of the month. */
  length: number | null;
  /** What the preset usually means for a barbershop. */
  kind: "special_hours" | "closure";
}

export const HIJRI_PRESETS: readonly HijriPreset[] = [
  { id: "ramadan", month: 9, day: 1, length: null, kind: "special_hours" },
  { id: "eid_al_fitr", month: 10, day: 1, length: 3, kind: "closure" },
  { id: "arafah", month: 12, day: 9, length: 1, kind: "special_hours" },
  { id: "eid_al_adha", month: 12, day: 10, length: 4, kind: "closure" },
  { id: "islamic_new_year", month: 1, day: 1, length: 1, kind: "closure" },
  { id: "mawlid", month: 3, day: 12, length: 1, kind: "closure" },
];

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

let partsFormatter: Intl.DateTimeFormat | null = null;
function hijriParts(): Intl.DateTimeFormat {
  if (!partsFormatter) {
    partsFormatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return partsFormatter;
}

/** True when the runtime's Intl knows the Umm al-Qura calendar. */
export function isHijriSupported(): boolean {
  try {
    const opts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura").resolvedOptions();
    return opts.calendar === "islamic-umalqura";
  } catch {
    return false;
  }
}

function parseIso(iso: string): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new RangeError(`Invalid date: ${iso}`);
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(t)) throw new RangeError(`Invalid date: ${iso}`);
  return t;
}

/** UTC epoch ms → "YYYY-MM-DD". */
function toIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" ± n days. */
export function addDaysIso(iso: string, days: number): string {
  return toIso(parseIso(iso) + days * DAY_MS);
}

/** Inclusive day count between two YYYY-MM-DD dates (end ≥ start). */
export function daysBetweenInclusive(start: string, end: string): number {
  return Math.round((parseIso(end) - parseIso(start)) / DAY_MS) + 1;
}

/** Gregorian "YYYY-MM-DD" (or a Date, read as its UTC calendar day) → Hijri. */
export function toHijri(date: string | Date): HijriDate {
  const t = typeof date === "string" ? parseIso(date) : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const parts = hijriParts().formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  // Some engines expose the year as "relatedYear"/"year"; both are numeric here.
  const year = get("year");
  return { year, month: get("month"), day: get("day") };
}

function compareHijri(a: HijriDate, b: HijriDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/**
 * Approximate Gregorian epoch ms of a Hijri date (tabular calendar). Within a
 * couple of days of Umm al-Qura, used only as the search start.
 */
function approxEpoch(h: HijriDate): number {
  // Julian day of the tabular Islamic calendar.
  const jd =
    h.day +
    Math.ceil(29.5 * (h.month - 1)) +
    (h.year - 1) * 354 +
    Math.floor((3 + 11 * h.year) / 30) +
    1948439.5 -
    1;
  return (jd - 2440587.5) * DAY_MS;
}

/**
 * Hijri → Gregorian "YYYY-MM-DD", or null when that day does not exist in
 * Umm al-Qura (e.g. day 30 of a 29-day month) or the input is out of range.
 */
export function fromHijri(year: number, month: number, day: number): string | null {
  if (![year, month, day].every(Number.isInteger) || month < 1 || month > 12 || day < 1 || day > 30 || year < 1300 || year > 1600) {
    return null;
  }
  const target = { year, month, day };
  let t = Date.UTC(1970, 0, 1) + Math.round(approxEpoch(target) / DAY_MS) * DAY_MS;
  // Walk towards the target; Umm al-Qura is never far from the tabular estimate.
  for (let i = 0; i < 40; i++) {
    const h = toHijri(new Date(t));
    const c = compareHijri(h, target);
    if (c === 0) return toIso(t);
    if (c < 0) {
      // Before the target: if the target day does not exist (day 30 of a
      // 29-day month), the next day is already the next month.
      const next = toHijri(new Date(t + DAY_MS));
      if (compareHijri(next, target) > 0) return null;
      t += DAY_MS;
    } else {
      const prev = toHijri(new Date(t - DAY_MS));
      if (compareHijri(prev, target) < 0) return null;
      t -= DAY_MS;
    }
  }
  return null;
}

/** Number of days (29 or 30) in a Hijri month. */
export function hijriMonthLength(year: number, month: number): number {
  return fromHijri(year, month, 30) ? 30 : 29;
}

/** Gregorian range covering a whole Hijri month. */
export function hijriMonthRange(year: number, month: number): GregorianRange | null {
  const start = fromHijri(year, month, 1);
  if (!start) return null;
  const days = hijriMonthLength(year, month);
  return { start, end: addDaysIso(start, days - 1), days };
}

/** Gregorian range for a Hijri start date plus a length in days. */
export function hijriRange(year: number, month: number, day: number, length: number): GregorianRange | null {
  const start = fromHijri(year, month, day);
  if (!start || !Number.isInteger(length) || length < 1 || length > 366) return null;
  return { start, end: addDaysIso(start, length - 1), days: length };
}

export interface ResolvedHijriPreset extends GregorianRange {
  preset: HijriPreset;
  hijriYear: number;
}

/** Resolve a preset (e.g. "ramadan") for a Hijri year to Gregorian dates. */
export function resolveHijriPreset(id: HijriPresetId, hijriYear: number): ResolvedHijriPreset | null {
  const preset = HIJRI_PRESETS.find((p) => p.id === id);
  if (!preset) return null;
  const range =
    preset.length === null
      ? hijriMonthRange(hijriYear, preset.month)
      : hijriRange(hijriYear, preset.month, preset.day, preset.length);
  return range ? { ...range, preset, hijriYear } : null;
}

/**
 * The Hijri year whose occurrence of `id` is the next one on or after
 * `today` (so in Shawwal, "ramadan" resolves to next year's).
 */
export function upcomingHijriYear(id: HijriPresetId, today: string): number {
  const current = toHijri(today).year;
  const thisYear = resolveHijriPreset(id, current);
  return thisYear && thisYear.end >= today ? current : current + 1;
}

/** Every Gregorian date in an inclusive range (max 400 days). */
export function eachDateInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const n = daysBetweenInclusive(start, end);
  if (n < 1 || n > 400) return out;
  for (let i = 0; i < n; i++) out.push(addDaysIso(start, i));
  return out;
}

/**
 * Localised Hijri label: "1 Ramadan 1448 AH" / "١ رمضان ١٤٤٨ هـ".
 * `digits` follows the user's digit preference ("arab" | "latn").
 */
export function formatHijri(
  date: string | HijriDate,
  locale: "en" | "ar",
  options: { digits?: "arab" | "latn"; withYear?: boolean } = {},
): string {
  const iso = typeof date === "string" ? date : fromHijri(date.year, date.month, date.day);
  if (!iso) return "";
  const nu = options.digits ?? (locale === "ar" ? "arab" : "latn");
  const tag = locale === "ar" ? `ar-SA-u-ca-islamic-umalqura-nu-${nu}` : `en-GB-u-ca-islamic-umalqura-nu-${nu}`;
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "long",
    ...(options.withYear === false ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(new Date(parseIso(iso)));
}

/** Localised Hijri month names, index 0 = Muharram. */
export function hijriMonthNames(locale: "en" | "ar"): string[] {
  const tag = locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-GB-u-ca-islamic-umalqura";
  const fmt = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "UTC" });
  // 1447 starts 2025-06-26; sample the 15th of each month of that year.
  return Array.from({ length: 12 }, (_, i) => {
    const iso = fromHijri(1447, i + 1, 15);
    return iso ? fmt.format(new Date(parseIso(iso))) : String(i + 1);
  });
}
