// ─────────────────────────────────────────────────────────────────────────
// Post-auth redirect sanitising — the ONLY place that decides whether a
// user-supplied `?next=` value may be followed. Used by the login action,
// the auth callback route and the signup page.
//
// Only same-origin, root-relative paths are accepted. Everything else
// (absolute URLs, protocol-relative "//evil.com", "/\evil.com", userinfo
// tricks like "@evil.com", control characters that the URL parser strips)
// falls back to the default.
// ─────────────────────────────────────────────────────────────────────────

export const AUTH_LOCALES = ["en", "ar"] as const;
export type AuthLocale = (typeof AUTH_LOCALES)[number];

const PROBE_ORIGIN = "http://next.invalid";
const MAX_NEXT_LENGTH = 1024;

export function normalizeAuthLocale(value: unknown): AuthLocale {
  return value === "ar" ? "ar" : "en";
}

/**
 * Returns a safe root-relative path ("/x?y#z") or `fallback`.
 *   safeNextPath("/join?token=a") → "/join?token=a"
 *   safeNextPath("//evil.com")    → "/"
 *   safeNextPath("https://x.y")   → "/"
 */
export function safeNextPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value || value.length > MAX_NEXT_LENGTH) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return fallback;

  try {
    const url = new URL(value, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

/** Prefixes a safe path with the locale unless it already carries one. */
export function localizePath(path: string, locale: AuthLocale): string {
  if (/^\/(en|ar)(?=[/?#]|$)/.test(path)) return path;
  if (path === "/") return `/${locale}`;
  if (path.startsWith("/?") || path.startsWith("/#")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/** safeNextPath + localizePath in one step. */
export function resolveNext(raw: unknown, locale: AuthLocale, fallback = "/"): string {
  return localizePath(safeNextPath(raw, fallback), locale);
}

/** True when the (sanitised) next path points at the team-invite flow. */
export function isInviteNext(raw: unknown): boolean {
  const path = safeNextPath(raw, "");
  return /^(\/(en|ar))?\/join(?=[/?#]|$)/.test(path);
}
