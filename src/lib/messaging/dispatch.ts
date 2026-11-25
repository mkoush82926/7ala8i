// ═══════════════════════════════════════════════════════════════════════════
// The dispatcher: claims due outbox rows (messaging_claim), sends them
// through the configured providers and records the outcome
// (messaging_complete). Runs every minute from the dispatch-messages Edge
// Function (or any cron) via POST /api/messaging/dispatch.
//
// Rules enforced here (the claim RPC enforces quiet hours, opt-out and
// staleness):
//   • WhatsApp 24-hour session rule: free-form text only while the client's
//     last inbound message is under 24h old; otherwise an approved template;
//     otherwise the message cannot go over WhatsApp.
//   • SMS fallback when WhatsApp fails and the shop enabled it.
//   • No provider at all: the row becomes "fallback" (wa.me by staff).
// ═══════════════════════════════════════════════════════════════════════════
import { activeProviders, templateApproved, type MessagingConfig } from "./config";
import { maskForLog } from "./phone";
import { sendSms, sendWhatsAppTemplate, sendWhatsAppText, type FetchLike, type SendOutcome } from "./providers";
import { META_TEMPLATES, renderMessage } from "./templates";
import type { ClaimResult, ClaimedMessage, OutboxChannel, RpcClient } from "./types";

export interface CompleteArgs {
  p_id: string;
  p_result: "sent" | "failed" | "retry" | "fallback";
  p_provider: string | null;
  p_provider_msg_id: string | null;
  p_channel: OutboxChannel | null;
  p_cost_fils: number;
  p_error: string | null;
  p_retry_at: string | null;
}

export const MAX_ATTEMPTS = 5;

function retryAt(attempts: number, now: Date): string {
  // 1, 2, 4, 8 … minutes.
  return new Date(now.getTime() + Math.min(60, 2 ** Math.max(0, attempts - 1)) * 60_000).toISOString();
}

function outcomeToComplete(
  msg: ClaimedMessage,
  r: SendOutcome,
  channel: OutboxChannel,
  cost: number,
  now: Date,
): CompleteArgs {
  if (r.ok) {
    return {
      p_id: msg.id,
      p_result: "sent",
      p_provider: r.provider,
      p_provider_msg_id: r.providerMsgId,
      p_channel: channel,
      p_cost_fils: cost,
      p_error: null,
      p_retry_at: null,
    };
  }
  const retry = r.retryable && msg.attempts < MAX_ATTEMPTS;
  return {
    p_id: msg.id,
    p_result: retry ? "retry" : "fallback",
    p_provider: r.provider,
    p_provider_msg_id: null,
    p_channel: retry ? null : "wa_link",
    p_cost_fils: 0,
    p_error: r.error,
    p_retry_at: retry ? retryAt(msg.attempts, now) : null,
  };
}

/** Decides how one message goes out and sends it. Never throws. */
export async function sendOne(
  msg: ClaimedMessage,
  cfg: MessagingConfig,
  fetchImpl: FetchLike,
  now: Date = new Date(),
): Promise<CompleteArgs> {
  const text = renderMessage(msg, cfg.siteUrl);
  if (!text) {
    return { p_id: msg.id, p_result: "failed", p_provider: null, p_provider_msg_id: null, p_channel: null, p_cost_fils: 0, p_error: "EMPTY_BODY", p_retry_at: null };
  }
  const smsAllowed = !!cfg.sms && (msg.channel === "sms" || msg.sms_fallback);

  if (msg.channel !== "sms" && cfg.whatsapp) {
    let wa: SendOutcome;
    let cost = 0;
    if (msg.session_open) {
      // Inside the customer-service window: free-form, no template fee.
      wa = await sendWhatsAppText(cfg, msg.to, text, fetchImpl);
    } else if (META_TEMPLATES[msg.template] && templateApproved(cfg, msg.template)) {
      wa = await sendWhatsAppTemplate(cfg, msg, fetchImpl);
      cost = msg.category === "marketing" ? cfg.cost.waMarketing : cfg.cost.waUtility;
    } else {
      wa = { ok: false, provider: "whatsapp-cloud", retryable: false, error: "OUTSIDE_SESSION" };
    }
    if (wa.ok) return outcomeToComplete(msg, wa, "whatsapp", cost, now);
    if (smsAllowed) {
      const sms = await sendSms(cfg, msg.to, text, fetchImpl);
      if (sms.ok) return outcomeToComplete(msg, sms, "sms", cfg.cost.sms, now);
    }
    return outcomeToComplete(msg, wa, "whatsapp", 0, now);
  }

  if (cfg.sms && (msg.channel === "sms" || msg.sms_fallback || !cfg.whatsapp)) {
    const sms = await sendSms(cfg, msg.to, text, fetchImpl);
    return outcomeToComplete(msg, sms, "sms", sms.ok ? cfg.cost.sms : 0, now);
  }

  return {
    p_id: msg.id,
    p_result: "fallback",
    p_provider: "wa_link",
    p_provider_msg_id: null,
    p_channel: "wa_link",
    p_cost_fils: 0,
    p_error: "NO_PROVIDER",
    p_retry_at: null,
  };
}

