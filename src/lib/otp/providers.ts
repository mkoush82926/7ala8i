// ═══════════════════════════════════════════════════════
// OTP delivery adapters. Server only. Every sender resolves to a result and
// never throws; the code itself is never logged except by the dev "log"
// provider (refused in production by resolveOtpProvider).
// ═══════════════════════════════════════════════════════
import { resolveOtpProvider, type OtpEnv, type OtpProviderName } from "./config";
import { toE164Digits } from "./phone";

export interface OtpMessage {
  phone: string;
  code: string;
  locale: "en" | "ar";
}

export interface OtpSendResult {
  ok: boolean;
  provider: OtpProviderName | null;
  /** Machine-readable reason when ok=false. */
  reason?: "NOT_CONFIGURED" | "INVALID_PHONE" | "PROVIDER_ERROR";
}

type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;

/** The SMS text, Arabic first for "ar". Kept short (one GSM/UCS-2 segment). */
export function otpText(code: string, locale: "en" | "ar"): string {
  return locale === "ar"
    ? `رمز التحقق في حلاقي: ${code}. صالح لمدة 5 دقائق. لا تشاركه مع أحد.`
    : `Your Halaqy code is ${code}. It expires in 5 minutes. Don't share it.`;
}

async function sendUnifonic(msg: OtpMessage, env: OtpEnv, to: string, fetchImpl: FetchLike): Promise<boolean> {
  const body = new URLSearchParams({
    AppSid: (env.UNIFONIC_APP_SID ?? "").trim(),
    SenderID: (env.UNIFONIC_SENDER_ID ?? "Halaqy").trim() || "Halaqy",
    Recipient: to,
    Body: otpText(msg.code, msg.locale),
  });
  const res = await fetchImpl("https://el.cloud.unifonic.com/rest/SMS/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return res.ok;
}

/** WhatsApp Cloud API "authentication" template with a copy-code button. */
async function sendWhatsApp(msg: OtpMessage, env: OtpEnv, to: string, fetchImpl: FetchLike): Promise<boolean> {
  const phoneId = (env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
  const res = await fetchImpl(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(env.WHATSAPP_TOKEN ?? "").trim()}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: (env.WHATSAPP_OTP_TEMPLATE ?? "").trim(),
        language: { code: msg.locale === "ar" ? "ar" : "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: msg.code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: msg.code }] },
        ],
      },
    }),
  });
  return res.ok;
}

export async function sendOtpMessage(
  msg: OtpMessage,
  env: OtpEnv,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<OtpSendResult> {
  const provider = resolveOtpProvider(env);
  if (!provider) return { ok: false, provider: null, reason: "NOT_CONFIGURED" };
  const to = toE164Digits(msg.phone);
  if (!to || !/^\d{6}$/.test(msg.code)) return { ok: false, provider, reason: "INVALID_PHONE" };

  try {
    if (provider === "log") {
      // Development only (resolveOtpProvider refuses "log" in production).
      console.info(`[otp:dev] code for …${to.slice(-3)}: ${msg.code}`);
      return { ok: true, provider };
    }
    const ok =
      provider === "unifonic"
        ? await sendUnifonic(msg, env, to, fetchImpl)
        : await sendWhatsApp(msg, env, to, fetchImpl);
    return ok ? { ok: true, provider } : { ok: false, provider, reason: "PROVIDER_ERROR" };
  } catch {
    return { ok: false, provider, reason: "PROVIDER_ERROR" };
  }
}
