// Nightly prayer-block generator (cron-authenticated, service role). Server only.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { safeEqual } from "@/lib/messaging/webhook";

/** Bearer token for this route: PRAYER_CRON_SECRET, else CRON_SECRET (Vercel Cron). */
export function prayerCronSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = (env.PRAYER_CRON_SECRET ?? "").trim() || (env.CRON_SECRET ?? "").trim();
  return s || null;
}

export function bearerToken(header: string | null): string {
  return header && header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
let override: RpcClient | null | undefined;

/** Test hook. */
export function __setPrayerAdminClient(client: RpcClient | null | undefined) {
  override = client;
}

function adminClient(): RpcClient | null {
  if (override !== undefined) return override;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key || !publicEnv.supabaseUrl) return null;
  return createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as RpcClient;
}

/**
 * GET|POST /api/prayer/generate — rolls prayer-time blocks forward 14 days
 * for every shop with prayer rules (generate_prayer_blocks(NULL, 14)).
 * Called nightly by Vercel Cron (vercel.json) or any scheduler with
 * "Authorization: Bearer <PRAYER_CRON_SECRET | CRON_SECRET>". With pg_cron
 * installed the database also schedules it (halaqy_prayer_blocks).
 * Unconfigured → 503 NOT_CONFIGURED (no work, no error).
 */
export async function handlePrayerGenerate(request: Request) {
  const secret = prayerCronSecret();
  if (!secret) return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });
  if (!safeEqual(bearerToken(request.headers.get("authorization")), secret)) {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
  }
  const client = adminClient();
  if (!client) return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });
  try {
    const { data, error } = await client.rpc("generate_prayer_blocks", { p_shop_id: null, p_days: 14 });
    if (error) {
      console.error("[prayer] generate failed", (error as { message?: string }).message ?? "unknown");
      return NextResponse.json({ success: false, code: "INTERNAL" }, { status: 500 });
    }
    return NextResponse.json({ success: true, blocks: typeof data === "number" ? data : 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[prayer] generate failed", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ success: false, code: "INTERNAL" }, { status: 500 });
  }
}
