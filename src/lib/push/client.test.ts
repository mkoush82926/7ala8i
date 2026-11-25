import { describe, expect, it } from "vitest";
import { detectPlatform, pushAvailability, toSubscribeBody, urlBase64ToUint8Array } from "./client";

describe("push client helpers", () => {
  it("detects platforms, including iPadOS desktop UA", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
  });

  it("explains why push is unavailable", () => {
    const base = { configured: true, supported: true, platform: "android" as const, standalone: false, permission: "default" as const };
    expect(pushAvailability(base)).toBe("available");
    expect(pushAvailability({ ...base, configured: false })).toBe("unconfigured");
    expect(pushAvailability({ ...base, platform: "ios", supported: false })).toBe("ios_needs_install");
    expect(pushAvailability({ ...base, platform: "ios", standalone: true })).toBe("available");
    expect(pushAvailability({ ...base, supported: false })).toBe("unsupported");
    expect(pushAvailability({ ...base, permission: "denied" })).toBe("denied");
  });

  it("decodes base64url VAPID keys", () => {
    const bytes = urlBase64ToUint8Array("AQID_-8");
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255, 239]);
  });

  it("builds the subscribe body", () => {
    expect(toSubscribeBody({ endpoint: "https://x", keys: { p256dh: "p", auth: "a" } }, "en")).toEqual({
      endpoint: "https://x",
      keys: { p256dh: "p", auth: "a" },
      locale: "en",
    });
    expect(toSubscribeBody({ endpoint: "https://x", keys: { p256dh: "p", auth: "a" } }, "fr", "https://old")).toMatchObject({ locale: "ar", oldEndpoint: "https://old" });
    expect(toSubscribeBody({ endpoint: "https://x" }, "en")).toBeNull();
    expect(toSubscribeBody(null, "en")).toBeNull();
  });
});
