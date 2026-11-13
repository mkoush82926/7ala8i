// ═══════════════════════════════════════════════════════════════════════════
// Marketplace formatting (WS-P0): money in JOD, digit locale, ranges.
//
//   formatJOD(7.5, "ar")                      → "٧٫٥٠٠ د.أ"
//   formatJOD(7.5, "en")                      → "7.500 JD"
//   formatJOD(7.6, { locale: "en", rounding: 0.25 }) → "7.500 JD"
//   formatJOD(5, { locale: "en", trimZeros: true })  → "5 JD"
//   formatJOD(7.5, { locale: "ar", digits: "latn" }) → "7.500 د.أ"
//
// Digits follow the user's preference (profiles.digit_preference):
//   "auto" → Arabic-Indic in Arabic, Latin in English; "arab" / "latn" force one.
//
// Pure functions (no React, no DOM) so they run in server components, route
// handlers and tests. Existing UI that uses formatCurrency() from utils.ts is
// unchanged; new marketplace surfaces use formatJOD().
// ═══════════════════════════════════════════════════════════════════════════

export type FormatLocale = "en" | "ar";
export type DigitPreference = "auto" | "arab" | "latn";
export type NumberingSystem = "arab" | "latn";

/** Cookie a client may set to remember the digit preference for signed-out visitors. */
export const DIGIT_PREFERENCE_COOKIE = "halaqy_digits";

export const DIGIT_PREFERENCES: readonly DigitPreference[] = ["auto", "arab", "latn"];

/** Middle dot used by MetaLine and the "N services · from X" summaries. */
export const META_SEPARATOR = "·";

export function toFormatLocale(locale?: string | null): FormatLocale {
  return typeof locale === "string" && locale.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function parseDigitPreference(value: unknown): DigitPreference {
  return typeof value === "string" && (DIGIT_PREFERENCES as readonly string[]).includes(value)
    ? (value as DigitPreference)
    : "auto";
}

/** Reads the digit preference from a `document.cookie` / Cookie header string. */
export function readDigitPreferenceCookie(cookieHeader?: string | null): DigitPreference {
  if (!cookieHeader) return "auto";
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === DIGIT_PREFERENCE_COOKIE) return parseDigitPreference(decodeURIComponent(v.join("=")));
  }
  return "auto";
}

export function resolveNumberingSystem(locale?: string | null, pref: DigitPreference = "auto"): NumberingSystem {
  if (pref === "arab" || pref === "latn") return pref;
  return toFormatLocale(locale) === "ar" ? "arab" : "latn";
}

/** BCP-47 tag for Intl number formatting with the resolved numbering system. */
export function numberIntlLocale(locale?: string | null, pref: DigitPreference = "auto"): string {
  const nu = resolveNumberingSystem(locale, pref);
  return toFormatLocale(locale) === "ar" ? `ar-JO-u-nu-${nu}` : `en-GB-u-nu-${nu}`;
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** "١٢:٣٠" / "۱۲" → "12:30" / "12" (also maps ٫ ٬ to . ,). Use before parsing user input. */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹٫٬]/g, (ch) => {
    if (ch === "٫") return ".";
    if (ch === "٬") return ",";
    const a = ARABIC_INDIC.indexOf(ch);
    return String(a >= 0 ? a : PERSIAN.indexOf(ch));
  });
}

/** "12:30" → "١٢:٣٠". Only digits change; separators are left alone. */
export function toArabicDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

/** Re-renders the digits inside an already formatted string per locale + preference. */
export function localizeDigits(input: string, locale?: string | null, pref: DigitPreference = "auto"): string {
  return resolveNumberingSystem(locale, pref) === "arab" ? toArabicDigits(input) : toLatinDigits(input);
}

/** Number with grouping in the resolved digit system. */
export function formatLocalizedNumber(
  value: number,
  locale?: string | null,
  pref: DigitPreference = "auto",
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(numberIntlLocale(locale, pref), options).format(Number.isFinite(value) ? value : 0);
}

// ─── Money ───

