import { apiResponse, apiErrorCode, apiValidationError, dbErrorResponse, withAuth } from "@/lib/api-helpers";
import { readPushConfig } from "@/lib/push/config";
import { schedulePushDispatch } from "@/lib/push/kick";
import { PushTestSchema } from "../schema";

/**
 * POST /api/push/test — queues a test alert to the caller's own devices and
 * delivers it right after the response. Rate limited in push_send_test().
 */
export const POST = withAuth(async (req, { supabase }) => {
  const cfg = readPushConfig();
  if (!cfg.vapidConfigured) return apiErrorCode("NOT_FOUND");
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = PushTestSchema.safeParse(body ?? {});
  if (!parsed.success) return apiValidationError(parsed.error);

  const { data, error } = await supabase.rpc("push_send_test", { p_locale: parsed.data.locale });
  if (error) return dbErrorResponse("push.test", error);
  schedulePushDispatch();
  return apiResponse({ id: data as string, delivery: cfg.dispatchConfigured }, 202);
});
