// ═══════════════════════════════════════════════════════════════════════════
// Staff notification dispatcher (WS-1K, server only).
//
// Drains public.staff_push_outbox with the service role:
//   push_claim_jobs(limit) → for each job: Web Push to every device of the
//   recipient (copy in the device's language) → WhatsApp through the 1C
//   enqueue_message() RPC when push did not reach any device and the
//   recipient enabled WhatsApp for that event → push_complete_jobs(results).
//
// Triggered by: the pg_net kick on outbox insert (/api/push/dispatch),
// Vercel Cron, and schedulePushDispatch() right after an in-app mutation.
// Without SUPABASE_SERVICE_ROLE_KEY it is a no-op; without VAPID keys it
// still delivers the WhatsApp fallback.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { enqueueMessage } from "@/lib/messaging-stub";
import { readPushConfig, type PushConfig } from "./config";
import { staffPushDict } from "./dict";
import { isStaffPushEvent, type StaffOutboxEvent } from "./events";
import {
  buildStaffPushMessage,
  buildStaffWhatsAppText,
  toPushPayload,
  type PushLocale,
  type StaffJobPayload,
  type StaffPushDict,
} from "./messages";
import { pushTopic, sendToTarget, webPushSender, type PushOutcome, type PushSendFn, type VapidDetails } from "./send";

/** Same cap as push_complete_jobs(): a 5th failed attempt is final. */
export const MAX_ATTEMPTS = 5;

export interface RpcClientLike {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export interface ClaimedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  locale?: string | null;
}

export interface ClaimedJob {
  id: string;
  event: StaffOutboxEvent;
  shop_id: string;
  profile_id: string;
  appointment_id: string | null;
  payload: StaffJobPayload | null;
  attempts: number;
  push_enabled: boolean;
  whatsapp_enabled: boolean;
  phone: string | null;
  recipient_name?: string | null;
  subscriptions: ClaimedSubscription[];
}

export type WhatsAppOutcome = "queued" | "fallback" | "skipped" | "error" | "not_attempted";

export interface JobResult {
  id: string;
  status: "sent" | "failed" | "skipped" | "retry";
  error?: string;
  result: { push: Record<PushOutcome["kind"], number>; whatsapp: WhatsAppOutcome };
  delivered: string[];
  gone: string[];
  failed: string[];
}

export interface WhatsAppRequest {
  shopId: string;
  to: string;
  body: string;
  locale: PushLocale;
  appointmentId: string | null;
  dedupeKey: string;
}

export interface DispatchDeps {
  /** Null when VAPID is not configured: push is skipped. */
  send: PushSendFn | null;
  vapid: VapidDetails | null;
  dict: (locale: PushLocale) => StaffPushDict | null;
  whatsapp: (req: WhatsAppRequest) => Promise<WhatsAppOutcome>;
  siteOrigin: string | null;
}

function asLocale(v: unknown): PushLocale {
  return v === "en" ? "en" : "ar";
}

/** Narrows the push_claim_jobs() JSON to well-formed jobs. */
export function parseClaimedJobs(data: unknown): ClaimedJob[] {
  if (!Array.isArray(data)) return [];
  const out: ClaimedJob[] = [];
  for (const raw of data) {
    const j = raw as Partial<ClaimedJob> | null;
    if (!j || typeof j.id !== "string" || typeof j.profile_id !== "string" || typeof j.shop_id !== "string") continue;
    if (!(j.event === "test" || isStaffPushEvent(j.event))) continue;
    const subs = Array.isArray(j.subscriptions)
      ? j.subscriptions.filter(
          (s): s is ClaimedSubscription =>
            !!s && typeof s.endpoint === "string" && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string",
        )
      : [];
    out.push({
      id: j.id,
      event: j.event,
      shop_id: j.shop_id,
      profile_id: j.profile_id,
      appointment_id: typeof j.appointment_id === "string" ? j.appointment_id : null,
      payload: j.payload && typeof j.payload === "object" ? j.payload : {},
      attempts: typeof j.attempts === "number" ? j.attempts : 1,
      push_enabled: j.push_enabled !== false,
      whatsapp_enabled: j.whatsapp_enabled === true,
      phone: typeof j.phone === "string" && j.phone.trim() ? j.phone : null,
      recipient_name: j.recipient_name ?? null,
      subscriptions: subs,
    });
  }
  return out;
}