/** Cash rounding increment in JD (0.25 / 0.5 …); null/0/"none" = exact fils. */
export type CashRounding = number | "none" | null | undefined;

/** Rounds to whole fils (0.001), then to the cash increment if one is set. */
export function roundJOD(amount: number, rounding?: CashRounding): number {
  const value = Number.isFinite(amount) ? amount : 0;
  const fils = Math.round((value + Number.EPSILON * Math.sign(value)) * 1000) / 1000;
  if (typeof rounding !== "number" || !(rounding > 0)) return fils;
  const steps = Math.round((fils + Number.EPSILON * Math.sign(fils)) / rounding);
  return Math.round(steps * rounding * 1000) / 1000;
}

export const JOD_LABELS: Record<FormatLocale, string> = { en: "JD", ar: "د.أ" };

export interface FormatJODOptions {
  locale?: string | null;
  /** Digit preference (default "auto"). */
  digits?: DigitPreference;
  /** Shop cash rounding (e.g. 0.25 / 0.5). Default: exact fils. */
  rounding?: CashRounding;
  /** "5 JD" instead of "5.000 JD" for whole amounts (summaries, "from" prices). */
  trimZeros?: boolean;
  /** Number only, no "JD" / "د.أ". */
  hideCurrency?: boolean;
}

/**
 * JOD amount: 3-decimal fils, locale label and digits.
 * Accepts a locale string or an options object as the second argument.
 */
export function formatJOD(amount: number, localeOrOptions?: string | null | FormatJODOptions, maybeOptions: FormatJODOptions = {}): string {
  const options: FormatJODOptions =
    typeof localeOrOptions === "object" && localeOrOptions !== null
      ? localeOrOptions
      : { ...maybeOptions, locale: localeOrOptions ?? maybeOptions.locale };
  const locale = toFormatLocale(options.locale);
  const value = roundJOD(amount, options.rounding);
  const whole = Number.isInteger(value);
  const digitsAfter = options.trimZeros && whole ? 0 : 3;
  const number = formatLocalizedNumber(value, locale, options.digits ?? "auto", {
    minimumFractionDigits: digitsAfter,
    maximumFractionDigits: digitsAfter,
  });
  if (options.hideCurrency) return number;
  return `${number} ${JOD_LABELS[locale]}`;
}

/** "5–8 JD" (same label once); collapses to formatJOD when min === max. */
export function formatJODRange(min: number, max: number, options: FormatJODOptions = {}): string {
  const lo = roundJOD(Math.min(min, max), options.rounding);
  const hi = roundJOD(Math.max(min, max), options.rounding);
  if (lo === hi) return formatJOD(lo, options);
  const a = formatJOD(lo, { ...options, hideCurrency: true });
  const b = formatJOD(hi, { ...options, hideCurrency: true });
  const range = `${a}–${b}`;
  return options.hideCurrency ? range : `${range} ${JOD_LABELS[toFormatLocale(options.locale)]}`;
}

/** "30–45 min" / "٣٠–٤٥ د" — single value when min === max. */
export function formatMinutesRange(
  min: number,
  max?: number | null,
  locale?: string | null,
  pref: DigitPreference = "auto",
): string {
  const lo = Math.max(0, Math.round(min));
  const hi = max == null ? lo : Math.max(lo, Math.round(max));
  const nf = new Intl.NumberFormat(numberIntlLocale(locale, pref), {
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
  });
  if (lo === hi) return nf.format(lo);
  const withRange = nf as Intl.NumberFormat & { formatRange?: (a: number, b: number) => string };
  if (typeof withRange.formatRange === "function") return withRange.formatRange(lo, hi);
  return `${formatLocalizedNumber(lo, locale, pref)}–${nf.format(hi)}`;
}

/** Joins non-empty parts with the house middle dot: "4.9 (312) · Khalda". */
export function joinMeta(parts: ReadonlyArray<string | number | null | undefined | false>): string {
  return parts
    .filter((p): p is string | number => p !== null && p !== undefined && p !== false && String(p).trim() !== "")
    .map(String)
    .join(` ${META_SEPARATOR} `);
}
