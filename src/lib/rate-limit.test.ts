// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  rateLimit,
  rateLimitKey,
  getClientIp,
  __resetRateLimitMemory,
  __resetRateLimitClient,
} from "./rate-limit";

describe("rateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    __resetRateLimitMemory();
    __resetRateLimitClient(null); // force the memory store
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request for a fresh identifier", async () => {
    const result = await rateLimit("ip:test-1", 5);
    expect(result).toMatchObject({ success: true, remaining: 4, source: "memory" });
  });

  it("decrements remaining on each request within the window", async () => {
    const id = "ip:test-2";
    await rateLimit(id, 3);
    await rateLimit(id, 3);
    const third = await rateLimit(id, 3);
    expect(third).toMatchObject({ success: true, remaining: 0 });
  });

  it("rejects requests once the limit is exceeded and reports retryAfter", async () => {
    const id = "ip:test-3";
    await rateLimit(id, 2, 60);
    await rateLimit(id, 2, 60);
    vi.setSystemTime(10_000);
    const third = await rateLimit(id, 2, 60);
    expect(third).toMatchObject({ success: false, remaining: 0, retryAfter: 50 });
  });

  it("resets the count once the window elapses", async () => {
    const id = "ip:test-5";
    await rateLimit(id, 1, 60);
    expect((await rateLimit(id, 1, 60)).success).toBe(false);

    vi.setSystemTime(60_001);

    expect(await rateLimit(id, 1, 60)).toMatchObject({ success: true, remaining: 0 });
  });

  it("honours a custom window length", async () => {
    const id = "ip:window";
    await rateLimit(id, 1, 5);
    expect((await rateLimit(id, 1, 5)).success).toBe(false);
    vi.setSystemTime(5_001);
    expect((await rateLimit(id, 1, 5)).success).toBe(true);
  });

  it("tracks separate identifiers independently", async () => {
    await rateLimit("ip:a", 1);
    const blocked = await rateLimit("ip:a", 1);
    const other = await rateLimit("ip:b", 1);

    expect(blocked.success).toBe(false);
    expect(other.success).toBe(true);
  });

  it("defaults to 10 requests per 60 seconds", async () => {
    const id = "ip:test-default";
    for (let i = 0; i < 10; i++) {
      expect((await rateLimit(id)).success).toBe(true);
    }
    expect((await rateLimit(id)).success).toBe(false);
  });
});

describe("rateLimit (DB store)", () => {
  beforeEach(() => {
    __resetRateLimitMemory();
  });

  it("uses check_rate_limit with a hashed key when a client is available", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    __resetRateLimitClient({ rpc } as never);

    const result = await rateLimit("booking:1.2.3.4", 5, 60);

    expect(result).toMatchObject({ success: false, source: "db", remaining: null });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("check_rate_limit");
    expect(args.p_max).toBe(5);
    expect(args.p_window_seconds).toBe(60);
    expect(args.p_key).toMatch(/^booking:[0-9a-f]{40}$/);
    expect(args.p_key).not.toContain("1.2.3.4");
  });

  it("falls back to memory when the DB call fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    __resetRateLimitClient({ rpc } as never);

    const result = await rateLimit("booking:x", 5, 60);
    expect(result).toMatchObject({ success: true, source: "memory" });
    // Backs off: the next call does not hit the DB again.
    await rateLimit("booking:x", 5, 60);
    expect(rpc).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("rateLimitKey", () => {
  it("joins non-empty parts, lowercased and trimmed", () => {
    expect(rateLimitKey("booking", " 1.2.3.4 ", null, undefined, "", "ABC")).toBe("booking:1.2.3.4:abc");
  });
});

describe("getClientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/api", { headers });

  it("prefers x-vercel-forwarded-for, then x-real-ip", () => {
    expect(getClientIp(req({ "x-vercel-forwarded-for": "9.9.9.9", "x-real-ip": "8.8.8.8" }))).toBe("9.9.9.9");
    expect(getClientIp(req({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))).toBe("8.8.8.8");
  });

  it("takes the first x-forwarded-for entry", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
  });

  it("returns 'unknown' when no header is present", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
