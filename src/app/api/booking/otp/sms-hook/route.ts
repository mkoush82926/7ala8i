import { NextResponse } from "next/server";
import { readOtpEnv } from "@/lib/otp/config";
import { sendOtpMessage } from "@/lib/otp/providers";
import { verifyWebhook } from "@/lib/otp/webhook";

export const runtime = "nodejs";

/**
 * Supabase Auth "Send SMS" hook (NEXT_PUBLIC_OTP_MODE=supabase with a
 * provider Supabase does not support natively, e.g. Unifonic or WhatsApp).
 * Configure in Supabase: Auth → Hooks → Send SMS → HTTPS
 *   https://<site>/api/booking/otp/sms-hook, secret = SEND_SMS_HOOK_SECRET.
 * The request is signed with Standard Webhooks; anything unsigned is 401.
 */
export async function POST(req: Request) {
  const env = readOtpEnv();
  const secret = env.SEND_SMS_HOOK_SECRET;
  if (!secret) return NextResponse.json({ error: { http_code: 404, message: "Not configured" } }, { status: 404 });

  const raw = await req.text();
  const ok = verifyWebhook(raw, {
    id: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
  }, secret);
  if (!ok) return NextResponse.json({ error: { http_code: 401, message: "Invalid signature" } }, { status: 401 });

  let payload: { user?: { phone?: string; user_metadata?: { locale?: string } }; sms?: { otp?: string } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: { http_code: 400, message: "Bad payload" } }, { status: 400 });
  }
  const phone = payload.user?.phone ?? "";
  const code = payload.sms?.otp ?? "";
  const locale = payload.user?.user_metadata?.locale === "en" ? "en" : "ar";

  const sent = await sendOtpMessage({ phone, code, locale }, env);
  if (!sent.ok) {
    return NextResponse.json({ error: { http_code: 500, message: "Delivery failed" } }, { status: 500 });
  }
  return NextResponse.json({});
}
