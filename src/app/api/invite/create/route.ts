import { randomUUID } from "crypto";
import { z } from "zod";
import { apiResponse, apiError, withAuth } from "@/lib/api-helpers";

const createInviteSchema = z.object({
  role: z.enum(["barber", "shop_admin"]).optional().default("barber"),
});

// Generates a shareable /join?token=... link for a new team member. There's
// no email/SMS provider configured for this market, so the invite is a link
// the shop admin copies or shares via WhatsApp themselves — see team/page.tsx.
export const POST = withAuth(async (request, { supabase, shopId, user }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "shop_admin") {
    return apiError("Only shop admins can invite staff.", 403);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createInviteSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return apiError("Invalid input data", 400, errors);
  }

  const token = randomUUID();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invite, error } = await (supabase.from("invites") as any)
    .insert({ shop_id: shopId, token, role: parsed.data.role })
    .select("token, role, expires_at")
    .single();

  if (error || !invite) {
    console.error("[Invite Create] Failed:", error);
    return apiError("Failed to create invite link.", 500);
  }

  const origin = new URL(request.url).origin;

  return apiResponse({
    url: `${origin}/join?token=${invite.token}`,
    token: invite.token,
    role: invite.role,
    expiresAt: invite.expires_at,
  });
});
