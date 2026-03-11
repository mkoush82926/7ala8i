import { CancelBookingSchema } from "@/lib/validations";
import { apiResponse, apiError } from "@/lib/api-helpers";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ─── Validate input ───
    const parsed = CancelBookingSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", 400, parsed.error.flatten());
    }

    const { appointment_id, reason } = parsed.data;

    const supabase = await createClient();

    // ─── Fetch appointment ───
    const { data: appointment, error: fetchError } = (await supabase
      .from("appointments")
      .select("id, status")
      .eq("id", appointment_id)
      .single()) as unknown as { data: { id: string; status: string | null } | null; error: { message: string } | null };

    if (fetchError || !appointment) {
      return apiError("Appointment not found", 404);
    }

    // ─── Only pending/confirmed can be cancelled ───
    if (!["pending", "confirmed"].includes(appointment.status ?? "")) {
      return apiError(
        `Cannot cancel an appointment with status "${appointment.status}"`,
        400,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = (await (supabase
      .from("appointments") as any)
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", appointment_id)) as unknown as { error: { message: string } | null };

    if (updateError) {
      console.error("[Cancel] Failed to cancel:", updateError);
      return apiError("Failed to cancel appointment. Please try again.", 500);
    }

    return apiResponse({ cancelled: true, appointment_id });
  } catch (err) {
    console.error("[Cancel] Unexpected error:", err);
    return apiError("Something went wrong. Please try again.", 500);
  }
}
