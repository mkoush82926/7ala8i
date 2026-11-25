"use server";

// WS-1J · Server side of the self-hosted ("hook") phone login. The browser
// already proved the phone with /api/booking/otp/send + /verify and holds a
// single-use token; this exchanges it for a session cookie.

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { publicBookingSecurity, readOtpEnv } from "@/lib/otp/config";
import { nationalKey } from "@/lib/otp/phone";
import { completePhoneLogin, phoneLoginAdmin } from "@/lib/privacy/phone-login";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy/account";
import { safeCustomerNext, toPhoneLoginError, type PhoneLoginErrorCode } from "@/lib/privacy/login";

export interface PhoneLoginActionInput {
  phone: string;
  token: string;
  fullName?: string | null;
  acceptTerms?: boolean;
  next?: string | null;
  locale?: string;
}

export type PhoneLoginActionResult =
  | { ok: true; redirectTo: string; isNew: boolean; linked: number }
  | { ok: false; code: PhoneLoginErrorCode };

export async function phoneLoginAction(input: PhoneLoginActionInput): Promise<PhoneLoginActionResult> {
  const locale = input?.locale === "ar" ? "ar" : "en";
  try {
    if (publicBookingSecurity(readOtpEnv()).otpMode !== "hook") return { ok: false, code: "OTP_UNAVAILABLE" };
    if (typeof input?.phone !== "string" || typeof input?.token !== "string") return { ok: false, code: "INVALID_PHONE" };
    // Checked before the token is consumed, so a missed tick never wastes a code.
    if (input.acceptTerms !== true) return { ok: false, code: "TERMS_REQUIRED" };

    const ip = getClientIp(new Request("http://localhost/", { headers: await headers() }));
    const ipRl = await rateLimit(rateLimitKey("customer-login", "ip", ip), RATE_LIMITS.otpIp.max, RATE_LIMITS.otpIp.windowSec);
    if (!ipRl.success) return { ok: false, code: "RATE_LIMITED" };
    const phoneRl = await rateLimit(rateLimitKey("customer-login", "phone", nationalKey(input.phone)), 10, 3600);
    if (!phoneRl.success) return { ok: false, code: "RATE_LIMITED" };

    const admin = phoneLoginAdmin();
    if (!admin) return { ok: false, code: "OTP_UNAVAILABLE" };

    const result = await completePhoneLogin(admin, {
      phone: input.phone,
      token: input.token,
      fullName: input.fullName ?? null,
    });
    if (!result.ok) return result;

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: result.tokenHash });
    if (error) return { ok: false, code: "LOGIN_FAILED" };

    if (result.isNew) {
      // Consent records are best-effort: a failure must not block sign-in.
      const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<unknown> };
      await Promise.allSettled([
        db.rpc("record_consent", { p_purpose: "terms", p_granted: true, p_source: "phone_login", p_policy_version: PRIVACY_POLICY_VERSION }),
        db.rpc("record_consent", { p_purpose: "privacy", p_granted: true, p_source: "phone_login", p_policy_version: PRIVACY_POLICY_VERSION }),
      ]);
    }

    // New accounts finish their profile (name, language, reminders) first.
    const redirectTo = result.isNew ? `/${locale}/customer/account?welcome=1` : safeCustomerNext(input.next ?? null, locale);
    return { ok: true, redirectTo, isNew: result.isNew, linked: result.linked };
  } catch {
    return { ok: false, code: toPhoneLoginError(null) };
  }
}