function emptyCounts(): Record<PushOutcome["kind"], number> {
  return { delivered: 0, gone: 0, retry: 0, failed: 0 };
}

/** Language for WhatsApp: the job's explicit locale, else the newest device, else Arabic. */
export function jobLocale(job: ClaimedJob): PushLocale {
  if (job.payload?.locale === "en" || job.payload?.locale === "ar") return job.payload.locale;
  const last = job.subscriptions[job.subscriptions.length - 1];
  return asLocale(last?.locale);
}

/** Delivers one job. Never throws. */
export async function processJob(job: ClaimedJob, deps: DispatchDeps): Promise<JobResult> {
  const counts = emptyCounts();
  const delivered: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];

  // ── Web Push ──
  if (job.push_enabled && deps.send && deps.vapid && job.subscriptions.length > 0) {
    const outcomes = await Promise.all(
      job.subscriptions.map(async (sub) => {
        const locale = job.event === "test" ? jobLocale(job) : asLocale(sub.locale);
        const dict = deps.dict(locale);
        if (!dict) {
          return { endpoint: sub.endpoint, kind: "failed", status: null, error: "NO_COPY" } as PushOutcome;
        }
        const msg = buildStaffPushMessage(job, locale, dict);
        return sendToTarget(deps.send!, sub, toPushPayload(msg), deps.vapid!, pushTopic(msg.tag));
      }),
    );
    for (const o of outcomes) {
      counts[o.kind] += 1;
      if (o.kind === "delivered") delivered.push(o.endpoint);
      else if (o.kind === "gone") gone.push(o.endpoint);
      else {
        failed.push(o.endpoint);
        errors.push(o.error);
      }
    }
  }

  const pushReached = counts.delivered > 0;
  const finalAttempt = job.attempts >= MAX_ATTEMPTS;

  // A push service hiccup: try again later before falling back to WhatsApp.
  if (!pushReached && counts.retry > 0 && !finalAttempt) {
    return {
      id: job.id,
      status: "retry",
      error: errors[0]?.slice(0, 300),
      result: { push: counts, whatsapp: "not_attempted" },
      delivered,
      gone,
      failed,
    };
  }

  // ── WhatsApp fallback (1C) ──
  let whatsapp: WhatsAppOutcome = "not_attempted";
  if (!pushReached && job.event !== "test" && job.whatsapp_enabled && job.phone) {
    const locale = jobLocale(job);
    const dict = deps.dict(locale);
    if (dict) {
      const msg = buildStaffPushMessage(job, locale, dict);
      const shopName = locale === "ar" ? job.payload?.shop_name_ar || job.payload?.shop_name : job.payload?.shop_name;
      const body = buildStaffWhatsAppText(msg, dict, shopName, deps.siteOrigin);
      try {
        whatsapp = await deps.whatsapp({
          shopId: job.shop_id,
          to: job.phone,
          body,
          locale,
          appointmentId: job.appointment_id,
          dedupeKey: `staff_push:${job.id}`,
        });
      } catch {
        whatsapp = "error";
      }
    } else {
      whatsapp = "error";
    }
  }

  const whatsappOk = whatsapp === "queued" || whatsapp === "fallback";
  let status: JobResult["status"];
  if (pushReached || whatsappOk) status = "sent";
  else if (counts.failed > 0 || counts.retry > 0 || whatsapp === "error") status = "failed";
  else status = "skipped"; // no device, no WhatsApp: nothing to deliver to

  return {
    id: job.id,
    status,
    error: status === "failed" ? (errors[0] ?? (whatsapp === "error" ? "WHATSAPP_FAILED" : undefined))?.slice(0, 300) : undefined,
    result: { push: counts, whatsapp },
    delivered,
    gone,
    failed,
  };
}

// ─── Wiring ────────────────────────────────────────────────────────────────

let adminCache: { key: string; client: RpcClientLike } | null = null;

