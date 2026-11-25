import { apiResponse } from "@/lib/api-helpers";
import { publicPushConfig, readPushConfig } from "@/lib/push/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/push/config — client-safe push settings: whether VAPID is set up,
 * the public key to subscribe with, and whether the server can deliver.
 * Never exposes the private key or any secret.
 */
export async function GET() {
  return apiResponse(publicPushConfig(readPushConfig()), 200, { "Cache-Control": "no-store" });
}
