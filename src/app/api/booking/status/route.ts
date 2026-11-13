import { UpdateStatusSchema } from "@/lib/validations";
import {
  apiResponse,
  apiError,
  apiErrorCode,
  apiValidationError,
  dbErrorResponse,
  withAuth,
} from "@/lib/api-helpers";
import { APPOINTMENT_STATUS_TRANSITIONS, normalizeAppointmentStatus } from "@/lib/types";

/**
 * POST /api/booking/status — staff move an appointment to its next status.
 * Admins may change any appointment in their shop; barbers only their own.
 */
export const POST = withAuth(async (request, { supabase, shopId, role, user }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { appointment_id, status, reason } = parsed.data;

  // ─── Fetch appointment (scoped to the caller's shop) ───
  const { data: appointment, error: fetchError } = (await supabase
    .from("appointments")
    .select("id, status, shop_id, barber_id")
    .eq("id", appointment_id)
    .eq("shop_id", shopId)
    .maybeSingle()) as {
    data: { id: string; status: string | null; shop_id: string; barber_id: string | null } | null;
    error: unknown;
  };

  if (fetchError) return dbErrorResponse("booking.status.fetch", fetchError);
  if (!appointment) return apiErrorCode("APPT_NOT_FOUND");

  if (role !== "shop_admin" && appointment.barber_id !== user.id) {
    return apiErrorCode("FORBIDDEN");
  }

  // ─── Status transition validation ───
  const currentStatus = normalizeAppointmentStatus(appointment.status) ?? "pending";
  const allowed = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(status)) {
    return apiError(`Cannot change status from "${currentStatus}" to "${status}"`, 409, {
      code: "INVALID_TRANSITION",
    });
  }

  // ─── Update (triggers set updated_at, cancelled_at and no_show) ───
  const { error: updateError } = (await supabase
    .from("appointments")
    .update({ status, ...(status === "cancelled" && reason ? { cancellation_reason: reason } : {}) })
    .eq("id", appointment_id)
    .eq("shop_id", shopId)) as { error: unknown };

  if (updateError) return dbErrorResponse("booking.status", updateError);

  return apiResponse({ appointment_id, status });
});
