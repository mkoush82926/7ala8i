// ═══════════════════════════════════════════════════════
// Rate limiting (server-only)
//
// Primary store: Postgres via the SECURITY DEFINER function
// public.check_rate_limit(p_key, p_max, p_window_seconds) → boolean, which
// is shared by every serverless instance. It is executable by service_role
// only (so nobody can poison another visitor's bucket with the public anon
// key), so the DB path needs SUPABASE_SERVICE_ROLE_KEY on the server.
//
// Fallback: a per-instance in-memory fixed window (with pruning), used when
// the service role key is absent, in mock mode, or when the DB call fails.
// The booking/cancel/invite RPCs additionally enforce their own limits
// inside the database, so direct REST calls are limited too.
//
// Keys are hashed (SHA-256) before being stored, so IPs/phones never land in
// the rate_limits table in clear text.
// ═══════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv, MOCK_MODE, publicEnv } from "@/lib/env";

export interface RateLimitResult {
  success: boolean;
  /** Remaining requests in the window; null when the DB store answered (it only reports allow/deny). */
  remaining: number | null;
  /** Seconds until the window resets (best effort; the window length for DB results). */
  retryAfter: number;
  source: "db" | "memory";
}

// ─── In-memory fallback ───
const store = new Map<string, { count: number; resetAt: number }>();
const PRUNE_THRESHOLD = 500;

function pruneExpired(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

function memoryLimit(key: string, max: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  if (store.size > PRUNE_THRESHOLD) pruneExpired(now);

  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { success: max >= 1, remaining: Math.max(0, max - 1), retryAfter: windowSec, source: "memory" };
  }

  entry.count += 1;
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  if (entry.count > max) {
    return { success: false, remaining: 0, retryAfter, source: "memory" };
  }
  return { success: true, remaining: max - entry.count, retryAfter, source: "memory" };
}

/** Test helper — clears the in-memory store. */
export function __resetRateLimitMemory() {
  store.clear();
}

// ─── DB store ───
let adminClient: SupabaseClient | null | undefined;
let dbDisabledUntil = 0;

function getAdminClient(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  if (MOCK_MODE) return (adminClient = null);
  let serviceRoleKey: string | null = null;
  try {
    serviceRoleKey = getServerEnv().serviceRoleKey;
  } catch {
    serviceRoleKey = null;
  }
  if (!serviceRoleKey || !publicEnv.supabaseUrl) return (adminClient = null);
  adminClient = createClient(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

/** Test helper — forget the cached client (e.g. after changing env in a test). */
export function __resetRateLimitClient(client?: SupabaseClient | null) {
  adminClient = client;
  dbDisabledUntil = 0;
}

async function hashKey(key: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) return key.slice(0, 200);
  const prefix = key.split(":")[0] || "rl";
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix.slice(0, 40)}:${hex.slice(0, 40)}`;
}

/**
 * Fixed-window rate limit.
 *   const { success, retryAfter } = await rateLimit(rateLimitKey("booking", ip), 5, 60);
 *   if (!success) return apiErrorCode("RATE_LIMITED", { retryAfter });
 */
export async function rateLimit(key: string, max = 10, windowSec = 60): Promise<RateLimitResult> {
  const safeMax = Math.max(1, Math.floor(max));
  const safeWindow = Math.max(1, Math.floor(windowSec));
  const client = getAdminClient();

  if (client && Date.now() >= dbDisabledUntil) {
    try {
      const { data, error } = await client.rpc("check_rate_limit", {
        p_key: await hashKey(key),
        p_max: safeMax,
        p_window_seconds: safeWindow,
      });
      if (!error && typeof data === "boolean") {
        return { success: data, remaining: null, retryAfter: safeWindow, source: "db" };
      }
      throw error ?? new Error("check_rate_limit returned a non-boolean");
    } catch (err) {
      // Back off from the DB for 30s and degrade to memory rather than failing requests.
      dbDisabledUntil = Date.now() + 30_000;
      console.warn("[rate-limit] DB store unavailable, using in-memory fallback:", (err as { message?: string })?.message ?? err);
    }
  }

  return memoryLimit(key, safeMax, safeWindow);
}

/** Builds a namespaced key, skipping empty parts: rateLimitKey("booking", ip, phone). */
export function rateLimitKey(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((p) => p.trim().toLowerCase().slice(0, 100))
    .join(":");
}

/**
 * Best-effort client IP. Prefers platform headers that cannot be spoofed on
 * Vercel (x-vercel-forwarded-for, x-real-ip), then the FIRST entry of
 * x-forwarded-for. Returns "unknown" when nothing is present.
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const pick = (v: string | null) => (v ? v.split(",")[0]?.trim() : "");
  const ip =
    pick(h.get("x-vercel-forwarded-for")) ||
    pick(h.get("x-real-ip")) ||
    pick(h.get("cf-connecting-ip")) ||
    pick(h.get("x-forwarded-for"));
  return ip && ip.length <= 64 ? ip : "unknown";
}
