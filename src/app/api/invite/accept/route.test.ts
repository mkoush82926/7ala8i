import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: rpcMock }),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/invite/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/invite/accept", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("rejects an empty token", async () => {
    const res = await POST(makeRequest({ token: "" }));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an invite that doesn't exist", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Invalid or expired invite" } });
    const res = await POST(makeRequest({ token: "abc123" }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when the caller isn't authenticated", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Not authenticated" } });
    const res = await POST(makeRequest({ token: "abc123" }));
    expect(res.status).toBe(401);
  });

  it("returns 410 for an expired invite", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "This invite has expired" } });
    const res = await POST(makeRequest({ token: "abc123" }));
    expect(res.status).toBe(410);
  });

  it("returns 409 for an already-accepted invite", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "This invite has already been used" } });
    const res = await POST(makeRequest({ token: "abc123" }));
    expect(res.status).toBe(409);
  });

  it("accepts a valid pending invite and returns the shop/role", async () => {
    rpcMock.mockResolvedValue({ data: [{ shop_id: "shop-1", role: "barber" }], error: null });

    const res = await POST(makeRequest({ token: "abc123" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      shopId: "shop-1",
      role: "barber",
      message: "Invite accepted successfully",
    });
    expect(rpcMock).toHaveBeenCalledWith("accept_invite", { p_token: "abc123" });
  });

  it("returns 500 when the request body isn't valid JSON", async () => {
    const badRequest = new NextRequest("http://localhost/api/invite/accept", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(badRequest);
    expect(res.status).toBe(500);
  });
});
