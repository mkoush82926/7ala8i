/* Halaqy service worker (WS-1K): staff Web Push.
 *
 * Deliberately has NO fetch handler and caches nothing, so it can never serve
 * a stale page or a stale booking calendar. It only:
 *   - shows push notifications sent by /api/push/dispatch (payload v1, see
 *     src/lib/push/messages.ts → toPushPayload),
 *   - focuses or opens the dashboard when a notification is tapped,
 *   - re-registers the device when the browser rotates the subscription.
 */
"use strict";

const SW_VERSION = "halaqy-sw-1";
const ICON = "/icon-192.png";
const BADGE = "/icon-192.png";
const FALLBACK_TITLE = "Halaqy";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Only same-origin, path-only URLs may be opened from a notification. */
function safePath(url) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return "/";
  return url;
}

function parsePayload(event) {
  if (!event.data) return null;
  try {
    const data = event.data.json();
    return data && typeof data === "object" ? data : null;
  } catch (_) {
    try {
      const text = event.data.text();
      return text ? { title: FALLBACK_TITLE, body: String(text).slice(0, 400) } : null;
    } catch (__) {
      return null;
    }
  }
}

self.addEventListener("push", (event) => {
  const data = parsePayload(event) || {};
  const title = typeof data.title === "string" && data.title ? data.title : FALLBACK_TITLE;
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: ICON,
    badge: BADGE,
    tag: typeof data.tag === "string" ? data.tag : undefined,
    renotify: typeof data.tag === "string",
    lang: data.lang === "en" ? "en" : "ar",
    dir: data.dir === "ltr" ? "ltr" : data.dir === "rtl" ? "rtl" : "auto",
    timestamp: Date.now(),
    vibrate: [120, 60, 120],
    data: {
      url: safePath(data.url),
      event: typeof data.event === "string" ? data.event : null,
      appointmentId: typeof data.appointmentId === "string" ? data.appointmentId : null,
      v: SW_VERSION,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.url);
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        } catch (_) {
          /* try the next window, or open a new one */
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

function guessLocale() {
  const lang = (self.navigator && self.navigator.language) || "";
  return lang.toLowerCase().startsWith("en") ? "en" : "ar";
}

function b64ToBytes(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// The push service rotated or expired the subscription: subscribe again and
// tell the server to replace the old endpoint (session cookie is sent).
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || null;
      let sub = event.newSubscription || null;
      if (!sub) {
        const res = await fetch("/api/push/config", { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        const cfg = (body && body.data) || body || {};
        if (!cfg.configured || !cfg.publicKey) return;
        sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToBytes(cfg.publicKey),
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys) return;
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          locale: guessLocale(),
          oldEndpoint: old ? old.endpoint : null,
        }),
      });
    })().catch(() => undefined),
  );
});
