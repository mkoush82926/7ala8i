import { NextResponse } from "next/server";
import { readMessagingEnv } from "@/lib/messaging/config";
import { messagingAdminClient, processInbound, type ProcessSummary } from "@/lib/messaging/server";
import { parseInboundSms, safeEqual } from "@/lib/messaging/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/messaging/sms?secret=<MESSAGING_SMS_WEBHOOK_SECRET> — inbound SMS
 * from the gateway (form or JSON). Handles STOP / إلغاء opt-outs. Disabled
 * (503) until the secret is set.
 */
export async function POST(request: Request) {
  const env = readMessagingEnv();
  const secret = (env.MESSAGING_SMS_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });
  const url = new URL(request.url);
  const given = url.searchParams.get("secret") ?? request.headers.get("x-webhook-secret");
  if (!safeEqual(given, secret)) return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });

  let fields: Record<string, unknown> = {};
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const json = await request.json();
      fields = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
    } else {
      const form = await request.formData();
      form.forEach((v, k) => {
        if (typeof v === "string") fields[k] = v;
      });
    }
  } catch {
    return NextResponse.json({ success: false, code: "VALIDATION_FAILED" }, { status: 400 });
  }
  const event = parseInboundSms(fields);
  if (!event) return NextResponse.json({ success: false, code: "VALIDATION_FAILED" }, { status: 400 });

  const client = messagingAdminClient(env);
  if (!client) return NextResponse.json({ success: false, code: "NOT_CONFIGURED" }, { status: 503 });
  const summary: ProcessSummary = { statuses: 0, messages: 0, actions: {}, errors: 0 };
  await processInbound(client, [event], "sms", summary);
  return NextResponse.json({ success: summary.errors === 0, summary }, { status: summary.errors ? 500 : 200 });
}
