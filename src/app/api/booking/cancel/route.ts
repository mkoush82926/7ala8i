import { NextResponse } from "next/server";
import { CancelBookingSchema } from "@/lib/validations";
import {
  apiResponse,
  apiErrorCode,
  apiValidationError,
  dbErrorResponse,
  mapDbError,
  serverError,
} from "@/lib/api-helpers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitKey, getClientIp } from "@/lib/rate-limit";
import { callRpc } from "../rpc";

/**
 * POST /api/booking/cancel — a signed-in customer cancels their own booking.
 * Ownership, status, start time and the shop's cancellation window are all
 * checked inside the cancel_customer_booking RPC.
 */
export async function POST(request: Request) {
  const rl = await rateLimit(rateLimitKey("cancel", getClientIp(request)), 20, 3600);
  if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }

  const parsed = CancelBookingSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { appointment_id, reason } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error: rpcErr } = await callRpc(supabase, "cancel_customer_booking", {
      p_appointment_id: appointment_id,
      p_reason: reason || null,
    });

    if (rpcErr) {
      const mapped = mapDbError(rpcErr);
      if (mapped.code === "INSIDE_CANCELLATION_WINDOW") {
        // error.details carries the shop's policy (hours) so the UI can say "at least N hours before".
        const hours = Number.parseInt(String((rpcErr as { details?: unknown }).details ?? ""), 10);
        return NextResponse.json(
          {
            success: false,
            error: mapped.message,
            code: mapped.code,
            ...(Number.isFinite(hours) ? { policyHours: hours } : {}),
          },
          { status: mapped.status },
        );
      }
      return dbErrorResponse("booking.cancel", rpcErr);
    }
    if (!data) return apiErrorCode("APPT_NOT_FOUND");

    return apiResponse(data);
  } catch (err) {
    return serverError("booking.cancel", err);
  }
}
