import { NextResponse } from "next/server";
import { apiErrorCode, apiValidationError, serverError } from "@/lib/api-helpers";
import { getClientIp, rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { publicBookingSecurity, readOtpEnv } from "@/lib/otp/config";
import { otpStore } from "@/lib/otp/admin";
import { OtpVerifySchema } from "../../schema";
import { bookingError } from "../../errors";

export const runtime = "nodejs";

/**
 * POST /api/booking/otp/verify { phone, code } → { success, token, expiresAt }
 * The token is single-use: create_public_booking consumes it (p_otp_token)
 * inside the booking transaction. 5 wrong codes lock the code (SQL side).
 */
export async function POST(req: Request) {
  const rl = await rateLimit(rateLimitKey("otp-verify", getClientIp(req)), 30, 600);
  if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }
  const parsed = OtpVerifySchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const env = readOtpEnv();
  if (publicBookingSecurity(env).otpMode !== "hook") return bookingError("OTP_UNAVAILABLE");

  try {
    const store = otpStore(env);
    if (!store) return bookingError("OTP_UNAVAILABLE");
    const result = await store.verify(parsed.data.phone, parsed.data.code);
    if (!result.ok) return result.code === "INTERNAL" ? bookingError("OTP_UNAVAILABLE") : bookingError(result.code);
    return NextResponse.json(
      { success: true, token: result.token, expiresAt: result.expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return serverError("booking.otp.verify", err);
  }
}