function adminClient(cfg: PushConfig): RpcClientLike | null {
  if (!cfg.serviceRoleKey || !publicEnv.supabaseUrl) return null;
  if (adminCache?.key === cfg.serviceRoleKey) return adminCache.client;
  const client = createSupabaseClient(publicEnv.supabaseUrl, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RpcClientLike;
  adminCache = { key: cfg.serviceRoleKey, client };
  return client;
}

/** Test hook. */
export function __setPushAdminClient(client: RpcClientLike | null) {
  adminCache = client ? { key: "__test__", client } : null;
}

/** WhatsApp through the 1C outbox (enqueue_message RPC); the stub when 1C is missing. */
export function whatsappViaOutbox(client: RpcClientLike) {
  return async (req: WhatsAppRequest): Promise<WhatsAppOutcome> => {
    const { data, error } = await client.rpc("enqueue_message", {
      p_shop_id: req.shopId,
      p_template: "generic",
      p_to: req.to,
      p_body: req.body,
      p_locale: req.locale,
      p_appointment_id: req.appointmentId,
      p_dedupe_key: req.dedupeKey,
    });
    if (!error) {
      const status = (data as { status?: unknown } | null)?.status;
      if (status === "queued" || status === "fallback" || status === "skipped") return status;
      return "error";
    }
    // 1C not deployed yet: the stub only yields a wa.me link nobody opens server-side.
    const res = await enqueueMessage({
      shopId: req.shopId,
      to: req.to,
      template: "generic",
      body: req.body,
      locale: req.locale,
      appointmentId: req.appointmentId,
    });
    return res.status;
  };
}

function siteOrigin(): string | null {
  const v = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return /^https?:\/\//i.test(v) ? v.replace(/\/+$/, "") : null;
}

export interface DispatchSummary {
  configured: boolean;
  push: boolean;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  retry: number;
  error?: string;
}

/**
 * Drains up to `maxBatches` × `batchSize` jobs. Safe to call concurrently
 * (claims use FOR UPDATE SKIP LOCKED). Never throws.
 */
export async function dispatchStaffPush(
  opts: { batchSize?: number; maxBatches?: number; config?: PushConfig; client?: RpcClientLike; deps?: Partial<DispatchDeps> } = {},
): Promise<DispatchSummary> {
  const cfg = opts.config ?? readPushConfig();
  const summary: DispatchSummary = {
    configured: cfg.dispatchConfigured,
    push: cfg.vapidConfigured,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    retry: 0,
  };
  const client = opts.client ?? adminClient(cfg);
  if (!client) return { ...summary, configured: false };

  try {
    const send = cfg.vapidConfigured ? (opts.deps?.send ?? (await webPushSender())) : null;
    const deps: DispatchDeps = {
      send,
      vapid:
        cfg.vapidConfigured && cfg.publicKey && cfg.privateKey
          ? { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey }
          : null,
      dict: opts.deps?.dict ?? staffPushDict,
      whatsapp: opts.deps?.whatsapp ?? whatsappViaOutbox(client),
      siteOrigin: opts.deps?.siteOrigin ?? siteOrigin(),
    };

    const batchSize = Math.max(1, Math.min(opts.batchSize ?? 50, 200));
    const maxBatches = Math.max(1, Math.min(opts.maxBatches ?? 4, 20));
    for (let b = 0; b < maxBatches; b++) {
      const { data, error } = await client.rpc("push_claim_jobs", { p_limit: batchSize });
      if (error) {
        summary.error = "CLAIM_FAILED";
        break;
      }
      const jobs = parseClaimedJobs(data);
      if (jobs.length === 0) break;
      summary.claimed += jobs.length;

      const results = await Promise.all(jobs.map((j) => processJob(j, deps)));
      for (const r of results) summary[r.status] += 1;

      const done = await client.rpc("push_complete_jobs", { p_results: results });
      if (done.error) {
        summary.error = "COMPLETE_FAILED";
        break;
      }
      if (jobs.length < batchSize) break;
    }
  } catch {
    summary.error = "DISPATCH_FAILED";
  }
  return summary;
}
