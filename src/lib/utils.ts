import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════
// Locale-aware formatting
//
// App locales are "en" | "ar". Any BCP-47 string is also accepted ("en-US",
// "ar-JO", …) and normalised by its language prefix. Arabic uses the Jordan
// locale with Latin digits ("ar-JO-u-nu-latn") so prices, times and phone
// numbers stay readable and consistent with what customers type.
// All helpers are pure (no React) so they work in server components, API
// routes and tests; the useTranslation() hook exposes locale-bound versions.
// ═══════════════════════════════════════════════════════════════════════════

export type AppLocale = "en" | "ar";

/** Accepts "en" | "ar" | any BCP-47 tag; returns the app locale. */
export function normalizeLocale(locale?: string | null): AppLocale {
  return typeof locale === "string" && locale.toLowerCase().startsWith("ar") ? "ar" : "en";
}

/** Intl locale used for dates and numbers. */
export function toIntlLocale(locale?: string | null): string {
  return normalizeLocale(locale) === "ar" ? "ar-JO-u-nu-latn" : "en-GB";
}

/** Intl locale used for clock times (en → 12h "2:05 PM", ar → "2:05 م"). */
function toIntlTimeLocale(locale?: string | null): string {
  return normalizeLocale(locale) === "ar" ? "ar-JO-u-nu-latn" : "en-US";
}

const AR_CURRENCY_LABELS: Record<string, string> = {
  JOD: "د.أ",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SAR: "ر.س",
  AED: "د.إ",
  KWD: "د.ك",
  QAR: "ر.ق",
  BHD: "د.ب",
  OMR: "ر.ع",
  EGP: "ج.م",
  IQD: "د.ع",
};

const EN_CURRENCY_LABELS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const SYMBOL_PREFIX = new Set(["$", "€", "£"]);

/** Short, stable currency label: JOD → "JOD" (en) / "د.أ" (ar). */
export function currencyLabel(currency = "JOD", locale?: string | null): string {
  const code = (currency || "JOD").toUpperCase();
  if (normalizeLocale(locale) === "ar") return AR_CURRENCY_LABELS[code] ?? code;
  return EN_CURRENCY_LABELS[code] ?? code;
}

export interface FormatCurrencyOptions {
  /** Fraction digits (default 2 — matches the UI; JOD's ISO default of 3 is noisy). */
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Drop ".00" on whole amounts (e.g. "From 15 JOD"). Default false. */
  trimZeros?: boolean;
  /** Omit the currency label and return just the number. Default false. */
  hideCurrency?: boolean;
}

/**
 * Formats money as "<number> <label>":
 *   formatCurrency(1234.5)               → "1,234.50 JOD"
 *   formatCurrency(1234.5, "ar")         → "1,234.50 د.أ"
 *   formatCurrency(10, "en", "USD")      → "$10.00"
 * The amount/label order is the same in both directions; in RTL the bidi
 * algorithm places the label on the inline-end side of the number.
 * Non-finite input renders as 0.
 */
export function formatCurrency(
  amount: number,
  locale: string = "en",
  currency: string = "JOD",
  options: FormatCurrencyOptions = {},
): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const isWhole = Number.isInteger(value);
  const min = options.trimZeros && isWhole ? 0 : (options.minimumFractionDigits ?? 2);
  const max = Math.max(min, options.maximumFractionDigits ?? 2);
  const number = new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(value);
  if (options.hideCurrency) return number;
  const label = currencyLabel(currency, locale);
  // Symbol currencies read "$10.00" in English; codes and Arabic labels trail.
  if (normalizeLocale(locale) === "en" && SYMBOL_PREFIX.has(label)) return `${label}${number}`;
  return `${number} ${label}`;
}

/**
 * Locale-aware number formatting with grouping:
 *   formatNumber(12500)                         → "12,500"
 *   formatNumber(0.25, "en", { style: "percent" }) → "25%"
 *   formatNumber(1500, "en", { notation: "compact" }) → "1.5k"
 */
export function formatNumber(
  num: number,
  locale: string = "en",
  options: Intl.NumberFormatOptions = {},
): string {
  const value = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}

/** Compact number ("1.5k" / "1.5 ألف"). */
export function formatCompactNumber(num: number, locale: string = "en"): string {
  return formatNumber(num, locale, { notation: "compact", maximumFractionDigits: 1 });
}

