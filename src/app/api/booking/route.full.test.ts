import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

const getUserMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn();
const rateLimitMock = vi.fn(() => ({ success: true, remaining: 4 }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
}));

// Imported after the mocks above so the route picks them up.
const { GET, POST } = await import("./route");

const validPayload = {
  shopId: "11111111-1111-4111-8111-111111111111",
  clientName: "Ahmad Test",
  clientPhone: "+962791234567",
  startTime: "2026-09-01T10:00:00.000Z",
  endTime: "2026-09-01T10:30:00.000Z",
};

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/booking", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "1.2.3.4" },
  });
}

describe("GET /api/booking", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns 400 when shopId is missing", async () => {
    const req = new NextRequest("http://localhost/api/booking");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns shop, services, barbers, and appointments for a given shop + date", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "shops") return createQueryBuilder({ data: { id: "shop-1", name: "Lumina" }, error: null });
      if (table === "services") return createQueryBuilder({ data: [{ id: "s1" }], error: null });
      if (table === "profiles") return createQueryBuilder({ data: [{ id: "b1" }], error: null });
      if (table === "appointments") return createQueryBuilder({ data: [{ start_time: "x", end_time: "y", barber_id: "b1" }], error: null });
      throw new Error(`unexpected table ${table}`);
    });

    const req = new NextRequest("http://localhost/api/booking?shopId=shop-1&date=2026-09-01");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop).toEqual({ id: "shop-1", name: "Lumina" });
    expect(body.services).toEqual([{ id: "s1" }]);
    expect(body.barbers).toEqual([{ id: "b1" }]);
    expect(body.appointments).toHaveLength(1);
  });

  it("returns 500 when a downstream query throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("db unreachable");
    });

    const req = new NextRequest("http://localhost/api/booking?shopId=shop-1");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/booking", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    rateLimitMock.mockReset();
    rateLimitMock.mockReturnValue({ success: true, remaining: 4 });
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("creates a booking for a guest with no authenticated session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    rpcMock.mockResolvedValue({ data: "appt-guest", error: null });

    const res = await POST(postRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, appointment_id: "appt-guest" });
    expect(rpcMock).toHaveBeenCalledWith(
      "create_public_booking",
      expect.objectContaining({ p_shop_id: validPayload.shopId, p_client_name: validPayload.clientName }),
    );
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    rateLimitMock.mockReturnValue({ success: false, remaining: 0 });

    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(429);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(postRequest({ ...validPayload, clientPhone: "bad" }));
    expect(res.status).toBe(400);
  });

  it("creates a booking via RPC and returns the appointment id", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    rpcMock.mockResolvedValue({ data: "appt-1", error: null });

    const res = await POST(postRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, appointment_id: "appt-1" });
    expect(rpcMock).toHaveBeenCalledWith(
      "create_public_booking",
      expect.objectContaining({ p_shop_id: validPayload.shopId, p_client_name: validPayload.clientName }),
    );
  });

  it("maps barberId 'any' to null when calling the RPC", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpcMock.mockResolvedValue({ data: "appt-1", error: null });

    await POST(postRequest({ ...validPayload, barberId: "any" }));

    expect(rpcMock).toHaveBeenCalledWith(
      "create_public_booking",
      expect.objectContaining({ p_barber_id: null }),
    );
  });

  it("returns 500 when the RPC fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(500);
  });

  it("links the client record to the user's email via the service-role client when configured", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    rpcMock.mockResolvedValue({ data: "appt-1", error: null });

    const apptBuilder = createQueryBuilder({ data: { client_id: "client-1" }, error: null });
    const updateBuilder = createQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(apptBuilder).mockReturnValueOnce(updateBuilder);

    const res = await POST(postRequest(validPayload));

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com" }),
    );
  });

  it("returns 500 on an unexpected exception", async () => {
    getUserMock.mockRejectedValue(new Error("boom"));
    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(500);
  });
});
