// ═══════════════════════════════════════════════════════════════════════════
// Provider adapters: WhatsApp Cloud API, Unifonic SMS, and the wa.me
// fallback. Server only. Adapters never throw; they resolve to a result.
// ═══════════════════════════════════════════════════════════════════════════
import type { MessagingConfig } from "./config";
import { META_TEMPLATES, renderVars } from "./templates";
import type { ClaimedMessage, MessageLocale, TemplateId } from "./types";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text?(): Promise<string> }>;

export type SendOutcome =
  | { ok: true; provider: string; providerMsgId: string | null }
  | { ok: false; provider: string; retryable: boolean; error: string };

const GRAPH = "https://graph.facebook.com/v21.0";

async function safeJson(res: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function graphError(body: unknown, status: number): string {
  const e = (body as { error?: { code?: number; message?: string } } | null)?.error;
  return `WA_${e?.code ?? status}`.slice(0, 60);
}

async function postGraph(
  cfg: NonNullable<MessagingConfig["whatsapp"]>,
  payload: Record<string, unknown>,
  fetchImpl: FetchLike,
): Promise<SendOutcome> {
  try {
    const res = await fetchImpl(`${GRAPH}/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const body = await safeJson(res);
    if (res.ok) {
      const id = (body as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id ?? null;
      return { ok: true, provider: "whatsapp-cloud", providerMsgId: id };
    }
    return { ok: false, provider: "whatsapp-cloud", retryable: res.status >= 500 || res.status === 429, error: graphError(body, res.status) };
  } catch {
    return { ok: false, provider: "whatsapp-cloud", retryable: true, error: "WA_NETWORK" };
  }
}

/** Free-form text: only allowed inside the 24-hour customer-service window. */
export function whatsappTextPayload(to: string, text: string): Record<string, unknown> {
  return { to, type: "text", text: { preview_url: true, body: text.slice(0, 4096) } };
}

/** Approved template message (outside the 24-hour window). */
export function whatsappTemplatePayload(
  msg: Pick<ClaimedMessage, "to" | "template" | "locale" | "payload">,
  prefix: string,
  siteUrl: string,
): Record<string, unknown> | null {
  const spec = META_TEMPLATES[msg.template as TemplateId];
  if (!spec) return null;
  const locale: MessageLocale = msg.locale === "en" ? "en" : "ar";
  const vars = renderVars(msg.template, locale, msg.payload?.ctx, siteUrl, msg.payload?.vars);
  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: spec.params.map((p) => ({ type: "text", text: (vars[p] || "-").slice(0, 200) })),
    },
  ];
  const token = msg.payload?.ctx?.token ?? null;
  let index = 0;
  if (spec.manageButton) {
    if (!token) return null;
    components.push({ type: "button", sub_type: "url", index: String(index), parameters: [{ type: "text", text: token }] });
    index++;
  }
  if (spec.confirmButton && token) {
    components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload: `CONFIRM:${token}` }] });
  }
  return {
    to: msg.to,
    type: "template",
    template: { name: `${prefix}${spec.name}`, language: { code: locale }, components },
  };
}

export async function sendWhatsAppText(cfg: MessagingConfig, to: string, text: string, fetchImpl: FetchLike): Promise<SendOutcome> {
  if (!cfg.whatsapp) return { ok: false, provider: "whatsapp-cloud", retryable: false, error: "NOT_CONFIGURED" };
  return postGraph(cfg.whatsapp, whatsappTextPayload(to, text), fetchImpl);
}

export async function sendWhatsAppTemplate(cfg: MessagingConfig, msg: ClaimedMessage, fetchImpl: FetchLike): Promise<SendOutcome> {
  if (!cfg.whatsapp) return { ok: false, provider: "whatsapp-cloud", retryable: false, error: "NOT_CONFIGURED" };
  const payload = whatsappTemplatePayload(msg, cfg.whatsapp.prefix, cfg.siteUrl);
  if (!payload) return { ok: false, provider: "whatsapp-cloud", retryable: false, error: "NO_TEMPLATE" };
  return postGraph(cfg.whatsapp, payload, fetchImpl);
}

export async function sendSms(cfg: MessagingConfig, to: string, text: string, fetchImpl: FetchLike): Promise<SendOutcome> {
  if (!cfg.sms) return { ok: false, provider: "sms-unifonic", retryable: false, error: "NOT_CONFIGURED" };
  try {
    const body = new URLSearchParams({ AppSid: cfg.sms.appSid, SenderID: cfg.sms.senderId, Recipient: to, Body: text.slice(0, 1000) });
    const res = await fetchImpl("https://el.cloud.unifonic.com/rest/SMS/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await safeJson(res)) as { success?: boolean | string; data?: { MessageID?: string | number } } | null;
    const success = res.ok && json?.success !== false && json?.success !== "false";
    if (success) {
      const id = json?.data?.MessageID != null ? `unifonic:${json.data.MessageID}` : null;
      return { ok: true, provider: "sms-unifonic", providerMsgId: id };
    }
    return { ok: false, provider: "sms-unifonic", retryable: res.status >= 500, error: `SMS_${res.status}` };
  } catch {
    return { ok: false, provider: "sms-unifonic", retryable: true, error: "SMS_NETWORK" };
  }
}
