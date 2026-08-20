"use client";

import { useParams } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import type { TranslationKeys } from "@/i18n/en";

const translations: Record<string, TranslationKeys> = { en, ar };

// ── Font constants — "Ink & Brass" system ──────────────────────────────────
// Body/UI text: InterVar (EN) / Noto Sans Arabic (AR) — clean, humanist,
// optimized for small-size legibility.
export const FONT_EN = "var(--font-intervar),'Segoe UI',system-ui,sans-serif";
export const FONT_AR = "var(--font-noto-arabic),'Segoe UI',Tahoma,Arial,sans-serif";

// Display/headline text: Fraunces (EN) / Noto Naskh Arabic (AR) — both carry
// genuine typographic character (ink-trap serif / calligraphic Naskh) so
// neither script reads as the generic leftover. Use ONLY for headings, never
// body copy or dense UI.
export const FONT_EN_DISPLAY = "var(--font-fraunces),Georgia,serif";
export const FONT_AR_DISPLAY = "var(--font-naskh-arabic),'Segoe UI',Tahoma,Arial,sans-serif";

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

/**
 * useTranslation — one-liner for translations + direction + font.
 *
 * Usage:
 *   const { t, dir, isRTL, FF, FFD } = useTranslation();
 *   <div style={{ fontFamily: FF, direction: dir }}>
 *     <h1 style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "-0.02em") }}>
 *       {t.landing.heroTitle}
 *     </h1>
 *   </div>
 */
export function useTranslation() {
  const params = useParams();
  const localeParam = params?.locale as string;
  const locale = localeParam === "ar" ? "ar" : "en";
  const direction = locale === "ar" ? "rtl" : "ltr";
  const t = translations[locale] || en;
  const isRTL = direction === "rtl";
  return {
    t,
    locale,
    dir: direction as "ltr" | "rtl",
    isRTL,
    /** Body/UI font family string for inline styles */
    FF: isRTL ? FONT_AR : FONT_EN,
    /** Display/headline font family string — headings only */
    FFD: isRTL ? FONT_AR_DISPLAY : FONT_EN_DISPLAY,
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