export interface DispatchSummary {
  live: boolean;
  providers: string[];
  claimed: number;
  sent: number;
  retried: number;
  fallback: number;
  failed: number;
  deferred: number;
  skipped: number;
  cancelled: number;
  recovered: number;
}

export interface DispatchDeps {
  client: RpcClient;
  config: MessagingConfig;
  fetch?: FetchLike;
  limit?: number;
  now?: () => Date;
  log?: (line: string) => void;
}

function parseClaim(data: unknown): ClaimResult {
  const d = (data ?? {}) as Partial<ClaimResult>;
  return {
    claimed: Array.isArray(d.claimed) ? (d.claimed as ClaimedMessage[]) : [],
    fallback: Number(d.fallback ?? 0),
    deferred: Number(d.deferred ?? 0),
    skipped: Number(d.skipped ?? 0),
    cancelled: Number(d.cancelled ?? 0),
    recovered: Number(d.recovered ?? 0),
  };
}

export async function runDispatch(deps: DispatchDeps): Promise<DispatchSummary> {
  const providers = activeProviders(deps.config);
  const live = providers.length > 0;
  const fetchImpl: FetchLike = deps.fetch ?? ((input, init) => fetch(input, init));
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  const { data, error } = await deps.client.rpc("messaging_claim", { p_limit: deps.limit ?? 50, p_live: live });
  if (error) throw new Error(`messaging_claim failed: ${error.message ?? "unknown"}`);
  const claim = parseClaim(data);

  const summary: DispatchSummary = {
    live,
    providers,
    claimed: claim.claimed.length,
    sent: 0,
    retried: 0,
    fallback: claim.fallback,
    failed: 0,
    deferred: claim.deferred,
    skipped: claim.skipped,
    cancelled: claim.cancelled,
    recovered: claim.recovered,
  };

  for (const msg of claim.claimed) {
    let args: CompleteArgs;
    try {
      args = await sendOne(msg, deps.config, fetchImpl, now());
    } catch {
      args = { p_id: msg.id, p_result: "retry", p_provider: null, p_provider_msg_id: null, p_channel: null, p_cost_fils: 0, p_error: "DISPATCH_ERROR", p_retry_at: null };
    }
    const done = await deps.client.rpc("messaging_complete", args as unknown as Record<string, unknown>);
    if (done.error) log(`[messaging] complete failed for ${msg.id}`);
    if (args.p_result === "sent") summary.sent++;
    else if (args.p_result === "retry") summary.retried++;
    else if (args.p_result === "fallback") summary.fallback++;
    else summary.failed++;
    if (args.p_result !== "sent") log(`[messaging] ${msg.template} to ${maskForLog(msg.to)}: ${args.p_result} ${args.p_error ?? ""}`.trim());
  }

  await deps.client.rpc("messaging_heartbeat", { p_providers: providers, p_result: summary });
  return summary;
}
