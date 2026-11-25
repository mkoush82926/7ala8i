import { describe, expect, it } from "vitest";
import { PushSubscribeSchema, PushTestSchema, PushUnsubscribeSchema, cleanUserAgent } from "./schema";

const valid = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };

describe("push API schemas", () => {
  it("accepts a browser subscription and defaults the locale to Arabic", () => {
    const r = PushSubscribeSchema.safeParse(valid);
    expect(r.success && r.data.locale).toBe("ar");
  });
  it("rejects non-https endpoints and malformed keys", () => {
    expect(PushSubscribeSchema.safeParse({ ...valid, endpoint: "http://x" }).success).toBe(false);
    expect(PushSubscribeSchema.safeParse({ ...valid, keys: { p256dh: "short", auth: "a".repeat(22) } }).success).toBe(false);
    expect(PushSubscribeSchema.safeParse({ ...valid, keys: { p256dh: "B".repeat(87), auth: "bad key!" } }).success).toBe(false);
    expect(PushSubscribeSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });
  it("validates unsubscribe and test bodies", () => {
    expect(PushUnsubscribeSchema.safeParse({ endpoint: "" }).success).toBe(false);
    expect(PushTestSchema.parse({})).toEqual({ locale: "ar" });
  });
  it("cleans user agents", () => {
    expect(cleanUserAgent("UA\u0000x")).toBe("UA x");
    expect(cleanUserAgent("x".repeat(600))).toHaveLength(512);
    expect(cleanUserAgent("")).toBeNull();
  });
});
