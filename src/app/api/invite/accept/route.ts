import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptSchema } from "@/lib/validations";
import { rateLimit, rateLimitKey, getClientIp } from "@/lib/rate-limit";
import {
  apiErrorCode,
  apiResponse,
  apiValidationError,
  dbErrorResponse,
  serverError,
} from "@/lib/api-helpers";

// Accepts a team invite for the signed-in user. All checks (auth, token
// validity, expiry, single use, never demoting the last admin) happen inside
// the accept_invite SECURITY DEFINER RPC; this route only rate-limits,
// validates the shape and maps the RPC's error codes:
//   NOT_AUTHENTICATED 401 · INVITE_INVALID 404 · INVITE_USED 409 ·
//   INVITE_EXPIRED 410 · LAST_ADMIN 409 · RATE_LIMITED 429
export async function POST(request: NextRequest) {
  // Throttle token guessing before any other work.
  const rl = await rateLimit(rateLimitKey("invite-accept", getClientIp(request)), 10, 60);
  if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_FAILED");
  }

  const parsed = InviteAcceptSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const supabase = (await createClient()) as unknown as {
      rpc: (fn: "accept_invite", args: { p_token: string }) => PromiseLike<{ data: unknown; error: unknown }>;
    };
    const { data, error } = await supabase.rpc("accept_invite", { p_token: parsed.data.token });

    if (error) return dbErrorResponse("invite.accept", error);

    const result = (Array.isArray(data) ? data[0] : data) as { shop_id?: string; role?: string } | null;
    if (!result?.shop_id) return apiErrorCode("INVITE_INVALID");

    return apiResponse({ shopId: result.shop_id, role: result.role ?? "barber" });
  } catch (err) {
    return serverError("invite.accept", err);
  }
}
