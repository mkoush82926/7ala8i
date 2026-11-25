// ═══════════════════════════════════════════════════════════════════════════
// enqueueMessage(): the public entry point other workstreams call (1E notify,
// 1F receipts). Same signature and result shape as the old messaging-stub.
//
//   queued    → accepted by the outbox; the dispatcher sends it
//   fallback  → no live provider (or the RPC failed): open waLink by hand
//   skipped   → nothing to send (no usable phone, empty body, opted out)
//
// Callers compose `body` with the i18n strings (t.*); this module adds no copy.
// ═══════════════════════════════════════════════════════════════════════════
import { buildWaLink, normalizePhoneForWa } from "./phone";
import type { MessageChannel, MessageTemplate, RpcClient } from "./types";

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
  /** Template variables stored with the message. */
  vars?: Record<string, string | number>;
  /** Optional idempotency key (≤200 chars): a retry returns the same row. */
  dedupeKey?: string;
  /** Send later (ISO); defaults to now. */
  scheduledFor?: string;
}

export type SkipReason = "NO_PHONE" | "EMPTY_BODY" | "OPTED_OUT";

export type EnqueueMessageResult =
  /** Accepted by the outbox. */
  | { status: "queued"; id: string }
  /** No provider: open this wa.me link to send by hand. */
  | { status: "fallback"; waLink: string; id?: string }
  /** Nothing to send. */
  | { status: "skipped"; reason: SkipReason };

export interface EnqueueDeps {
  /** Supabase client (or a fake). `null` forces the wa.me fallback. */
  client?: RpcClient | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function defaultClient(): Promise<RpcClient | null> {
  if (typeof window === "undefined") return null;
  try {
    const mod = await import("@/lib/supabase/client");
    return mod.createClient() as unknown as RpcClient;
  } catch {
    return null;
  }
}

/** Queue one message. Never throws. */
export async function enqueueMessage(input: EnqueueMessageInput, deps: EnqueueDeps = {}): Promise<EnqueueMessageResult> {
  const body = (input.body ?? "").trim();
  if (!body) return { status: "skipped", reason: "EMPTY_BODY" };
  const to = normalizePhoneForWa(input.to);
  if (!to) return { status: "skipped", reason: "NO_PHONE" };
  const fallback = (id?: string): EnqueueMessageResult =>
    id ? { status: "fallback", waLink: buildWaLink(to, body), id } : { status: "fallback", waLink: buildWaLink(to, body) };

  if (!UUID.test(input.shopId ?? "")) return fallback();
  const client = deps.client !== undefined ? deps.client : await defaultClient();
  if (!client) return fallback();

  try {
    const { data, error } = await client.rpc("enqueue_message", {
      p_shop_id: input.shopId,
      p_template: input.template,
      p_to: to,
      p_body: body,
      p_locale: input.locale === "en" ? "en" : "ar",
      p_appointment_id: input.appointmentId ?? null,
      p_sale_id: input.saleId ?? null,
      p_channel: input.channel ?? null,
      p_vars: input.vars ?? {},
      p_scheduled_for: input.scheduledFor ?? null,
      p_dedupe_key: input.dedupeKey ?? null,
    });
    if (error || !data) return fallback();
    const d = data as { id?: string | null; status?: string; reason?: string };
    if (d.status === "skipped") {
      const reason: SkipReason = d.reason === "OPTED_OUT" || d.reason === "EMPTY_BODY" ? d.reason : "NO_PHONE";
      return { status: "skipped", reason };
    }
    if ((d.status === "queued" || d.status === "sending" || d.status === "sent") && d.id) return { status: "queued", id: d.id };
    return fallback(d.id ?? undefined);
  } catch {
    return fallback();
  }
}

/** Bulk helper: one result per input, in order. Never throws. */
export async function enqueueMessages(inputs: EnqueueMessageInput[], deps: EnqueueDeps = {}): Promise<EnqueueMessageResult[]> {
  const out: EnqueueMessageResult[] = [];
  for (const input of inputs) {
    try {
      out.push(await enqueueMessage(input, deps));
    } catch {
      out.push({ status: "fallback", waLink: buildWaLink(input.to, input.body) });
    }
  }
  return out;
}
