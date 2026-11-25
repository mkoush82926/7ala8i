// ═══════════════════════════════════════════════════════════════════════════
// Browser side of staff Web Push (WS-1K): feature detection, service worker
// registration, subscribe / unsubscribe and the self-test. Pure helpers are
// exported separately so they can be unit-tested without a browser.
// ═══════════════════════════════════════════════════════════════════════════
import type { PublicPushConfig } from "./config";

export const SERVICE_WORKER_URL = "/sw.js";

export type DevicePlatform = "ios" | "android" | "desktop";

/** iPadOS reports a Mac UA; touch points give it away. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): DevicePlatform {
  const ua = userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export type PushAvailability =
  /** No VAPID keys on the server. */
  | "unconfigured"
  /** iOS Safari tab: push needs the app on the Home Screen first. */
  | "ios_needs_install"
  /** Browser has no Push API. */
  | "unsupported"
  /** The person blocked notifications for this site. */
  | "denied"
  | "available";

export interface AvailabilityInput {
  configured: boolean;
  supported: boolean;
  platform: DevicePlatform;
  standalone: boolean;
  permission: NotificationPermission | "unsupported";
}

export function pushAvailability(i: AvailabilityInput): PushAvailability {
  if (!i.configured) return "unconfigured";
  // iOS 16.4+ exposes PushManager only inside an installed web app.
  if (i.platform === "ios" && !i.standalone) return "ios_needs_install";
  if (!i.supported) return "unsupported";
  if (i.permission === "denied") return "denied";
  return "available";
}

/** VAPID public key (base64url) → the BufferSource PushManager wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Shape POSTed to /api/push/subscribe. */
export interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  locale: "en" | "ar";
  oldEndpoint?: string | null;
}

export function toSubscribeBody(
  json: { endpoint?: string; keys?: Record<string, string> } | null | undefined,
  locale: string,
  oldEndpoint?: string | null,
): SubscribeBody | null {
  const endpoint = json?.endpoint;
  const p256dh = json?.keys?.p256dh;
  const auth = json?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth }, locale: locale === "en" ? "en" : "ar", ...(oldEndpoint ? { oldEndpoint } : {}) };
}

// ─── Browser-only ──────────────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export function currentPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "desktop";
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

export function currentPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

export async function fetchPushConfig(): Promise<PublicPushConfig> {
  try {
    const res = await fetch("/api/push/config", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { data?: PublicPushConfig } & Partial<PublicPushConfig>;
    const cfg = body.data ?? body;
    return { configured: !!cfg.configured, publicKey: cfg.publicKey ?? null, delivery: !!cfg.delivery };
  } catch {
    return { configured: false, publicKey: null, delivery: false };
  }
}

/** Registers /sw.js once (idempotent). Resolves null where unsupported. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  } catch {
    return null;
  }
}

export async function getDeviceSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export class PushClientError extends Error {
  constructor(public code: "UNSUPPORTED" | "DENIED" | "NOT_CONFIGURED" | "SUBSCRIBE_FAILED" | "SERVER" | "RATE_LIMITED") {
    super(code);
  }
}

async function postJson(url: string, method: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = ((await res.json()) as { code?: string }).code;
    } catch {
      /* ignore */
    }
    throw new PushClientError(code === "RATE_LIMITED" ? "RATE_LIMITED" : "SERVER");
  }
}

/** Asks for permission (must run inside a user gesture), subscribes and saves the device. */
export async function subscribeDevice(publicKey: string | null, locale: string): Promise<PushSubscription> {
  if (!publicKey) throw new PushClientError("NOT_CONFIGURED");
  if (!isPushSupported()) throw new PushClientError("UNSUPPORTED");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushClientError("DENIED");

  const reg = (await registerServiceWorker()) ?? null;
  if (!reg) throw new PushClientError("UNSUPPORTED");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  const key = urlBase64ToUint8Array(publicKey);
  // A subscription made with an old VAPID key cannot receive our pushes.
  if (sub && sub.options.applicationServerKey) {
    const current = new Uint8Array(sub.options.applicationServerKey);
    if (current.length !== key.length || current.some((b, i) => b !== key[i])) {
      await sub.unsubscribe().catch(() => undefined);
      sub = null;
    }
  }
  try {
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch {
    throw new PushClientError("SUBSCRIBE_FAILED");
  }
  const body = toSubscribeBody(sub.toJSON(), locale);
  if (!body) throw new PushClientError("SUBSCRIBE_FAILED");
  await postJson("/api/push/subscribe", "POST", body);
  return sub;
}

/** Removes this device on the server and in the browser. */
export async function unsubscribeDevice(): Promise<void> {
  const sub = await getDeviceSubscription();
  if (!sub) return;
  await postJson("/api/push/subscribe", "DELETE", { endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => undefined);
}

/** Re-sends this device's subscription (e.g. after the language changed). */
export async function syncDeviceLocale(locale: string): Promise<void> {
  const sub = await getDeviceSubscription();
  const body = toSubscribeBody(sub?.toJSON(), locale);
  if (body) await postJson("/api/push/subscribe", "POST", body).catch(() => undefined);
}

export async function sendTestPush(locale: string): Promise<void> {
  await postJson("/api/push/test", "POST", { locale: locale === "en" ? "en" : "ar" });
}
