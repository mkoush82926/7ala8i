// Trusted path from POST /api/booking to the database (server only).
//
// create_public_booking is still callable with the anon key, but a direct
// call must prove the phone (OTP token or confirmed auth phone). The route
// has already applied its own OTP / CAPTCHA gate and per-client-IP limit, so
// it calls create_public_booking_gateway with the service role instead,
// passing the signed-in user and the real client IP (so the SQL per-IP
// bucket is per customer, not one bucket for the server's egress IP).
//
// Without SUPABASE_SERVICE_ROLE_KEY the route falls back to the direct call.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let cached: { key: string; client: SupabaseClient } | null = null;
let override: unknown;

/** Service-role client for the gateway RPC, or null when no key is set. */
export function bookingGatewayClient(serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY): unknown {
  if (override !== undefined) return override;
  const key = (serviceRoleKey ?? "").trim();
  if (!key || !publicEnv.supabaseUrl) return null;
  if (cached?.key === key) return cached.client;
  const client = createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cached = { key, client };
  return client;
}

/** Arguments for create_public_booking_gateway: the RPC args plus actor and IP. */
export function gatewayArgs(
  args: Record<string, unknown>,
  actorId: string | null | undefined,
  clientIp: string | null | undefined,
): Record<string, unknown> {
  const ip = (clientIp ?? "").trim();
  return {
    p_actor: actorId ?? null,
    p_client_ip: ip && ip !== "unknown" ? ip.slice(0, 64) : null,
    ...args,
  };
}

/** Test hook: a fake client, null (no key) or undefined (read the env). */
export function __setBookingGatewayClient(client: unknown) {
  override = client;
}
