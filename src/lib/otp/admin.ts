// Service-role RPCs for the self-hosted OTP route (phone_verifications is
// invisible to anon/authenticated). Server only.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { OtpEnv } from "./config";

export type OtpVerifyOutcome =
  | { ok: true; token: string; expiresAt: string | null }
  | { ok: false; code: "OTP_INVALID" | "OTP_EXPIRED" | "OTP_TOO_MANY_ATTEMPTS" | "INTERNAL" };

export interface OtpStore {
  issue(phone: string): Promise<{ ok: true; code: string } | { ok: false; code: "RATE_LIMITED" | "INVALID_INPUT" | "INTERNAL" }>;
  verify(phone: string, code: string): Promise<OtpVerifyOutcome>;
}

let cached: SupabaseClient | null | undefined;

function adminClient(env: OtpEnv): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key || !publicEnv.supabaseUrl) return (cached = null);
  cached = createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/** Test hook. */
export function __setOtpAdminClient(client: SupabaseClient | null | undefined) {
  cached = client;
}

const KNOWN_ISSUE = new Set(["RATE_LIMITED", "INVALID_INPUT"]);
const KNOWN_VERIFY = new Set(["OTP_INVALID", "OTP_EXPIRED", "OTP_TOO_MANY_ATTEMPTS"]);

export function otpStore(env: OtpEnv): OtpStore | null {
  const client = adminClient(env);
  if (!client) return null;
  return {
    async issue(phone) {
      const { data, error } = await client.rpc("otp_issue", { p_phone: phone });
      if (error) {
        const msg = String(error.message ?? "").trim();
        return { ok: false, code: KNOWN_ISSUE.has(msg) ? (msg as "RATE_LIMITED" | "INVALID_INPUT") : "INTERNAL" };
      }
      const code = (data as { code?: unknown } | null)?.code;
      return typeof code === "string" ? { ok: true, code } : { ok: false, code: "INTERNAL" };
    },
    async verify(phone, code) {
      const { data, error } = await client.rpc("otp_verify", { p_phone: phone, p_code: code });
      if (error || !data) return { ok: false, code: "INTERNAL" };
      const d = data as { ok?: boolean; token?: string; code?: string; expires_at?: string };
      if (d.ok && typeof d.token === "string") return { ok: true, token: d.token, expiresAt: d.expires_at ?? null };
      return {
        ok: false,
        code: KNOWN_VERIFY.has(String(d.code)) ? (d.code as "OTP_INVALID" | "OTP_EXPIRED" | "OTP_TOO_MANY_ATTEMPTS") : "INTERNAL",
      };
    },
  };
}
