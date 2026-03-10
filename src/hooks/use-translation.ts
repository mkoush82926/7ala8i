import { useThemeStore } from "@/store/theme-store";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import type { TranslationKeys } from "@/i18n/en";

const translations: Record<string, TranslationKeys> = { en, ar };

/**
 * Hook to get the current translation object based on locale.
 * Usage:
 *   const t = useTranslation();
 *   t.sidebar.dashboard → "Dashboard" | "لوحة التحكم"
 */
export function useTranslation(): TranslationKeys {
    const locale = useThemeStore((s) => s.locale);
    return translations[locale] || en;
}

/**
 * Simple template interpolation for strings with {variable} placeholders.
 * Usage:
 *   interpolate("Hello {name}", { name: "Ahmad" }) → "Hello Ahmad"
 */
export function interpolate(
    template: string,
    vars: Record<string, string | number>
): string {
    return template.replace(/\{(\w+)\}/g, (_, key) =>
        vars[key] !== undefined ? String(vars[key]) : `{${key}}`
    );
}
