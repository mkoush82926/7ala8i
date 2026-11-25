import { NextResponse } from "next/server";
import { apiResponse, apiErrorCode } from "@/lib/api-helpers";
import { isDispatchAuthorized, readPushConfig } from "@/lib/push/config";
import { dispatchStaffPush } from "@/lib/push/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST|GET /api/push/dispatch — drains the staff notification outbox.
 * Callers: the pg_net kick on outbox insert (x-push-secret: PUSH_DISPATCH_SECRET)
 * and Vercel Cron (Authorization: Bearer CRON_SECRET). Everyone else gets 401.
 */
async function handle(req: Request): Promise<NextResponse> {
  const cfg = readPushConfig();
  if (!isDispatchAuthorized(req.headers, cfg)) return apiErrorCode("UNAUTHORIZED");
  if (!cfg.dispatchConfigured) {
    return apiResponse({ configured: false, claimed: 0 }, 200, { "Cache-Control": "no-store" });
  }
  const summary = await dispatchStaffPush({ config: cfg });
  return apiResponse(summary, summary.error ? 500 : 200, { "Cache-Control": "no-store" });
}

export const POST = handle;
export const GET = handle;
