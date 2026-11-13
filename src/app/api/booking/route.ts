import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitKey, getClientIp } from "@/lib/rate-limit";
import { AvailabilityQuerySchema, CreateBookingSchema } from "@/lib/validations";
import {
  apiErrorCode,
  apiValidationError,
  dbErrorResponse,
  serverError,
} from "@/lib/api-helpers";
import type { BookingResult } from "@/lib/supabase/database.types";
import { parseIdempotencyKey, runIdempotent } from "./idempotency";
import { callRpc } from "./rpc";

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
 * POST /api/booking — create a public booking.
 * Price, end time, service name and the barber for "any" are decided by the
 * create_public_booking RPC; the client only sends what the customer chose.
 * Send an `Idempotency-Key` header (same value on retries) to avoid duplicates.
 */
export async function POST(req: NextRequest) {
  // Rate limit first, before any other network call.
  const ip = getClientIp(req);
  const rl = await rateLimit(rateLimitKey("booking", ip), 10, 60);
  if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }

  const parsed = CreateBookingSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { shopId, serviceIds, barberId, clientName, clientPhone, startTime, source, notes } = parsed.data;

  try {
    const supabase = await createClient();

    const create = async (): Promise<CreateOutcome> => {
      const { data, error } = await callRpc(supabase, "create_public_booking", {
        p_shop_id: shopId,
        p_client_name: clientName,
        p_client_phone: clientPhone,
        p_service_ids: serviceIds,
        p_barber_id: barberId,
        p_start_time: startTime,
        p_source: source,
        p_notes: notes ?? null,
      });
      if (error || !data) return { ok: false, error: error ?? new Error("create_public_booking returned no data") };
      return { ok: true, booking: data };
    };

    const idemKey = parseIdempotencyKey(req.headers.get("idempotency-key"));
    const { result, replayed } = idemKey
      ? await runIdempotent(rateLimitKey("booking", ip, shopId, idemKey), create, (r) => r.ok)
      : { result: await create(), replayed: false };

    if (!result.ok) return dbErrorResponse("booking.create", result.error);

    return NextResponse.json(
      { success: true, appointment_id: result.booking.appointment_id, booking: result.booking },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotent-Replayed": "true" } : undefined },
    );
  } catch (err) {
    return serverError("booking.create", err);
  }
}