/** Percentage from a ratio: formatPercent(0.256) → "26%". */
export function formatPercent(ratio: number, locale: string = "en", fractionDigits = 0): string {
  return formatNumber(ratio, locale, {
    style: "percent",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

export type DateInput = Date | string | number;

/**
 * Parses a date input. Date-only strings ("2026-11-12") are parsed as LOCAL
 * midnight — `new Date("2026-11-12")` would be UTC midnight and show the
 * previous day west of UTC. Returns null for invalid input.
 */
export function parseDateInput(input: DateInput | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Named date presets (en / ar examples for Thu 12 Nov 2026):
 *   short       12/11/2026        | 12/11/2026
 *   medium      12 Nov 2026       | 12 تشرين الثاني 2026
 *   long        Thursday, 12 November 2026 | الخميس، 12 تشرين الثاني 2026
 *   dayMonth    12 Nov            | 12 تشرين الثاني
 *   weekdayDay  Thu 12 Nov        | الخميس 12 تشرين الثاني
 *   weekday     Thursday          | الخميس
 *   weekdayShort Thu              | الخميس
 *   monthYear   November 2026     | تشرين الثاني 2026
 *   dateTime    12 Nov 2026, 2:05 pm | 12 تشرين الثاني 2026، 2:05 م
 */
export type DatePreset =
  | "short"
  | "medium"
  | "long"
  | "dayMonth"
  | "weekdayDay"
  | "weekday"
  | "weekdayShort"
  | "monthYear"
  | "dateTime";

const DATE_PRESETS: Record<DatePreset, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  dayMonth: { day: "numeric", month: "short" },
  weekdayDay: { weekday: "short", day: "numeric", month: "short" },
  weekday: { weekday: "long" },
  weekdayShort: { weekday: "short" },
  monthYear: { month: "long", year: "numeric" },
  dateTime: { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
};

/**
 * Formats a date with a preset or raw Intl options. Pass `timeZone` in the
 * options to render in the shop's zone (e.g. "Asia/Amman"). Invalid input
 * returns "" so a bad row never crashes a page.
 */
export function formatDate(
  date: DateInput | null | undefined,
  locale: string = "en",
  format: DatePreset | Intl.DateTimeFormatOptions = "medium",
): string {
  const d = parseDateInput(date);
  if (!d) return "";
  const options = typeof format === "string" ? DATE_PRESETS[format] : format;
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(d);
}

/**
 * Formats a clock time. Accepts a Date/ISO string/timestamp or a bare
 * "HH:mm" / "HH:mm:ss" string (as stored in Postgres `time` columns):
 *   formatTime("14:05")        → "2:05 PM"
 *   formatTime("14:05", "ar")  → "2:05 م"
 *   formatTime(d, "en", { hour12: false }) → "14:05"
 */
export function formatTime(
  time: DateInput | null | undefined,
  locale: string = "en",
  options: Intl.DateTimeFormatOptions = {},
): string {
  let d: Date | null;
  if (typeof time === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
    const [h, m, s] = time.split(":").map(Number);
    d = new Date(2000, 0, 1, h, m, s || 0);
  } else {
    d = parseDateInput(time);
  }
  if (!d) return "";
  return new Intl.DateTimeFormat(toIntlTimeLocale(locale), {
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(d);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/**
 * Relative time from `now`: "5 minutes ago" / "قبل 5 دقائق", "tomorrow" /
 * "غدًا", "in 3 days". Under 45 seconds renders as "now" / "الآن".
 */
export function formatRelative(
  date: DateInput | null | undefined,
  locale: string = "en",
  now: DateInput = new Date(),
): string {
  const d = parseDateInput(date);
  const n = parseDateInput(now) ?? new Date();
  if (!d) return "";
  const diffSeconds = (d.getTime() - n.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: "auto" });
  if (Math.abs(diffSeconds) < 45) return rtf.format(0, "second");
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return rtf.format(0, "second");
}

/** Duration in minutes → "45 min" / "1 h 30 min" ("45 دقيقة" / "1 ساعة 30 دقيقة"). */
export function formatDuration(minutes: number, locale: string = "en"): string {
  const total = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const ar = normalizeLocale(locale) === "ar";
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hLabel = ar ? "ساعة" : "h";
  const mLabel = ar ? "دقيقة" : "min";
  if (h === 0) return `${m} ${mLabel}`;
  if (m === 0) return `${h} ${hLabel}`;
  return `${h} ${hLabel} ${m} ${mLabel}`;
}

// ═══════════════════════════════════════════════════════════════════════════

export function getInitials(name: string): string {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Time-of-day bucket for greetings. Prefer this + translated strings
 * (t.topbar.goodMorning / goodAfternoon / goodEvening) in UI.
 */
export function getDayPeriod(date: Date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** @deprecated English-only. Use getDayPeriod() with t.topbar.good* keys. */
export function getGreeting(): string {
  const period = getDayPeriod();
  if (period === "morning") return "Good morning";
  if (period === "afternoon") return "Good afternoon";
  return "Good evening";
}
