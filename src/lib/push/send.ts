// ═══════════════════════════════════════════════════════════════════════════
// Web Push sender (server only). Wraps the `web-push` package (ESM, loaded
// lazily so importing this module never pulls it into a client bundle) and
// classifies push-service responses.
// ═══════════════════════════════════════════════════════════════════════════

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export type PushOutcome =
  /** Accepted by the push service. */
  | { endpoint: string; kind: "delivered"; status: number }
  /** Subscription no longer exists (404/410): delete it. */
  | { endpoint: string; kind: "gone"; status: number }
  /** Temporary (429, 5xx, network): try again later. */
  | { endpoint: string; kind: "retry"; status: number | null; error: string }
  /** Permanent for this request (bad keys, payload, VAPID mismatch). */
  | { endpoint: string; kind: "failed"; status: number | null; error: string };

export type PushSendFn = (target: PushTarget, payload: string, vapid: VapidDetails, topic?: string) => Promise<{ statusCode: number }>;

/** Maps an HTTP status from the push service to what we do next. */
export function classifyPushStatus(status: number | null | undefined): PushOutcome["kind"] {
  if (status == null) return "retry";
  if (status >= 200 && status < 300) return "delivered";
  if (status === 404 || status === 410) return "gone";
  if (status === 429 || status >= 500 || status === 408) return "retry";
  return "failed";
}

/** RFC 8030 Topic: ≤32 URL-safe base64 chars. */
export function pushTopic(tag: string | null | undefined): string | undefined {
  if (!tag) return undefined;
  const t = tag.replace(/[^A-Za-z0-9_-]/g, "").slice(-32);
  return t || undefined;
}

let cachedSend: PushSendFn | null = null;

/** Default sender backed by the `web-push` package. */
export async function webPushSender(): Promise<PushSendFn> {
  if (cachedSend) return cachedSend;
  const lib = await import("web-push");
  const send: PushSendFn = async (target, payload, vapid, topic) => {
    const res = await lib.sendNotification(target, payload, {
      vapidDetails: vapid,
      TTL: 60 * 60 * 6,
      urgency: "high",
      contentEncoding: "aes128gcm",
      timeout: 8000,
      ...(topic ? { topic } : {}),
    });
    return { statusCode: res.statusCode };
  };
  cachedSend = send;
  return send;
}

function statusOf(err: unknown): number | null {
  const s = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof s === "number" ? s : null;
}

function messageOf(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return (typeof m === "string" ? m : String(err)).slice(0, 200);
}

/** Sends one payload to one device; never throws. */
export async function sendToTarget(
  send: PushSendFn,
  target: PushTarget,
  payload: string,
  vapid: VapidDetails,
  topic?: string,
): Promise<PushOutcome> {
  try {
    const res = await send(target, payload, vapid, topic);
    const kind = classifyPushStatus(res.statusCode);
    if (kind === "delivered" || kind === "gone") return { endpoint: target.endpoint, kind, status: res.statusCode };
    return { endpoint: target.endpoint, kind, status: res.statusCode, error: `HTTP ${res.statusCode}` };
  } catch (err) {
    const status = statusOf(err);
    const kind = status == null ? "retry" : classifyPushStatus(status);
    if (kind === "delivered" || kind === "gone") return { endpoint: target.endpoint, kind, status: status ?? 0 };
    return { endpoint: target.endpoint, kind, status, error: messageOf(err) };
  }
}
