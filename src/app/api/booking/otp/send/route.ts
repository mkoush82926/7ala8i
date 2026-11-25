import { NextResponse } from "next/server";
import { apiErrorCode, apiValidationError, serverError } from "@/lib/api-helpers";
import { getClientIp, rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { publicBookingSecurity, readOtpEnv } from "@/lib/otp/config";
import { nationalKey, toJordanMobile } from "@/lib/otp/phone";
import { sendOtpMessage } from "@/lib/otp/providers";
import { verifyCaptcha } from "@/lib/otp/turnstile";
import { otpStore } from "@/lib/otp/admin";
import { OtpSendSchema } from "../../schema";
import { bookingError } from "../../errors";

export const runtime = "nodejs";

/**
 * POST /api/booking/otp/send { phone, locale?, captchaToken? }
 * Self-hosted OTP ("hook" mode only). Issues a code in phone_verifications
 * and delivers it through the configured provider (Unifonic / WhatsApp).
 * Limits: per IP (otpIp), per phone (otpPhone) and 3 codes / 10 min in SQL.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipRl = await rateLimit(rateLimitKey("otp", "ip", ip), RATE_LIMITS.otpIp.max, RATE_LIMITS.otpIp.windowSec);
  if (!ipRl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: ipRl.retryAfter });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }
  const parsed = OtpSendSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { phone, locale, captchaToken } = parsed.data;

  const env = readOtpEnv();
  const security = publicBookingSecurity(env);
  if (security.otpMode !== "hook") return bookingError("OTP_UNAVAILABLE");
  // Codes go to Jordanian mobiles only (SMS pumping guard; the SQL agrees).
  if (!toJordanMobile(phone)) return bookingError("PHONE_NOT_SUPPORTED");

  const phoneRl = await rateLimit(
    rateLimitKey("otp", "phone", nationalKey(phone)),
    RATE_LIMITS.otpPhone.max,
    RATE_LIMITS.otpPhone.windowSec,
  );
  if (!phoneRl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: phoneRl.retryAfter });

  try {
    if (security.turnstileSiteKey) {
      const captcha = await verifyCaptcha(captchaToken, ip, env);
      if (!captcha.ok) return bookingError("CAPTCHA_FAILED");
    }

    const store = otpStore(env);
    if (!store) return bookingError("OTP_UNAVAILABLE");
    const issued = await store.issue(phone);
    if (!issued.ok) {
      if (issued.code === "RATE_LIMITED") return apiErrorCode("RATE_LIMITED", { retryAfter: 600 });
      if (issued.code === "INVALID_INPUT") return apiErrorCode("VALIDATION_FAILED");
      return bookingError("OTP_UNAVAILABLE");
    }

    const sent = await sendOtpMessage({ phone, code: issued.code, locale }, env);
    if (!sent.ok) return bookingError(sent.reason === "INVALID_PHONE" ? "OTP_SEND_FAILED" : "OTP_UNAVAILABLE");

    return NextResponse.json(
      { success: true, channel: security.otpChannel, resendAfter: 60 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return serverError("booking.otp.send", err);
  }
}
