import { describe, expect, it } from "vitest";
import { classifyPushStatus, pushTopic, sendToTarget, type PushSendFn } from "./send";

const target = { endpoint: "https://push.example/1", keys: { p256dh: "k", auth: "a" } };
const vapid = { subject: "mailto:x@y.z", publicKey: "p", privateKey: "q" };

describe("push send", () => {
  it("classifies statuses", () => {
    expect(classifyPushStatus(201)).toBe("delivered");
    expect(classifyPushStatus(410)).toBe("gone");
    expect(classifyPushStatus(404)).toBe("gone");
    expect(classifyPushStatus(429)).toBe("retry");
    expect(classifyPushStatus(503)).toBe("retry");
    expect(classifyPushStatus(null)).toBe("retry");
    expect(classifyPushStatus(400)).toBe("failed");
    expect(classifyPushStatus(403)).toBe("failed");
  });

  it("builds RFC 8030 topics", () => {
    expect(pushTopic("halaqy-appt-1234")).toBe("halaqy-appt-1234");
    expect(pushTopic("a:b c")).toBe("abc");
    expect(pushTopic("x".repeat(50))).toHaveLength(32);
    expect(pushTopic(null)).toBeUndefined();
  });

  it("never throws and maps library errors", async () => {
    const ok: PushSendFn = async () => ({ statusCode: 201 });
    expect(await sendToTarget(ok, target, "{}", vapid)).toMatchObject({ kind: "delivered", status: 201 });
    const gone: PushSendFn = async () => {
      throw Object.assign(new Error("Gone"), { statusCode: 410 });
    };
    expect(await sendToTarget(gone, target, "{}", vapid)).toMatchObject({ kind: "gone" });
    const net: PushSendFn = async () => {
      throw new Error("ECONNRESET");
    };
    expect(await sendToTarget(net, target, "{}", vapid)).toMatchObject({ kind: "retry", error: "ECONNRESET" });
    const bad: PushSendFn = async () => {
      throw Object.assign(new Error("Bad"), { statusCode: 403 });
    };
    expect(await sendToTarget(bad, target, "{}", vapid)).toMatchObject({ kind: "failed", status: 403 });
  });
});
