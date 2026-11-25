import { NextResponse } from "next/server";
import { readMessagingEnv, resolveMessagingConfig } from "@/lib/messaging/config";
import { runDispatch } from "@/lib/messaging/dispatch";
import { messagingAdminClient } from "@/lib/messaging/server";
import { safeEqual } from "@/lib/messaging/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST|GET /api/messaging/dispatch — runs one dispatcher pass.
 * Called every minute by the dispatch-messages Edge Function (or Vercel
 * cron). Auth: "Authorization: Bearer <MESSAGING_CRON_SECRET | CRON_SECRET>".
 * Responds 503 NOT_CONFIGURED when the secret or the service-role key is
 * missing, so an unconfigured deployment does nothing and never errors.
 */
async function handle(request: Request) {
  const env = readMessagingEnv();
  const cfg = resolveMessagingConfig(env);
  if (!cfg.cronSecret) {
    return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!safeEqual(token, cfg.cronSecret)) {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
  }
  const client = messagingAdminClient(env);
  if (!client) {
    return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const summary = await runDispatch({
      client,
      config: cfg,
      limit: 50,
      log: (line) => console.warn(line),
    });
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error("[messaging] dispatch failed", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ success: false, code: "INTERNAL" }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
