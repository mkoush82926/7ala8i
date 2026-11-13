import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const rpcMock = vi.fn();
const rateLimitMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: rpcMock }),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimitMock(...args) };
});

import { POST } from "./route";

const TOKEN = "0123456789abcdef-token";

function makeRequest(body: unknown, raw = false) {
  return new NextRequest("http://localhost/api/invite/accept", {
    method: "POST",
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { "x-real-ip": "203.0.113.7" },
  });
}

describe("POST /api/invite/accept", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rateLimitMock.mockReset();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9, retryAfter: 60, source: "memory" });
  });

  it("rejects an empty token without calling the RPC", async () => {
    const res = await POST(makeRequest({ token: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a token shorter than 16 characters", async () => {
    const res = await POST(makeRequest({ token: "abc123" }));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body isn't valid JSON", async () => {
    const res = await POST(makeRequest("not json", true));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited, before calling the RPC", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfter: 42, source: "memory" });
    const res = await POST(makeRequest({ token: TOKEN }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("keys the rate limit on the client IP", async () => {
    rpcMock.mockResolvedValue({ data: [{ shop_id: "shop-1", role: "barber" }], error: null });
    await POST(makeRequest({ token: TOKEN }));
    expect(rateLimitMock).toHaveBeenCalledWith("invite-accept:203.0.113.7", 10, 60);
  });

  it.each([
    ["INVITE_INVALID", 404],
    ["NOT_AUTHENTICATED", 401],
    ["INVITE_EXPIRED", 410],
    ["INVITE_USED", 409],
    ["LAST_ADMIN", 409],
    ["RATE_LIMITED", 429],
  ])("maps RPC error %s to %i", async (code, status) => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: code } });
    const res = await POST(makeRequest({ token: TOKEN }));
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, code });
  });

  it("never leaks unexpected database errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: 'relation "invites" does not exist', details: "secret" },
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(makeRequest({ token: TOKEN }));
    errSpy.mockRestore();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("relation");
    expect(text).not.toContain("secret");
  });

  it("returns 404 when the RPC returns no row", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const res = await POST(makeRequest({ token: TOKEN }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("INVITE_INVALID");
  });

  it("accepts a valid pending invite and returns the shop/role", async () => {
    rpcMock.mockResolvedValue({ data: [{ shop_id: "shop-1", role: "barber" }], error: null });

    const res = await POST(makeRequest({ token: TOKEN }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { shopId: "shop-1", role: "barber" } });
    expect(rpcMock).toHaveBeenCalledWith("accept_invite", { p_token: TOKEN });
  });
});
