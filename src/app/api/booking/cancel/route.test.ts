import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const rateLimitMock = vi.fn(async () => ({ success: true, remaining: 10, retryAfter: 3600, source: "memory" as const }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: rpcMock }),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimit: rateLimitMock };
});

const { POST } = await import("./route");

const ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/booking/cancel", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/booking/cancel", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rateLimitMock.mockReset();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 10, retryAfter: 3600, source: "memory" });
  });

  it("rejects an invalid appointment_id before calling the RPC", async () => {
    const res = await POST(makeRequest({ appointment_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("is rate limited before the RPC", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfter: 100, source: "memory" });
    const res = await POST(makeRequest({ appointment_id: ID }));
    expect(res.status).toBe(429);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("cancels and returns the RPC object, passing the reason", async () => {
    const result = { appointment_id: ID, status: "cancelled", cancelled_at: "2026-09-01T10:00:00Z" };
    rpcMock.mockResolvedValue({ data: result, error: null });
    const res = await POST(makeRequest({ appointment_id: ID, reason: "rescheduled" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: result });
    expect(rpcMock).toHaveBeenCalledWith("cancel_customer_booking", { p_appointment_id: ID, p_reason: "rescheduled" });
  });

  it("sends a null reason when none is given", async () => {
    rpcMock.mockResolvedValue({ data: { appointment_id: ID, status: "cancelled", cancelled_at: "x" }, error: null });
    await POST(makeRequest({ appointment_id: ID }));
    expect(rpcMock).toHaveBeenCalledWith("cancel_customer_booking", { p_appointment_id: ID, p_reason: null });
  });

  it("maps APPT_NOT_FOUND to 404", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "APPT_NOT_FOUND" } });
    const res = await POST(makeRequest({ appointment_id: ID }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("APPT_NOT_FOUND");
  });

  it("maps INSIDE_CANCELLATION_WINDOW to 409 and exposes the policy hours", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "INSIDE_CANCELLATION_WINDOW", details: "24" },
    });
    const res = await POST(makeRequest({ appointment_id: ID }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INSIDE_CANCELLATION_WINDOW");
    expect(body.policyHours).toBe(24);
  });

  it("maps NOT_AUTHENTICATED to 401", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "NOT_AUTHENTICATED" } });
    const res = await POST(makeRequest({ appointment_id: ID }));
    expect(res.status).toBe(401);
  });

  it("returns a generic 500 for unknown errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "internal detail" } });
    const res = await POST(makeRequest({ appointment_id: ID }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal detail");
  });

  it("returns 500 on exceptions", async () => {
    rpcMock.mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest({ appointment_id: ID }));
    expect(res.status).toBe(500);
  });
});
