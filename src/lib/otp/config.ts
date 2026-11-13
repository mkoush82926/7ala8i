// ═══════════════════════════════════════════════════════
// WS-1D · Phone verification (OTP) + bot protection feature flags.
//
// Everything here is OPTIONAL. With nothing configured, guest booking works
// exactly as before: per-IP and per-phone rate limits only.
//
//   NEXT_PUBLIC_OTP_MODE     off (default) | supabase | hook
//     supabase → Supabase phone auth (signInWithOtp / verifyOtp). Supabase
//                sends the code itself, or through the Send-SMS auth hook
//                (/api/booking/otp/sms-hook) for Unifonic / WhatsApp.
//     hook     → Halaqy's own route (/api/booking/otp/send + verify) with
//                phone_verifications; needs OTP_PROVIDER and the service
//                role key on the server.
//   NEXT_PUBLIC_OTP_CHANNEL  sms (default) | whatsapp
//   OTP_PROVIDER             unifonic | whatsapp | log (log = dev only)
//   UNIFONIC_APP_SID, UNIFONIC_SENDER_ID
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_OTP_TEMPLATE
//   SEND_SMS_HOOK_SECRET     "v1,whsec_…" from Supabase Auth hooks
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY
// ═══════════════════════════════════════════════════════

export type OtpMode = "off" | "supabase" | "hook";
export type OtpChannel = "sms" | "whatsapp";
export type OtpProviderName = "unifonic" | "whatsapp" | "log";

export interface OtpEnv {
  NODE_ENV?: string;
  NEXT_PUBLIC_OTP_MODE?: string;
  NEXT_PUBLIC_OTP_CHANNEL?: string;
  OTP_PROVIDER?: string;
  UNIFONIC_APP_SID?: string;
  UNIFONIC_SENDER_ID?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_OTP_TEMPLATE?: string;
  SEND_SMS_HOOK_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

/** What the booking page needs to know (safe to send to the browser). */
export interface PublicBookingSecurity {
  otpMode: OtpMode;
  otpChannel: OtpChannel;
  /** Guests must verify their phone before confirming. */
  otpRequired: boolean;
  turnstileSiteKey: string | null;
}

/** Reads the variables explicitly so Next.js can inline NEXT_PUBLIC_* ones. */
export function readOtpEnv(): OtpEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_OTP_MODE: process.env.NEXT_PUBLIC_OTP_MODE,
    NEXT_PUBLIC_OTP_CHANNEL: process.env.NEXT_PUBLIC_OTP_CHANNEL,
    OTP_PROVIDER: process.env.OTP_PROVIDER,
    UNIFONIC_APP_SID: process.env.UNIFONIC_APP_SID,
    UNIFONIC_SENDER_ID: process.env.UNIFONIC_SENDER_ID,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_OTP_TEMPLATE: process.env.WHATSAPP_OTP_TEMPLATE,
    SEND_SMS_HOOK_SECRET: process.env.SEND_SMS_HOOK_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  };
}

const clean = (v: string | undefined) => (v ?? "").trim();

export function parseOtpMode(raw: string | undefined): OtpMode {
  const v = clean(raw).toLowerCase();
  return v === "supabase" || v === "hook" ? v : "off";
}

export function parseOtpChannel(raw: string | undefined): OtpChannel {
  return clean(raw).toLowerCase() === "whatsapp" ? "whatsapp" : "sms";
}

/**
 * The provider that can actually deliver a code, or null. "log" only counts
 * outside production (it prints the code to the server console).
 */
export function resolveOtpProvider(env: OtpEnv): OtpProviderName | null {
  const name = clean(env.OTP_PROVIDER).toLowerCase();
  if (name === "unifonic") return clean(env.UNIFONIC_APP_SID) ? "unifonic" : null;
  if (name === "whatsapp") {
    return clean(env.WHATSAPP_TOKEN) && clean(env.WHATSAPP_PHONE_NUMBER_ID) && clean(env.WHATSAPP_OTP_TEMPLATE)
      ? "whatsapp"
      : null;
  }
  if (name === "log") return env.NODE_ENV === "production" ? null : "log";
  return null;
}

/**
 * Effective mode on the server. "hook" silently degrades to "off" when no
 * provider or no service role key is configured, so a half-configured
 * deployment never blocks bookings.
 */
export function effectiveOtpMode(env: OtpEnv): OtpMode {
  const mode = parseOtpMode(env.NEXT_PUBLIC_OTP_MODE);
  if (mode === "hook" && (!resolveOtpProvider(env) || !clean(env.SUPABASE_SERVICE_ROLE_KEY))) return "off";
  return mode;
}

export function turnstileSecret(env: OtpEnv): string | null {
  return clean(env.TURNSTILE_SECRET_KEY) || null;
}

/** Site key only when the server can also verify the token. */
export function turnstileSiteKey(env: OtpEnv): string | null {
  const key = clean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  return key && turnstileSecret(env) ? key : null;
}

export function publicBookingSecurity(env: OtpEnv = readOtpEnv()): PublicBookingSecurity {
  const otpMode = effectiveOtpMode(env);
  return {
    otpMode,
    otpChannel: parseOtpChannel(env.NEXT_PUBLIC_OTP_CHANNEL),
    otpRequired: otpMode !== "off",
    turnstileSiteKey: turnstileSiteKey(env),
  };
}

export const OTP_DISABLED: PublicBookingSecurity = {
  otpMode: "off",
  otpChannel: "sms",
  otpRequired: false,
  turnstileSiteKey: null,
};
