import { z } from "zod";

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** POST /api/push/subscribe — mirrors push_subscribe()'s own checks. */
export const PushSubscribeSchema = z.object({
  endpoint: z.string().trim().max(1024).regex(/^https:\/\//),
  keys: z.object({
    p256dh: z.string().min(20).max(202).regex(B64URL),
    auth: z.string().min(8).max(102).regex(B64URL),
  }),
  locale: z.enum(["en", "ar"]).default("ar"),
  oldEndpoint: z.string().trim().max(1024).regex(/^https:\/\//).nullish(),
});
export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>;

/** DELETE /api/push/subscribe */
export const PushUnsubscribeSchema = z.object({
  endpoint: z.string().trim().min(1).max(1024),
});

/** POST /api/push/test */
export const PushTestSchema = z.object({
  locale: z.enum(["en", "ar"]).default("ar"),
});

/** Keeps the stored user agent short and free of control characters. */
export function cleanUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const s = ua.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 512);
  return s || null;
}
