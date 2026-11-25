// ═══════════════════════════════════════════════════════════════════════════
// WS-1C messaging feature flags. Everything is optional: with nothing set the
// outbox still fills, the dispatcher marks due rows "fallback" and the
// dashboard offers wa.me click-to-send links.
//
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID   Cloud API sender (shared with 1D OTP)
//   WHATSAPP_TEMPLATE_PREFIX                   approved template name prefix (default "halaqy_")
//   WHATSAPP_TEMPLATES_APPROVED                comma list of approved template ids, or "all"
//   WHATSAPP_APP_SECRET                        webhook signature (X-Hub-Signature-256)
//   WHATSAPP_VERIFY_TOKEN                      webhook subscription handshake
//   UNIFONIC_APP_SID, UNIFONIC_SENDER_ID       SMS sender (shared with 1D OTP)
//   MESSAGING_SMS_WEBHOOK_SECRET               inbound SMS webhook (?secret=)
//   MESSAGING_CRON_SECRET (or CRON_SECRET)     bearer for /api/messaging/dispatch
//   MESSAGING_COST_FILS_WA_UTILITY / _WA_MARKETING / _SMS   cost tracking (fils)
//   SUPABASE_SERVICE_ROLE_KEY                  dispatcher + webhooks
//   NEXT_PUBLIC_SITE_URL                       links in messages
// ═══════════════════════════════════════════════════════════════════════════
import type { TemplateId } from "./types";

export interface MessagingEnv {
  NODE_ENV?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_TEMPLATE_PREFIX?: string;
  WHATSAPP_TEMPLATES_APPROVED?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  UNIFONIC_APP_SID?: string;
  UNIFONIC_SENDER_ID?: string;
  MESSAGING_SMS_WEBHOOK_SECRET?: string;
  MESSAGING_CRON_SECRET?: string;
  CRON_SECRET?: string;
  MESSAGING_COST_FILS_WA_UTILITY?: string;
  MESSAGING_COST_FILS_WA_MARKETING?: string;
  MESSAGING_COST_FILS_SMS?: string;
}

export function readMessagingEnv(): MessagingEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_TEMPLATE_PREFIX: process.env.WHATSAPP_TEMPLATE_PREFIX,
    WHATSAPP_TEMPLATES_APPROVED: process.env.WHATSAPP_TEMPLATES_APPROVED,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    UNIFONIC_APP_SID: process.env.UNIFONIC_APP_SID,
    UNIFONIC_SENDER_ID: process.env.UNIFONIC_SENDER_ID,
    MESSAGING_SMS_WEBHOOK_SECRET: process.env.MESSAGING_SMS_WEBHOOK_SECRET,
    MESSAGING_CRON_SECRET: process.env.MESSAGING_CRON_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    MESSAGING_COST_FILS_WA_UTILITY: process.env.MESSAGING_COST_FILS_WA_UTILITY,
    MESSAGING_COST_FILS_WA_MARKETING: process.env.MESSAGING_COST_FILS_WA_MARKETING,
    MESSAGING_COST_FILS_SMS: process.env.MESSAGING_COST_FILS_SMS,
  };
}

const s = (v: string | undefined) => (v ?? "").trim();

export interface MessagingConfig {
  whatsapp: { token: string; phoneNumberId: string; prefix: string; approved: "all" | Set<string> } | null;
  sms: { appSid: string; senderId: string } | null;
  siteUrl: string;
  cronSecret: string | null;
  cost: { waUtility: number; waMarketing: number; sms: number };
}

function fils(v: string | undefined, d: number): number {
  const n = Number.parseInt(s(v), 10);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : d;
}

export function resolveMessagingConfig(env: MessagingEnv): MessagingConfig {
  const token = s(env.WHATSAPP_TOKEN);
  const phoneNumberId = s(env.WHATSAPP_PHONE_NUMBER_ID);
  const approvedRaw = s(env.WHATSAPP_TEMPLATES_APPROVED).toLowerCase();
  const approved: "all" | Set<string> =
    approvedRaw === "all" ? "all" : new Set(approvedRaw.split(",").map((x) => x.trim()).filter(Boolean));
  const appSid = s(env.UNIFONIC_APP_SID);
  return {
    whatsapp: token && phoneNumberId ? { token, phoneNumberId, prefix: s(env.WHATSAPP_TEMPLATE_PREFIX) || "halaqy_", approved } : null,
    sms: appSid ? { appSid, senderId: s(env.UNIFONIC_SENDER_ID) || "Halaqy" } : null,
    siteUrl: s(env.NEXT_PUBLIC_SITE_URL) || "https://halaqy.com",
    cronSecret: s(env.MESSAGING_CRON_SECRET) || s(env.CRON_SECRET) || null,
    cost: {
      waUtility: fils(env.MESSAGING_COST_FILS_WA_UTILITY, 12),
      waMarketing: fils(env.MESSAGING_COST_FILS_WA_MARKETING, 45),
      sms: fils(env.MESSAGING_COST_FILS_SMS, 25),
    },
  };
}

/** Provider names reported to messaging_heartbeat(). */
export function activeProviders(cfg: MessagingConfig): string[] {
  return [...(cfg.whatsapp ? ["whatsapp-cloud"] : []), ...(cfg.sms ? ["sms-unifonic"] : [])];
}

export function templateApproved(cfg: MessagingConfig, template: TemplateId): boolean {
  if (!cfg.whatsapp) return false;
  return cfg.whatsapp.approved === "all" || cfg.whatsapp.approved.has(template);
}
