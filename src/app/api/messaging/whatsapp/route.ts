import { NextResponse } from "next/server";
import { readMessagingEnv } from "@/lib/messaging/config";
import { messagingAdminClient, processWhatsApp } from "@/lib/messaging/server";
import { parseWhatsAppWebhook, safeEqual, verifyMetaSignature } from "@/lib/messaging/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Meta webhook subscription handshake. */
export async function GET(request: Request) {
  const env = readMessagingEnv();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = (env.WHATSAPP_VERIFY_TOKEN ?? "").trim();
  if (mode === "subscribe" && expected && safeEqual(token, expected) && /^[\w-]{1,200}$/.test(challenge)) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ success: false, code: "FORBIDDEN" }, { status: 403 });
}

/**
 * Delivery statuses, replies, the Confirm quick-reply (→ appointment
 * status "confirmed") and STOP / إلغاء opt-outs. Requires a valid
 * X-Hub-Signature-256; disabled (503) until WHATSAPP_APP_SECRET is set.
 */
export async function POST(request: Request) {
  const env = readMessagingEnv();
  const secret = (env.WHATSAPP_APP_SECRET ?? "").trim();
  if (!secret) return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });

  const raw = await request.text();
  if (raw.length > 512 * 1024) return NextResponse.json({ success: false, code: "VALIDATION_FAILED" }, { status: 413 });
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, code: "VALIDATION_FAILED" }, { status: 400 });
  }
  const client = messagingAdminClient(env);
  if (!client) return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });

  try {
    const summary = await processWhatsApp(client, parseWhatsAppWebhook(body));
    // Always 200 once authenticated, so Meta does not retry processed events.
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error("[messaging] whatsapp webhook failed", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ success: false, code: "INTERNAL" }, { status: 500 });
  }
}
