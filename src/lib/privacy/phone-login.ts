// ═══════════════════════════════════════════════════════
// WS-1J · Self-hosted ("hook" mode) phone login. SERVER ONLY.
//
// Exchanges a single-use OTP token from /api/booking/otp/verify for a
// Supabase session:
//   1. customer_phone_login_resolve(token, phone) consumes the token and
//      returns the account that owns the phone (or none).
//   2. A new customer account is created with a placeholder email in the
//      reserved .invalid TLD (never shown, never exported as an email).
//   3. customer_attach_verified_phone() records the phone and links every
//      guest booking made earlier with it (all shops).
//   4. A magic-link token_hash is minted with the admin API and verified by
//      the caller's cookie-bound client, which sets the session cookies.
// Staff accounts are refused (NOT_CUSTOMER): they keep using email login.
// ═══════════════════════════════════════════════════════
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { maskForDisplay, toJordanMobile } from "@/lib/otp/phone";
import { syntheticEmailFor } from "./account";
import { normalizeFullName, type PhoneLoginErrorCode } from "./login";

export interface PhoneLoginInput {
  phone: string;
  token: string;
  fullName?: string | null;
}

export type PhoneLoginResult =
  | { ok: true; tokenHash: string; userId: string; isNew: boolean; linked: number }
  | { ok: false; code: PhoneLoginErrorCode };

/** Minimal admin surface (lets tests inject a fake). */
export interface PhoneLoginAdmin {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  auth: {
    admin: {
      createUser(attrs: Record<string, unknown>): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
      updateUserById(id: string, attrs: Record<string, unknown>): Promise<{ error: unknown }>;
      generateLink(params: { type: "magiclink"; email: string }): Promise<{
        data: { properties?: { hashed_token?: string } | null } | null;
        error: unknown;
      }>;
    };
  };
}

let cached: SupabaseClient | null | undefined;

export function phoneLoginAdmin(serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY): PhoneLoginAdmin | null {
  if (cached !== undefined) return cached as unknown as PhoneLoginAdmin | null;
  const key = (serviceRoleKey ?? "").trim();
  if (!key || !publicEnv.supabaseUrl) {
    cached = null;
    return null;
  }
  cached = createAdminClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached as unknown as PhoneLoginAdmin;
}

const codeOf = (error: { message?: string } | null | undefined) => (error?.message ?? "").trim();

export async function completePhoneLogin(
  admin: PhoneLoginAdmin,
  input: PhoneLoginInput,
): Promise<PhoneLoginResult> {
  const digits = toJordanMobile(input.phone);
  if (!digits) return { ok: false, code: "INVALID_PHONE" };
  const token = (input.token ?? "").trim();
  if (!token || token.length > 512) return { ok: false, code: "OTP_INVALID" };

  // 1. Consume the token and find the owner.
  const resolved = await admin.rpc("customer_phone_login_resolve", { p_token: token, p_phone: digits });
  if (resolved.error) {
    const code = codeOf(resolved.error);
    return { ok: false, code: code === "OTP_INVALID" ? "OTP_INVALID" : code === "INVALID_INPUT" ? "INVALID_PHONE" : "LOGIN_FAILED" };
  }
  const owner = (resolved.data ?? {}) as { user_id?: string | null; email?: string | null; role?: string | null };
  let userId = owner.user_id ?? null;
  let email = owner.email ?? null;
  let isNew = false;

  if (userId && owner.role && owner.role !== "customer") return { ok: false, code: "NOT_CUSTOMER" };

  // 2. New customer.
  if (!userId) {
    // The name is optional here (the token is already spent): the account hub
    // asks for it right after the first sign-in.
    const fullName = normalizeFullName(input.fullName) ?? maskForDisplay(digits);
    email = syntheticEmailFor(digits);
    const base = { email, email_confirm: true, user_metadata: { full_name: fullName, role: "customer" } };
    let created = await admin.auth.admin.createUser({ ...base, phone: `+${digits}`, phone_confirm: true });
    // The phone may already sit on an unconfirmed auth user: create without it.
    if (created.error || !created.data.user) created = await admin.auth.admin.createUser(base);
    if (created.error || !created.data.user) return { ok: false, code: "LOGIN_FAILED" };
    userId = created.data.user.id;
    isNew = true;
  } else if (!email) {
    // Phone-only Supabase user: give it a placeholder email so a link can be minted.
    email = syntheticEmailFor(digits);
    const upd = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (upd.error) return { ok: false, code: "LOGIN_FAILED" };
  }

  // 3. Record the phone and attach earlier guest bookings.
  const attached = await admin.rpc("customer_attach_verified_phone", {
    p_profile_id: userId,
    p_phone: digits,
    p_method: "hook_otp",
  });
  if (attached.error) {
    return { ok: false, code: codeOf(attached.error) === "NOT_CUSTOMER" ? "NOT_CUSTOMER" : "LOGIN_FAILED" };
  }
  const linked = Number((attached.data as { linked?: unknown } | null)?.linked ?? 0) || 0;

  // 4. Mint a one-time sign-in token for the caller's cookie client.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: email! });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return { ok: false, code: "LOGIN_FAILED" };

  return { ok: true, tokenHash, userId: userId!, isNew, linked };
}

/** Test hook. */
export function __setPhoneLoginAdmin(client: PhoneLoginAdmin | null | undefined) {
  cached = client as unknown as SupabaseClient | null | undefined;
}
