// ═══════════════════════════════════════════════════════
// WS-1J · Customer phone login helpers (browser-safe).
//
// The OTP flag comes from 1D (@/lib/otp: NEXT_PUBLIC_OTP_MODE):
//   off      → phone login is hidden; email login stays the only way in.
//   supabase → Supabase phone auth (signInWithOtp / verifyOtp) in the browser.
//   hook     → /api/booking/otp/send + /verify issue a single-use token; a
//              server action exchanges it for a session (./phone-login).
// ═══════════════════════════════════════════════════════
import type { OtpMode } from "@/lib/otp/config";

export type PhoneLoginStep = "phone" | "code" | "done";

export const PHONE_LOGIN_ERROR_CODES = [
  "INVALID_PHONE",
  "INVALID_NAME",
  "TERMS_REQUIRED",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_TOO_MANY_ATTEMPTS",
  "OTP_UNAVAILABLE",
  "OTP_SEND_FAILED",
  "CAPTCHA_FAILED",
  "RATE_LIMITED",
  "NOT_CUSTOMER",
  "LOGIN_FAILED",
] as const;
export type PhoneLoginErrorCode = (typeof PHONE_LOGIN_ERROR_CODES)[number];

export function toPhoneLoginError(code: unknown): PhoneLoginErrorCode {
  return typeof code === "string" && (PHONE_LOGIN_ERROR_CODES as readonly string[]).includes(code)
    ? (code as PhoneLoginErrorCode)
    : "LOGIN_FAILED";
}

/** Phone login is offered only when an OTP mode is configured. */
export function phoneLoginEnabled(mode: OtpMode): boolean {
  return mode === "supabase" || mode === "hook";
}

/** 2–80 characters after collapsing whitespace. */
export function normalizeFullName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 80 ? name : null;
}

/** Six digits, accepting Arabic-Indic / Persian digits typed on Arabic keyboards. */
export function normalizeOtpCode(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .slice(0, 6);
}

/**
 * Only same-site, locale-prefixed paths are honoured as a post-login
 * destination; anything else (absolute URLs, protocol-relative, staff pages)
 * falls back to the customer portal.
 */
export function safeCustomerNext(next: string | null | undefined, locale: "en" | "ar"): string {
  const fallback = `/${locale}/customer`;
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  let path = next;
  if (!/^\/(en|ar)(\/|$)/.test(path)) path = `/${locale}${path === "/" ? "" : path}`;
  const bare = path.replace(/^\/(en|ar)/, "") || "/";
  const allowed = ["/customer", "/book", "/shop", "/barber", "/b", "/explore"];
  return allowed.some((r) => bare === r || bare.startsWith(`${r}/`) || bare.startsWith(`${r}?`)) ? path : fallback;
}
