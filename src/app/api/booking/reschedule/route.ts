import { NextResponse } from "next/server";
import { apiErrorCode, apiValidationError, serverError } from "@/lib/api-helpers";
import { createClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { callRpcLoose } from "../rpc";
import { RescheduleSchema } from "../schema";
import { bookingDbError } from "../errors";

/**
 * POST /api/booking/reschedule { appointmentId, date: "yyyy-MM-dd", time: "HH:mm", barberId? }
 * Atomic move via reschedule_booking: the old slot stays booked until the
 * new one commits (no cancel-then-book window). Owner customer or shop staff.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(rateLimitKey("reschedule", getClientIp(req)), 20, 3600);
  if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }
  const parsed = RescheduleSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { appointmentId, date, time, barberId } = parsed.data;

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return apiErrorCode("UNAUTHORIZED");

    const { data, error } = await callRpcLoose(supabase, "reschedule_booking", {
      p_id: appointmentId,
      p_date: date,
      p_start: time,
      p_barber_id: barberId,
    });
    if (error || !data) return bookingDbError("booking.reschedule", error ?? new Error("no data"));
    return NextResponse.json({ success: true, booking: data });
  } catch (err) {
    return serverError("booking.reschedule", err);
  }
}
