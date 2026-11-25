import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitKey, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { AvailabilityQuerySchema } from "@/lib/validations";
import { publicBookingSecurity, readOtpEnv } from "@/lib/otp/config";
import { samePhone } from "@/lib/otp/phone";
import { verifyCaptcha } from "@/lib/otp/turnstile";
import {
  apiErrorCode,
  apiValidationError,
  dbErrorResponse,
  serverError,
} from "@/lib/api-helpers";
import type { BookingResult } from "@/lib/supabase/database.types";
import { parseIdempotencyKey, runIdempotent } from "./idempotency";
import { callRpc, callRpcLoose } from "./rpc";
import { CreateBookingV2Schema, toRpcArgs } from "./schema";
import { bookingDbError, bookingError } from "./errors";
import { schedulePushDispatch } from "@/lib/push/kick";

// Public columns only: anon may not select("*") on shops/profiles.
const SHOP_COLUMNS = "id, name, address, currency, timezone, cancellation_policy_hours";
const SERVICE_COLUMNS = "id, name, name_ar, duration, price, sort_order";
const BARBER_COLUMNS = "id, full_name, avatar_url";

/**
 * GET /api/booking?shopId=…&date=YYYY-MM-DD[&barberId=…]
 * Public booking data for one shop. Availability comes from the
 * get_busy_slots RPC (times only, no client data).
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimit(rateLimitKey("booking-read", getClientIp(req)), 60, 60);
  if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

  const sp = req.nextUrl.searchParams;
  const parsed = AvailabilityQuerySchema.safeParse({
    shopId: sp.get("shopId") ?? undefined,
    date: sp.get("date") ?? undefined,
    barberId: sp.get("barberId") ?? undefined,
  });
  if (!parsed.success) return apiValidationError(parsed.error);
  const { shopId, date, barberId } = parsed.data;

  try {
    const supabase = await createClient();
    const [shopRes, servicesRes, barbersRes, busyRes] = await Promise.all([
      supabase.from("shops").select(SHOP_COLUMNS).eq("id", shopId).maybeSingle(),
      supabase
        .from("services")
        .select(SERVICE_COLUMNS)
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("profiles")
        .select(BARBER_COLUMNS)
        .eq("shop_id", shopId)
        .in("role", ["barber", "shop_admin"]),
      date
        ? callRpc(supabase, "get_busy_slots", { p_shop_id: shopId, p_day: date, p_barber_id: barberId ?? null })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const failed = [shopRes, servicesRes, barbersRes, busyRes].find((r) => r.error);
    if (failed?.error) return dbErrorResponse("booking.read", failed.error);
    if (!shopRes.data) return apiErrorCode("SHOP_NOT_FOUND");

    return NextResponse.json(
      {
        shop: shopRes.data,
        services: servicesRes.data ?? [],
        barbers: barbersRes.data ?? [],
        appointments: busyRes.data ?? [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return serverError("booking.read", err);
  }
}

type CreateOutcome =
  | { ok: true; booking: BookingResult }
  | { ok: false; error: unknown };

/**
 * Phone verification gate (feature-flagged; see src/lib/otp/config.ts).
 *   off      → nothing to check.
 *   hook     → a one-time token from /api/booking/otp/verify (the RPC
 *              consumes it), or a signed-in user whose phone is confirmed.
 *   supabase → a signed-in user whose confirmed phone matches.
 */
async function phoneGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mode: ReturnType<typeof publicBookingSecurity>["otpMode"],
  phone: string,
  otpToken: string | undefined,
): Promise<"ok" | "required"> {
  if (mode === "off") return "ok";
  if (mode === "hook" && otpToken) return "ok";
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user as { phone?: string | null; phone_confirmed_at?: string | null } | null | undefined;
    if (user?.phone_confirmed_at && samePhone(user.phone, phone)) return "ok";
  } catch {
    // treated as not verified
  }
  return "required";
}

/**
 * POST /api/booking — create a public booking.
 * Price, end time, service name and the barber for "any" are decided by the
 * create_public_booking RPC; the client only sends what the customer chose.
 * Send an `Idempotency-Key` header (same value on retries) to avoid duplicates.
 *
 * Body: legacy { serviceIds[] , source } or v2 { items[{serviceId, variantId?,
 * note?}], src?, entry?, otpToken?, captchaToken? } — see ./schema.ts.
 */
export async function POST(req: NextRequest) {
  // Rate limit first, before any other network call.
  const ip = getClientIp(req);
  const rl = await rateLimit(rateLimitKey("booking", ip), RATE_LIMITS.bookingIp.max, RATE_LIMITS.bookingIp.windowSec);
  if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }

  const parsed = CreateBookingV2Schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const input = parsed.data;

  const phoneRl = await rateLimit(
    rateLimitKey("booking", "phone", input.clientPhone.replace(/\D/g, "").slice(-9)),
    RATE_LIMITS.bookingPhone.max * 2,
    RATE_LIMITS.bookingPhone.windowSec,
  );
  if (!phoneRl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: phoneRl.retryAfter });

  try {
    const env = readOtpEnv();
    const security = publicBookingSecurity(env);

    if (security.turnstileSiteKey) {
      const captcha = await verifyCaptcha(input.captchaToken, ip, env);
      if (!captcha.ok) return bookingError("CAPTCHA_FAILED");
    }

    const supabase = await createClient();

    if ((await phoneGate(supabase, security.otpMode, input.clientPhone, input.otpToken)) === "required") {
      return bookingError("OTP_REQUIRED");
    }

    const args = toRpcArgs(input);
    const create = async (): Promise<CreateOutcome> => {
      const { data, error } = await callRpcLoose<BookingResult>(supabase, "create_public_booking", args);
      if (error || !data) return { ok: false, error: error ?? new Error("create_public_booking returned no data") };
      return { ok: true, booking: data };
    };

    const idemKey = parseIdempotencyKey(req.headers.get("idempotency-key"));
    const { result, replayed } = idemKey
      ? await runIdempotent(rateLimitKey("booking", ip, input.shopId, idemKey), create, (r) => r.ok)
      : { result: await create(), replayed: false };

    if (!result.ok) return bookingDbError("booking.create", result.error);
    if (!replayed) schedulePushDispatch();

    return NextResponse.json(
      { success: true, appointment_id: result.booking.appointment_id, booking: result.booking },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotent-Replayed": "true" } : undefined },
    );
  } catch (err) {
    return serverError("booking.create", err);
  }
}
