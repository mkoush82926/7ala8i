import { UpdateStatusSchema } from "@/lib/validations";
import { apiResponse, apiError, withAuth } from "@/lib/api-helpers";

export const POST = withAuth(async (request, { supabase, shopId }) => {
  const body = await request.json();

  // ─── Validate input ───
  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, parsed.error.flatten());
  }

  const { appointment_id, status } = parsed.data;

  // ─── Fetch appointment ───
  const { data: appointment, error: fetchError } = (await supabase
    .from("appointments")
    .select("id, status, shop_id")
    .eq("id", appointment_id)
    .eq("shop_id", shopId)
    .single()) as unknown as { data: { id: string; status: string | null; shop_id: string } | null; error: { message: string } | null };

  if (fetchError || !appointment) {
    return apiError("Appointment not found", 404);
  }

  // ─── Status transition validation ───
  const allowedTransitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled", "no-show"],
    confirmed: ["completed", "cancelled", "no-show"],
    completed: [], // terminal state
    cancelled: [], // terminal state
    "no-show": [], // terminal state
  };

  const currentStatus = appointment.status ?? "pending";
  const allowed = allowedTransitions[currentStatus] ?? [];

  if (!allowed.includes(status)) {
    return apiError(
      `Cannot change status from "${currentStatus}" to "${status}"`,
      400,
    );
  }

  // ─── Update ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = (await (supabase
    .from("appointments") as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", appointment_id)) as unknown as { error: { message: string } | null };

  if (updateError) {
    console.error("[Status] Failed to update:", updateError);
    return apiError("Failed to update appointment status.", 500);
  }

  return apiResponse({ appointment_id, status });
});
