// Standard Webhooks signature check, used by Supabase Auth hooks
// (Send SMS hook). Server only (node:crypto).
import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/** Tolerance for webhook-timestamp drift, in seconds. */
export const WEBHOOK_TOLERANCE_SEC = 5 * 60;

/** "v1,whsec_BASE64" | "whsec_BASE64" | "BASE64" → key bytes (null if unusable). */
export function webhookKey(secret: string | null | undefined): Buffer | null {
  let s = (secret ?? "").trim();
  if (!s) return null;
  if (s.startsWith("v1,")) s = s.slice(3);
  if (s.startsWith("whsec_")) s = s.slice(6);
  try {
    const key = Buffer.from(s, "base64");
    return key.length >= 16 ? key : null;
  } catch {
    return null;
  }
}

export function signWebhook(key: Buffer, id: string, timestamp: string, body: string): string {
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifyWebhook(
  body: string,
  headers: WebhookHeaders,
  secret: string | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  const key = webhookKey(secret);
  if (!key || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > WEBHOOK_TOLERANCE_SEC) return false;

  const expected = Buffer.from(signWebhook(key, headers.id, headers.timestamp, body));
  return headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .some((part) => {
      const given = Buffer.from(part.slice(3));
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
}
