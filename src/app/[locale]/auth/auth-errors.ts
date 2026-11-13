// Maps Supabase Auth errors to stable, client-safe keys. Pages render
// t.auth.errors[key]; raw Supabase messages are never shown (they are English
// only and some of them enable account enumeration).

export const AUTH_ERROR_KEYS = [
  "invalidCredentials",
  "emailNotConfirmed",
  "rateLimited",
  "weakPassword",
  "invalidEmail",
  "samePassword",
  "signupDisabled",
  "missingFields",
  "linkExpired",
  "generic",
] as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

interface AuthErrorLike {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  name?: unknown;
}

export function isAuthErrorKey(value: unknown): value is AuthErrorKey {
  return typeof value === "string" && (AUTH_ERROR_KEYS as readonly string[]).includes(value);
}

export function authErrorKey(err: unknown): AuthErrorKey {
  if (!err || typeof err !== "object") return "generic";
  const e = err as AuthErrorLike;
  const code = typeof e.code === "string" ? e.code : "";
  const status = typeof e.status === "number" ? e.status : 0;
  const message = typeof e.message === "string" ? e.message.toLowerCase() : "";

  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "rateLimited";
    case "weak_password":
      return "weakPassword";
    case "email_address_invalid":
    case "validation_failed":
      return "invalidEmail";
    case "same_password":
      return "samePassword";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signupDisabled";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return "linkExpired";
    // Do not reveal whether an address is registered.
    case "user_already_exists":
    case "email_exists":
      return "generic";
  }

  if (status === 429 || message.includes("rate limit")) return "rateLimited";
  if (message.includes("invalid login credentials")) return "invalidCredentials";
  if (message.includes("email not confirmed")) return "emailNotConfirmed";
  if (message.includes("password should")) return "weakPassword";
  if (message.includes("different from the old password")) return "samePassword";
  return "generic";
}

// ─── Client-side field checks (mirrors the server rules) ───

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return PHONE_RE.test(value.trim()) && digits.length >= 7 && digits.length <= 15;
}

/** 0 (empty) … 4 (strong). */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length < MIN_PASSWORD_LENGTH) score = Math.min(score, 1);
  return Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
}
