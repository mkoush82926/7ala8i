import type { TranslationKeys } from "@/i18n/en";

type Dict = TranslationKeys;

/**
 * Translated text for a stable error code: t.error.codes[code] ?? t.error.message.
 * (Typed loosely so it compiles before/after the shared `error.codes` keys land.)
 */
export function errorText(t: Dict, code: string | null | undefined): string {
  const codes = (t.error as unknown as { codes?: Record<string, string> }).codes;
  return (code && codes?.[code]) || t.error.message;
}
