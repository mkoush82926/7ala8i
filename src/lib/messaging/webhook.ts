// ═══════════════════════════════════════════════════════════════════════════
// Inbound webhooks: WhatsApp Cloud API (delivery statuses, replies, the
// "Confirm" quick-reply button, STOP / إلغاء) and a generic inbound SMS.
// Parsing and signature checks are pure so they can be unit-tested.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies Meta's X-Hub-Signature-256 ("sha256=<hex>") over the raw body. */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const m = /^sha256=([a-f0-9]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(m[1], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Constant-time string compare for shared secrets. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface StatusEvent {
  providerMsgId: string;
  status: "sent" | "delivered" | "read" | "failed";
  at: string | null;
  error: string | null;
}

export interface InboundEvent {
  from: string;
  providerMsgId: string | null;
  body: string | null;
  buttonPayload: string | null;
  contextMsgId: string | null;
}

export interface ParsedWhatsApp {
  statuses: StatusEvent[];
  messages: InboundEvent[];
}

const STATUS = new Set(["sent", "delivered", "read", "failed"]);

function str(v: unknown, max = 2000): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
}

function unixToIso(v: unknown): string | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

export function parseWhatsAppWebhook(body: unknown): ParsedWhatsApp {
  const out: ParsedWhatsApp = { statuses: [], messages: [] };
  const entries = (body as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] } | null)?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> } | null)?.value;
      if (!value) continue;
      for (const s of Array.isArray(value.statuses) ? value.statuses : []) {
        const o = s as Record<string, unknown>;
        const id = str(o.id, 200);
        const status = str(o.status, 20);
        if (!id || !status || !STATUS.has(status)) continue;
        const err = Array.isArray(o.errors) ? (o.errors[0] as { code?: number; title?: string } | undefined) : undefined;
        out.statuses.push({
          providerMsgId: id,
          status: status as StatusEvent["status"],
          at: unixToIso(o.timestamp),
          error: err ? `WA_${err.code ?? "ERR"}`.slice(0, 60) : null,
        });
      }
      for (const m of Array.isArray(value.messages) ? value.messages : []) {
        const o = m as Record<string, unknown>;
        const from = str(o.from, 20);
        if (!from) continue;
        const text = (o.text as { body?: unknown } | undefined)?.body;
        const button = o.button as { text?: unknown; payload?: unknown } | undefined;
        const interactive = o.interactive as { button_reply?: { id?: unknown; title?: unknown } } | undefined;
        out.messages.push({
          from,
          providerMsgId: str(o.id, 200),
          body: str(text) ?? str(button?.text) ?? str(interactive?.button_reply?.title),
          buttonPayload: str(button?.payload, 300) ?? str(interactive?.button_reply?.id, 300),
          contextMsgId: str((o.context as { id?: unknown } | undefined)?.id, 200),
        });
      }
    }
  }
  return out;
}

/** Generic inbound SMS (form or JSON): from/sender/msisdn + body/text/message. */
export function parseInboundSms(fields: Record<string, unknown>): InboundEvent | null {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = fields[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const from = pick("from", "From", "sender", "Sender", "msisdn", "Recipient");
  if (!from) return null;
  return {
    from: from.slice(0, 20),
    providerMsgId: pick("id", "messageId", "MessageID", "MessageSid")?.slice(0, 200) ?? null,
    body: pick("body", "Body", "text", "message", "Message")?.slice(0, 2000) ?? null,
    buttonPayload: null,
    contextMsgId: null,
  };
}
