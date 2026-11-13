// ═══════════════════════════════════════════════════════════════════════════
// Messaging stub (WS-1F). WS-1C replaces this module with the real outbox
// (enqueue_message() RPC + WhatsApp Cloud API / SMS workers). Until then
// every message degrades to a wa.me deep link the staff member opens by hand,
// so nothing here needs an external account or env var.
//
// Callers compose the message body with the i18n strings (t.*) and pass it in;
// this module never contains user-facing copy.
// ═══════════════════════════════════════════════════════════════════════════

export type MessageChannel = "whatsapp" | "sms";

/** Template ids 1C will map to approved WhatsApp templates. */
export type MessageTemplate =
  | "schedule_change"
  | "appointment_cancelled"
  | "receipt"
  | "generic";

export interface EnqueueMessageInput {
  shopId: string;
  /** Recipient phone in any common Jordanian format (07…, +9627…, 009627…). */
  to: string | null | undefined;
  template: MessageTemplate;
  /** Fully rendered body in the recipient's language. */
  body: string;
  locale?: "en" | "ar";
  appointmentId?: string | null;
  saleId?: string | null;
  channel?: MessageChannel;
  /** Template variables for 1C (ignored by the stub). */
  vars?: Record<string, string | number>;
}

export type EnqueueMessageResult =
  /** Accepted by the outbox (1C). */
  | { status: "queued"; id: string }
  /** No provider: open this wa.me link to send by hand. */
  | { status: "fallback"; waLink: string }
  /** Nothing to send (no usable phone number). */
  | { status: "skipped"; reason: "NO_PHONE" | "EMPTY_BODY" };

/**
 * Normalises a phone number to international digits (no "+").
 * Jordanian mobiles: 07XXXXXXXX / 7XXXXXXXX / 9627… / 009627… → 9627XXXXXXXX.
 * Returns null when the input cannot be a phone number.
 */
export function normalizePhoneForWa(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const latin = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let digits = latin.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = `962${digits.slice(1)}`;
  else if (digits.startsWith("7") && digits.length === 9) digits = `962${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** https://wa.me/<digits>?text=… (or a share link without a number). */
export function buildWaLink(phone: string | null | undefined, text: string): string {
  const to = normalizePhoneForWa(phone);
  const q = `text=${encodeURIComponent(text)}`;
  return to ? `https://wa.me/${to}?${q}` : `https://wa.me/?${q}`;
}

/**
 * Queue a message. Stub: always resolves to the wa.me fallback. The signature
 * and result shape are the contract 1C keeps when it swaps the implementation.
 */
export async function enqueueMessage(input: EnqueueMessageInput): Promise<EnqueueMessageResult> {
  if (!input.body.trim()) return { status: "skipped", reason: "EMPTY_BODY" };
  const to = normalizePhoneForWa(input.to);
  if (!to) return { status: "skipped", reason: "NO_PHONE" };
  return { status: "fallback", waLink: buildWaLink(to, input.body) };
}

/** Bulk helper: one result per input, in order. Never throws. */
export async function enqueueMessages(inputs: EnqueueMessageInput[]): Promise<EnqueueMessageResult[]> {
  const out: EnqueueMessageResult[] = [];
  for (const input of inputs) {
    try {
      out.push(await enqueueMessage(input));
    } catch {
      out.push({ status: "fallback", waLink: buildWaLink(input.to, input.body) });
    }
  }
  return out;
}
