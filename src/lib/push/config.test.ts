import { describe, expect, it } from "vitest";
import {
  isDispatchAuthorized,
  isPlausibleVapidPrivateKey,
  isPlausibleVapidPublicKey,
  publicPushConfig,
  readPushConfig,
  resolveVapidSubject,
  safeEqual,
} from "./config";

const PUB = "B" + "A".repeat(86);
const PRIV = "C".repeat(43);

describe("push config", () => {
  it("is off with no env", () => {
    const cfg = readPushConfig({});
    expect(cfg.vapidConfigured).toBe(false);
    expect(cfg.dispatchConfigured).toBe(false);
    expect(publicPushConfig(cfg)).toEqual({ configured: false, publicKey: null, delivery: false });
  });

  it("validates key shapes", () => {
    expect(isPlausibleVapidPublicKey(PUB)).toBe(true);
    expect(isPlausibleVapidPublicKey("short")).toBe(false);
    expect(isPlausibleVapidPrivateKey(PRIV)).toBe(true);
    expect(isPlausibleVapidPrivateKey(PUB)).toBe(false);
  });

  it("reads keys, prefers VAPID_PUBLIC_KEY and never leaks the private key", () => {
    const cfg = readPushConfig({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: PRIV, SUPABASE_SERVICE_ROLE_KEY: "srk" });
    expect(cfg.vapidConfigured).toBe(true);
    expect(cfg.dispatchConfigured).toBe(true);
    const pub = publicPushConfig(cfg);
    expect(pub).toEqual({ configured: true, publicKey: PUB, delivery: true });
    expect(JSON.stringify(pub)).not.toContain(PRIV);
  });

  it("can deliver WhatsApp without VAPID", () => {
    const cfg = readPushConfig({ SUPABASE_SERVICE_ROLE_KEY: "srk" });
    expect(cfg.vapidConfigured).toBe(false);
    expect(cfg.dispatchConfigured).toBe(true);
  });

  it("resolves the VAPID subject", () => {
    expect(resolveVapidSubject("mailto:a@b.c", null)).toBe("mailto:a@b.c");
    expect(resolveVapidSubject("nope", "https://x.jo/")).toBe("https://x.jo");
    expect(resolveVapidSubject(null, "http://localhost")).toBe("https://halaqy.jo");
  });

  it("authorizes the dispatcher only with a matching secret", () => {
    const cfg = readPushConfig({ PUSH_DISPATCH_SECRET: "s3cret", CRON_SECRET: "cron" });
    const h = (o: Record<string, string>) => new Headers(o);
    expect(isDispatchAuthorized(h({}), cfg)).toBe(false);
    expect(isDispatchAuthorized(h({ "x-push-secret": "wrong" }), cfg)).toBe(false);
    expect(isDispatchAuthorized(h({ "x-push-secret": "s3cret" }), cfg)).toBe(true);
    expect(isDispatchAuthorized(h({ authorization: "Bearer cron" }), cfg)).toBe(true);
    expect(isDispatchAuthorized(h({ authorization: "Bearer s3cret" }), cfg)).toBe(true);
    expect(isDispatchAuthorized(h({ authorization: "Bearer " }), readPushConfig({}))).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });
});
