/**
 * Thin, typed wrapper around the WS-1I admin RPCs. Every admin_* function is
 * SECURITY DEFINER and checks platform_role itself; this module only shapes
 * the result and turns Postgres errors into stable codes.
 *
 * The Supabase client is accepted structurally so the generated Database
 * types do not need to know about the admin functions yet.
 */

export interface RpcError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

/** Every error code the admin RPCs raise, plus client-side fallbacks. */
export const ADMIN_ERROR_CODES = [
  "NOT_AUTHORIZED",
  "NOT_AUTHENTICATED",
  "NOT_FOUND",
  "NO_CHANGE",
  "INVALID_INPUT",
  "REASON_REQUIRED",
  "ALREADY_RESOLVED",
  "ALREADY_REPORTED",
  "CANNOT_BAN_STAFF",
  "SHOP_SUSPENDED",
  "SHOP_INCOMPLETE",
  "IMPERSONATION_INACTIVE",
  "IMPERSONATION_READ_ONLY",
  "RATE_LIMITED",
  "ACCOUNT_BANNED",
  "FORBIDDEN",
  "NETWORK",
  "UNKNOWN",
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AdminErrorCode; detail: string | null };

const KNOWN = new Set<string>(ADMIN_ERROR_CODES);

/** Maps a PostgREST / Postgres error to one of ADMIN_ERROR_CODES. */
export function adminErrorCode(error: unknown): AdminErrorCode {
  if (!error) return "UNKNOWN";
  const e = error as Partial<RpcError>;
  const message = typeof e.message === "string" ? e.message : typeof error === "string" ? error : "";
  const head = /^([A-Z][A-Z_]{2,})\b/.exec(message.trim())?.[1];
  if (head && KNOWN.has(head)) return head as AdminErrorCode;
  // 42501 = insufficient_privilege (e.g. anon calling an authenticated-only RPC);
  // 42883 / PGRST202 = function missing (migration not applied) — treat as
  // "not an admin surface" so callers 404 instead of leaking details.
  if (e.code === "42501" || e.code === "42883" || e.code === "PGRST202") return "NOT_AUTHORIZED";
  if (/permission denied/i.test(message)) return "NOT_AUTHORIZED";
  if (/fetch failed|network|timeout|aborted/i.test(message)) return "NETWORK";
  return "UNKNOWN";
}

/** Calls an admin RPC and returns a discriminated result; never throws. */
export async function adminRpc<T>(
  client: RpcClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      return { ok: false, code: adminErrorCode(error), detail: error.details ?? null };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, code: adminErrorCode(err), detail: null };
  }
}
