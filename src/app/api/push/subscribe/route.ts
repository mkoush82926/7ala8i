import { apiResponse, apiErrorCode, apiValidationError, dbErrorResponse, withAuth } from "@/lib/api-helpers";
import { readPushConfig } from "@/lib/push/config";
import { PushSubscribeSchema, PushUnsubscribeSchema, cleanUserAgent } from "../schema";

const INVALID = Symbol("invalid");

async function readJson(req: Request): Promise<unknown | typeof INVALID> {
  try {
    return await req.json();
  } catch {
    return INVALID;
  }
}

/**
 * POST /api/push/subscribe — saves this browser's push endpoint for the
 * signed-in staff member (barber or shop admin). Rate limited and validated
 * again inside push_subscribe(); keys are never readable by clients.
 */
export const POST = withAuth(async (req, { supabase }) => {
  if (!readPushConfig().vapidConfigured) return apiErrorCode("NOT_FOUND");
  const body = await readJson(req);
  if (body === INVALID) return apiErrorCode("VALIDATION_FAILED");
  const parsed = PushSubscribeSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { endpoint, keys, locale, oldEndpoint } = parsed.data;

  const { data, error } = await supabase.rpc("push_subscribe", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: cleanUserAgent(req.headers.get("user-agent")),
    p_locale: locale,
    p_old_endpoint: oldEndpoint ?? null,
  });
  if (error) return dbErrorResponse("push.subscribe", error);
  return apiResponse({ id: data as string }, 201);
});

/** DELETE /api/push/subscribe — forgets one of the caller's devices. */
export const DELETE = withAuth(async (req, { supabase }) => {
  const body = await readJson(req);
  if (body === INVALID) return apiErrorCode("VALIDATION_FAILED");
  const parsed = PushUnsubscribeSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { data, error } = await supabase.rpc("push_unsubscribe", { p_endpoint: parsed.data.endpoint });
  if (error) return dbErrorResponse("push.unsubscribe", error);
  return apiResponse({ removed: data === true });
});
