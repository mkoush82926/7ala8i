// Server-only messaging plumbing: the service-role client and the webhook
// event processors. Never import this from client components.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MessagingEnv } from "./config";
import type { InboundEvent, ParsedWhatsApp } from "./webhook";
import type { RpcClient } from "./types";

let cached: SupabaseClient | null | undefined;

/** Service-role client, or null when SUPABASE_SERVICE_ROLE_KEY / URL are unset. */
export function messagingAdminClient(env: MessagingEnv): RpcClient | null {
  if (cached !== undefined) return cached as unknown as RpcClient | null;
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!key || !url) return (cached = null);
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached as unknown as RpcClient;
}

/** Test hook. */
export function __setMessagingAdminClient(client: RpcClient | null | undefined) {
  cached = client as unknown as SupabaseClient | null | undefined;
}

export interface ProcessSummary {
  statuses: number;
  messages: number;
  actions: Record<string, number>;
  errors: number;
}

export async function processInbound(client: RpcClient, events: InboundEvent[], channel: "whatsapp" | "sms", summary: ProcessSummary) {
  for (const m of events) {
    const { data, error } = await client.rpc("messaging_handle_inbound", {
      p_from: m.from,
      p_body: m.body,
      p_button_payload: m.buttonPayload,
      p_provider_msg_id: m.providerMsgId,
      p_context_msg_id: m.contextMsgId,
      p_channel: channel,
    });
    if (error) {
      summary.errors++;
      continue;
    }
    summary.messages++;
    const action = String((data as { action?: unknown } | null)?.action ?? "none");
    summary.actions[action] = (summary.actions[action] ?? 0) + 1;
  }
}

export async function processWhatsApp(client: RpcClient, parsed: ParsedWhatsApp): Promise<ProcessSummary> {
  const summary: ProcessSummary = { statuses: 0, messages: 0, actions: {}, errors: 0 };
  for (const s of parsed.statuses) {
    const { error } = await client.rpc("messaging_record_status", {
      p_provider_msg_id: s.providerMsgId,
      p_status: s.status,
      p_error: s.error,
      p_at: s.at,
    });
    if (error) summary.errors++;
    else summary.statuses++;
  }
  await processInbound(client, parsed.messages, "whatsapp", summary);
  return summary;
}
