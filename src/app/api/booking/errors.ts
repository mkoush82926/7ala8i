import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-helpers";

/**
 * WS-1D error codes not (yet) in api-helpers' table. Same response shape as
 * apiError: { success:false, error, code }.
 */
export const BOOKING_V2_ERRORS = {
  OTP_REQUIRED: { status: 403, message: "Please verify your phone number to confirm this booking." },
  OTP_INVALID: { status: 403, message: "That code isn't right. Check it and try again." },
  OTP_EXPIRED: { status: 403, message: "This code has expired. Ask for a new one." },
  OTP_TOO_MANY_ATTEMPTS: { status: 429, message: "Too many wrong codes. Ask for a new one." },
  OTP_UNAVAILABLE: { status: 503, message: "Phone verification is not available right now." },
  OTP_SEND_FAILED: { status: 502, message: "We couldn't send the code. Please try again." },
  PHONE_NOT_SUPPORTED: { status: 422, message: "Phone verification works with Jordanian mobile numbers only." },
  CAPTCHA_FAILED: { status: 403, message: "Please complete the security check and try again." },
} as const;

export type BookingV2ErrorCode = keyof typeof BOOKING_V2_ERRORS;

export function isBookingV2ErrorCode(value: unknown): value is BookingV2ErrorCode {
  return typeof value === "string" && value in BOOKING_V2_ERRORS;
}

export function bookingError(code: BookingV2ErrorCode, retryAfter?: number) {
  const info = BOOKING_V2_ERRORS[code];
  const headers: Record<string, string> = {};
  const body: Record<string, unknown> = { success: false, error: info.message, code };
  if (retryAfter !== undefined) {
    body.retryAfter = Math.max(0, Math.ceil(retryAfter));
    headers["Retry-After"] = String(body.retryAfter);
  }
  return NextResponse.json(body, { status: info.status, headers });
}

/** dbErrorResponse that also knows the v2 codes raised by the RPCs. */
export function bookingDbError(context: string, err: unknown) {
  const message = (err && typeof err === "object" ? (err as { message?: unknown }).message : null) ?? "";
  const code = String(message).trim();
  if (isBookingV2ErrorCode(code)) return bookingError(code);
  return dbErrorResponse(context, err);
}
