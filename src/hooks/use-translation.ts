"use client";

import { useParams } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import type { TranslationKeys } from "@/i18n/en";

const translations: Record<string, TranslationKeys> = { en, ar };

// ── Font constants ─────────────────────────────────────────────────────────
// EN: Plus Jakarta Sans (Styrene-like — clean, geometric, premium)
// AR: Tajawal (light, clean, designed for Arabic readability)
export const FONT_EN = "var(--font-jakarta),'Segoe UI',system-ui,sans-serif";
export const FONT_AR = "var(--font-tajawal),'Segoe UI',Tahoma,Arial,sans-serif";

/**
 * useTranslation — one-liner for translations + direction + font.
 *
 * Usage:
 *   const { t, dir, isRTL, FF } = useTranslation();
 *   <div style={{ fontFamily: FF, direction: dir }}>
 *     <h1>{t.landing.heroTitle}</h1>
 *   </div>
 */
export function useTranslation() {
  const params = useParams();
  const localeParam = params?.locale as string;
  console.log('useTranslation -> params:', params, 'localeParam:', localeParam);
  const locale = localeParam === "ar" ? "ar" : "en";
  const direction = locale === "ar" ? "rtl" : "ltr";
  const t = translations[locale] || en;
  return {
    t,
    locale,
    dir: direction as "ltr" | "rtl",
    isRTL: direction === "rtl",
    /** Font family string for inline styles */
    FF: locale === "ar" ? FONT_AR : FONT_EN,
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
