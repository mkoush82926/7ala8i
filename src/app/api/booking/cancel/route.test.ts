import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: rpcMock }),
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/booking/cancel", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/booking/cancel", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("rejects an invalid appointment_id before calling the RPC", async () => {
    const res = await POST(makeRequest({ appointment_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("cancels a valid appointment", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      data: { cancelled: true, appointment_id: "11111111-1111-4111-8111-111111111111" },
    });
  });

  it("maps a 'not found' RPC error to 404", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Appointment not found" } });
    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps other RPC errors (e.g. already cancelled) to 400", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Cannot cancel an appointment with status completed" },
    });
    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected errors", async () => {
    rpcMock.mockRejectedValue(new Error("boom"));
    const res = await POST(
      makeRequest({ appointment_id: "11111111-1111-4111-8111-111111111111" }),
    );
    expect(res.status).toBe(500);
  });
});
