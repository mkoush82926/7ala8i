// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  RATE_LIMITS,
  rateLimitAll,
  rateLimitKey,
  __resetRateLimitMemory,
  __resetRateLimitClient,
} from "./rate-limit";

describe("rateLimitAll + presets", () => {
  beforeEach(() => {
    __resetRateLimitMemory();
    __resetRateLimitClient(null);
  });

  it("blocks 100 booking attempts per minute from one IP after the threshold", async () => {
    const ip = "203.0.113.7";
    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      const r = await rateLimitAll([{ key: rateLimitKey("booking", "ip", ip), rule: "bookingIp" }]);
      if (r.success) allowed++;
    }
    expect(allowed).toBe(RATE_LIMITS.bookingIp.max);
  });

  it("stops at the first failing limit and reports its key", async () => {
    const phoneKey = rateLimitKey("booking", "phone", "962790000000");
    for (let i = 0; i < RATE_LIMITS.bookingPhone.max; i++) {
      await rateLimitAll([{ key: phoneKey, rule: "bookingPhone" }]);
    }
    const r = await rateLimitAll([
      { key: rateLimitKey("booking", "ip", "198.51.100.1"), rule: "bookingIp" },
      { key: phoneKey, rule: "bookingPhone" },
    ]);
    expect(r.success).toBe(false);
    expect(r.failedKey).toBe(phoneKey);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("skips checks without a key and accepts inline rules", async () => {
    const r = await rateLimitAll([
      { key: null, rule: "otpPhone" },
      { key: "custom:1", rule: { max: 1, windowSec: 10 } },
    ]);
    expect(r.success).toBe(true);
    const again = await rateLimitAll([{ key: "custom:1", rule: { max: 1, windowSec: 10 } }]);
    expect(again.success).toBe(false);
  });
});
