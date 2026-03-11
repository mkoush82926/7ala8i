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

    // ─── Cancel appointment via secure RPC ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cancelled, error: rpcErr } = await (supabase.rpc as any)("cancel_public_booking", {
      p_appointment_id: appointment_id,
    });

    if (rpcErr || !cancelled) {
      console.error("[Cancel] RPC failed:", rpcErr);
      // The RPC throws exact error strings like "Cannot cancel..." or "Appointment not found"
      const msg = rpcErr?.message || "Failed to cancel appointment. Please try again.";
      const status = msg.includes("not found") ? 404 : 400;
      return apiError(msg, status);
    }

    return apiResponse({ cancelled: true, appointment_id });
  } catch (err) {
    console.error("[Cancel] Unexpected error:", err);
    return apiError("Something went wrong. Please try again.", 500);
  }
}
