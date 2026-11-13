"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import type { TranslationKeys } from "@/i18n/en";
import {
  formatCurrency as fmtCurrency,
  formatDate as fmtDate,
  formatTime as fmtTime,
  formatNumber as fmtNumber,
  formatRelative as fmtRelative,
  formatDuration as fmtDuration,
  formatPercent as fmtPercent,
  toIntlLocale,
  type AppLocale,
  type DateInput,
  type DatePreset,
  type FormatCurrencyOptions,
} from "@/lib/utils";

const translations: Record<string, TranslationKeys> = { en, ar };

// ── Font constants — "Ink & Brass" system ──────────────────────────────────
// Body/UI text: BDO Grotesk (EN) / Cairo (AR) — clean, geometric, optimized
// for small-size legibility.
export const FONT_EN = "var(--font-bdo-grotesk),'Segoe UI',system-ui,sans-serif";
export const FONT_AR = "var(--font-cairo),'Segoe UI',Tahoma,Arial,sans-serif";

// Display/headline text: BDO Grotesk (EN) / Cairo (AR) — both scripts now use
// one grotesque sans at body and display sizes rather than a serif/sans pair.
export const FONT_EN_DISPLAY = "var(--font-bdo-grotesk),'Segoe UI',system-ui,sans-serif";
export const FONT_AR_DISPLAY = "var(--font-cairo),'Segoe UI',Tahoma,Arial,sans-serif";

/**
 * Letter-spacing for display headings. Arabic is a cursive, connected
 * script — ANY positive tracking breaks letter joins and reads as broken to
 * a native reader. Never apply a Latin tracking value to Arabic text; use
 * this helper instead of hardcoding letterSpacing on headings.
 *
 * Usage: style={{ letterSpacing: headingTracking(isRTL, "-0.02em") }}
 */
export function headingTracking(isRTL: boolean, latinValue: string): string {
  return isRTL ? "normal" : latinValue;
}

export const LOCALES = ["en", "ar"] as const;

/**
 * Prefixes an internal path with the locale so navigation skips the
 * middleware's 307 redirect and Next can prefetch it:
 *   localizeHref("/explore", "ar")     → "/ar/explore"
 *   localizeHref("/", "ar")            → "/ar"
 *   localizeHref("/en/explore", "ar")  → "/en/explore"  (already localized: untouched)
 *   localizeHref("https://x.com", "ar")→ unchanged; also "#id", "mailto:", "tel:", "//cdn"
 *   localizeHref("explore?q=1", "en")  → "/en/explore?q=1"
 */
export function localizeHref(href: string, locale: string): string {
  if (!href) return `/${locale}`;
  if (/^([a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  if (/^\/(en|ar)(?=[/?#]|$)/.test(path)) return path;
  if (path === "/") return `/${locale}`;
  if (path.startsWith("/?") || path.startsWith("/#")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/**
 * Swaps the locale of a (possibly un-prefixed) pathname, keeping the rest:
 *   switchLocalePath("/en/explore?x=1", "ar") → "/ar/explore?x=1"
 */
export function switchLocalePath(pathname: string, locale: string): string {
  const rest = (pathname || "/").replace(/^\/(en|ar)(?=[/?#]|$)/, "");
  return localizeHref(rest || "/", locale);
}

/**
 * useTranslation — one-liner for translations + direction + font +
 * locale-bound formatting and links.
 *
 * Usage:
 *   const { t, dir, isRTL, FF, FFD, href, formatCurrency, formatDate } = useTranslation();
 *   <div style={{ fontFamily: FF, direction: dir }}>
 *     <h1 style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "-0.02em") }}>
 *       {t.landing.heroTitle}
 *     </h1>
 *     <Link href={href("/explore")}>…</Link>            // → /ar/explore
 *     {formatCurrency(12.5)}                              // → "12.50 د.أ"
 *     {formatDate(apt.date, "long")} {formatTime(apt.start_time)}
 *   </div>
 *
 * All returned functions are memoised per locale, so they are safe in
 * dependency arrays.
 */
export function useTranslation() {
  const params = useParams();
  const localeParam = params?.locale as string;
  const locale: AppLocale = localeParam === "ar" ? "ar" : "en";
  const direction = locale === "ar" ? "rtl" : "ltr";
  const t = translations[locale] || en;
  const isRTL = direction === "rtl";

  const helpers = useMemo(
    () => ({
      /** Locale-prefixed internal link: href("/explore") → "/ar/explore" */
      href: (path: string) => localizeHref(path, locale),
      /** Same page in the other language: switchLocale(pathname, "en") */
      switchLocale: (pathname: string, target: AppLocale) => switchLocalePath(pathname, target),
      /** "12.50 JOD" / "12.50 د.أ" — currency defaults to JOD (pass the shop's currency) */
      formatCurrency: (amount: number, currency = "JOD", options?: FormatCurrencyOptions) =>
        fmtCurrency(amount, locale, currency, options),
      /** Preset ("medium" | "long" | "dayMonth" | …) or Intl options */
      formatDate: (date: DateInput | null | undefined, format?: DatePreset | Intl.DateTimeFormatOptions) =>
        fmtDate(date, locale, format),
      /** "2:05 PM" / "2:05 م"; accepts Date, ISO or "HH:mm" */
      formatTime: (time: DateInput | null | undefined, options?: Intl.DateTimeFormatOptions) =>
        fmtTime(time, locale, options),
      formatNumber: (num: number, options?: Intl.NumberFormatOptions) => fmtNumber(num, locale, options),
      formatPercent: (ratio: number, fractionDigits?: number) => fmtPercent(ratio, locale, fractionDigits),
      /** "5 minutes ago" / "قبل 5 دقائق" */
      formatRelative: (date: DateInput | null | undefined, now?: DateInput) =>
        fmtRelative(date, locale, now),
      /** "1 h 30 min" / "1 ساعة 30 دقيقة" */
      formatDuration: (minutes: number) => fmtDuration(minutes, locale),
    }),
    [locale],
  );

  return {
    t,
    locale,
    /** BCP-47 locale for Intl APIs: "en-GB" | "ar-JO-u-nu-latn" */
    intlLocale: toIntlLocale(locale),
    dir: direction as "ltr" | "rtl",
    isRTL,
    /** Body/UI font family string for inline styles */
    FF: isRTL ? FONT_AR : FONT_EN,
    /** Display/headline font family string — headings only */
    FFD: isRTL ? FONT_AR_DISPLAY : FONT_EN_DISPLAY,
    ...helpers,
  };
}

/**
 * Simple template interpolation for strings with {variable} placeholders.
 * Usage:
 *   interpolate("Hello {name}", { name: "Ahmad" }) → "Hello Ahmad"
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  );
}
