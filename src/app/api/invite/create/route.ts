import { randomUUID } from "crypto";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import {
  apiErrorCode,
  apiResponse,
  apiValidationError,
  dbErrorResponse,
  withAuth,
} from "@/lib/api-helpers";

const createInviteSchema = z.object({
  role: z.enum(["barber", "shop_admin"]).optional().default("barber"),
});

function siteOrigin(request: Request): string {
  if (publicEnv.siteUrl) {
    try {
      return new URL(publicEnv.siteUrl).origin;
    } catch {
      /* fall back to the request origin */
    }
  }
  return new URL(request.url).origin;
}

// Generates a shareable /join?token=... link for a new team member. There's
// no email/SMS provider configured for this market, so the invite is a link
// the shop admin copies or shares via WhatsApp themselves — see team/page.tsx.
// Only shop admins may call this (withAuth checks profiles.role).
export const POST = withAuth(
  async (request, { supabase, shopId }) => {
    const rl = await rateLimit(rateLimitKey("invite-create", shopId), 20, 3600);
    if (!rl.success) return apiErrorCode("RATE_LIMITED", { retryAfter: rl.retryAfter });

    const body = await request.json().catch(() => ({}));
    const parsed = createInviteSchema.safeParse(body ?? {});
    if (!parsed.success) return apiValidationError(parsed.error);

    const token = randomUUID();

    const { data: invite, error } = await supabase
      .from("invites")
      .insert({ shop_id: shopId, token, role: parsed.data.role })
      .select("token, role, expires_at")
      .single();

    if (error || !invite) return dbErrorResponse("invite.create", error ?? { message: "no row" });

    const url = new URL("/join", siteOrigin(request));
    url.searchParams.set("token", invite.token);

    return apiResponse(
      {
        url: url.toString(),
        token: invite.token,
        role: invite.role,
        expiresAt: invite.expires_at,
      },
      201,
    );
  },
  { roles: ["shop_admin"] },
);
