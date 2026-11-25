// ═══════════════════════════════════════════════════════════════════════════
// Web Push configuration (server). Everything is optional: with no VAPID keys
// the feature reports "not configured" and nothing errors.
//
//   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY  URL-safe base64 P-256 public key
//   VAPID_PRIVATE_KEY                                 matching private key (server only)
//   VAPID_SUBJECT                                     mailto: or https: contact (optional)
//   PUSH_DISPATCH_SECRET                              shared secret for /api/push/dispatch (pg_net kick)
//   CRON_SECRET                                       Vercel Cron bearer token (optional)
//   SUPABASE_SERVICE_ROLE_KEY                         dispatcher reads the outbox with it
//
// Generate keys once: npx web-push generate-vapid-keys
// ═══════════════════════════════════════════════════════════════════════════

export interface PushEnvSource {
  VAPID_PUBLIC_KEY?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  PUSH_DISPATCH_SECRET?: string;
  CRON_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

export interface PushConfig {
  publicKey: string | null;
  privateKey: string | null;
  subject: string;
  dispatchSecret: string | null;
  cronSecret: string | null;
  serviceRoleKey: string | null;
  /** VAPID keys present and plausible: devices may subscribe. */
  vapidConfigured: boolean;
  /** The server can drain the outbox (service role key). Push needs VAPID too; WhatsApp does not. */
  dispatchConfigured: boolean;
}

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

function clean(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? s : null;
}

/** An uncompressed P-256 public key is 65 bytes → 87 base64url chars. */
export function isPlausibleVapidPublicKey(key: string | null | undefined): key is string {
  return !!key && B64URL.test(key) && key.replace(/=+$/, "").length >= 86 && key.replace(/=+$/, "").length <= 88;
}

/** A P-256 private key is 32 bytes → 43 base64url chars. */
export function isPlausibleVapidPrivateKey(key: string | null | undefined): key is string {
  return !!key && B64URL.test(key) && key.replace(/=+$/, "").length >= 42 && key.replace(/=+$/, "").length <= 44;
}

/** VAPID needs a mailto: or https: subject. Falls back to the site URL. */
export function resolveVapidSubject(subject: string | null, siteUrl: string | null): string {
  if (subject && /^(mailto:|https:\/\/)/i.test(subject)) return subject;
  if (siteUrl && /^https:\/\//i.test(siteUrl)) return siteUrl.replace(/\/+$/, "");
  return "https://halaqy.jo";
}

export function readPushConfig(env: PushEnvSource = process.env as PushEnvSource): PushConfig {
  const publicKey = clean(env.VAPID_PUBLIC_KEY) ?? clean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = clean(env.VAPID_PRIVATE_KEY);
  const vapidConfigured = isPlausibleVapidPublicKey(publicKey) && isPlausibleVapidPrivateKey(privateKey);
  const serviceRoleKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    publicKey: isPlausibleVapidPublicKey(publicKey) ? publicKey : null,
    privateKey: vapidConfigured ? privateKey : null,
    subject: resolveVapidSubject(clean(env.VAPID_SUBJECT), clean(env.NEXT_PUBLIC_SITE_URL)),
    dispatchSecret: clean(env.PUSH_DISPATCH_SECRET),
    cronSecret: clean(env.CRON_SECRET),
    serviceRoleKey,
    vapidConfigured,
    dispatchConfigured: !!serviceRoleKey,
  };
}

/** Public, client-safe view returned by GET /api/push/config. */
export interface PublicPushConfig {
  /** Devices may subscribe (VAPID keys set). */
  configured: boolean;
  publicKey: string | null;
  /** The server can deliver queued alerts (service role key set). */
  delivery: boolean;
}

export function publicPushConfig(cfg: PushConfig): PublicPushConfig {
  return {
    configured: cfg.vapidConfigured,
    publicKey: cfg.vapidConfigured ? cfg.publicKey : null,
    delivery: cfg.dispatchConfigured,
  };
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * Who may call /api/push/dispatch: the pg_net kick (x-push-secret) or
 * Vercel Cron (Authorization: Bearer CRON_SECRET). Nobody when neither is set.
 */
export function isDispatchAuthorized(headers: Pick<Headers, "get">, cfg: PushConfig): boolean {
  const secret = headers.get("x-push-secret");
  if (cfg.dispatchSecret && safeEqual(secret, cfg.dispatchSecret)) return true;
  const auth = headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (cfg.cronSecret && safeEqual(bearer, cfg.cronSecret)) return true;
  if (cfg.dispatchSecret && safeEqual(bearer, cfg.dispatchSecret)) return true;
  return false;
}
