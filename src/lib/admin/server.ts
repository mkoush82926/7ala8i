/**
 * Server-only helpers for /admin. The admin layout calls getAdminSession();
 * anything other than a signed-in, unbanned platform support/admin user gets
 * null, and the layout answers with a 404 (the back office never reveals
 * that it exists).
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { adminRpc, type RpcClient, type RpcResult } from "./rpc";
import { parseWhoAmI, type AdminWhoAmI } from "./types";

/** The cookie-bound server client, typed structurally for admin RPCs. */
export async function adminClient(): Promise<RpcClient & { auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> } }> {
  const supabase = await createClient();
  return supabase as unknown as RpcClient & { auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> } };
}

/** Resolves the caller's platform session once per request. */
export const getAdminSession = cache(async (): Promise<AdminWhoAmI | null> => {
  try {
    const client = await adminClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return null;
    const res = await adminRpc<unknown>(client, "admin_whoami");
    return res.ok ? parseWhoAmI(res.data) : null;
  } catch {
    return null;
  }
});

/** Runs a read RPC as the signed-in admin (used by server components). */
export async function adminQuery<T>(fn: string, args?: Record<string, unknown>): Promise<RpcResult<T>> {
  const client = await adminClient();
  return adminRpc<T>(client, fn, args);
}
