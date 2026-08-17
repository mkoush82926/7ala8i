import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request for a fresh identifier", () => {
    const result = rateLimit("ip:test-1", 5);
    expect(result).toEqual({ success: true, remaining: 4 });
  });

  it("decrements remaining on each request within the window", () => {
    const id = "ip:test-2";
    rateLimit(id, 3);
    rateLimit(id, 3);
    const third = rateLimit(id, 3);
    expect(third).toEqual({ success: true, remaining: 0 });
  });

  it("rejects requests once the limit is exceeded", () => {
    const id = "ip:test-3";
    rateLimit(id, 2);
    rateLimit(id, 2);
    const third = rateLimit(id, 2);
    expect(third).toEqual({ success: false, remaining: 0 });
  });

  it("keeps rejecting further requests in the same window after the limit is hit", () => {
    const id = "ip:test-4";
    rateLimit(id, 1);
    rateLimit(id, 1);
    const fourth = rateLimit(id, 1);
    expect(fourth.success).toBe(false);
  });

  it("resets the count once the window elapses", () => {
    const id = "ip:test-5";
    rateLimit(id, 1);
    expect(rateLimit(id, 1).success).toBe(false);

    vi.setSystemTime(60_001);

    expect(rateLimit(id, 1)).toEqual({ success: true, remaining: 0 });
  });

  it("tracks separate identifiers independently", () => {
    rateLimit("ip:a", 1);
    const blocked = rateLimit("ip:a", 1);
    const other = rateLimit("ip:b", 1);

    expect(blocked.success).toBe(false);
    expect(other.success).toBe(true);
  });

  it("defaults maxRequests to 10 when not provided", () => {
    const id = "ip:test-default";
    for (let i = 0; i < 10; i++) {
      expect(rateLimit(id).success).toBe(true);
    }
    expect(rateLimit(id).success).toBe(false);
  });
});
