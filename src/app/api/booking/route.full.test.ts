import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

const getUserMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn();
const rateLimitMock = vi.fn(async () => ({ success: true, remaining: 4, retryAfter: 60, source: "memory" as const }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimit: rateLimitMock };
});

// Imported after the mocks above so the route picks them up.
const { GET, POST } = await import("./route");
const { __resetIdempotencyStore } = await import("./idempotency");

const SHOP = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-8222-222222222222";
const BARBER = "33333333-3333-4333-8333-333333333333";

const validPayload = {
  shopId: SHOP,
  serviceIds: [SERVICE],
  barberId: null,
  clientName: "Ahmad Test",
  clientPhone: "+962791234567",
  startTime: "2026-09-01T10:00:00.000Z",
  source: "online",
};

const bookingResult = {
  appointment_id: "appt-1",
  barber_id: BARBER,
  start_time: "2026-09-01T10:00:00.000Z",
  end_time: "2026-09-01T10:30:00.000Z",
  price: 10,
  currency: "JOD",
  service_name: "Haircut",
  status: "pending",
};

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/booking", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "x-forwarded-for": "1.2.3.4", ...headers },
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
  fromMock.mockReset();
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 4, retryAfter: 60, source: "memory" });
  __resetIdempotencyStore();
});

describe("GET /api/booking", () => {
  it("returns 400 when shopId is missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/booking"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed date", async () => {
    const res = await GET(new NextRequest(`http://localhost/api/booking?shopId=${SHOP}&date=01-09-2026`));
    expect(res.status).toBe(400);
  });

  it("returns shop data and busy slots from get_busy_slots (never reads appointments)", async () => {
    const profiles = createQueryBuilder({ data: [{ id: "b1", full_name: "Sam" }], error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "shops") return createQueryBuilder({ data: { id: SHOP, name: "Halaqy" }, error: null });
      if (table === "services") return createQueryBuilder({ data: [{ id: "s1" }], error: null });
      if (table === "profiles") return profiles;
      throw new Error(`unexpected table ${table}`);
    });
    rpcMock.mockResolvedValue({ data: [{ barber_id: "b1", start_time: "x", end_time: "y" }], error: null });

    const res = await GET(new NextRequest(`http://localhost/api/booking?shopId=${SHOP}&date=2026-09-01`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop).toEqual({ id: SHOP, name: "Halaqy" });
    expect(body.services).toEqual([{ id: "s1" }]);
    expect(body.barbers).toEqual([{ id: "b1", full_name: "Sam" }]);
    expect(body.appointments).toHaveLength(1);
    expect(rpcMock).toHaveBeenCalledWith("get_busy_slots", { p_shop_id: SHOP, p_day: "2026-09-01", p_barber_id: null });
    expect(profiles.in).toHaveBeenCalledWith("role", ["barber", "shop_admin"]);
    expect(profiles.select).toHaveBeenCalledWith("id, full_name, avatar_url");
    expect(fromMock).not.toHaveBeenCalledWith("appointments");
  });

  it("returns 404 when the shop does not exist", async () => {
    fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: null }));
    const res = await GET(new NextRequest(`http://localhost/api/booking?shopId=${SHOP}`));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("SHOP_NOT_FOUND");
  });

  it("returns 500 without leaking internals when a query throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("db unreachable");
    });
    const res = await GET(new NextRequest(`http://localhost/api/booking?shopId=${SHOP}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("db unreachable");
  });

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfter: 30, source: "memory" });
    const res = await GET(new NextRequest(`http://localhost/api/booking?shopId=${SHOP}`));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/booking", () => {
  it("creates a booking via create_public_booking and returns 201 with the DB result", async () => {
    rpcMock.mockResolvedValue({ data: bookingResult, error: null });

    const res = await POST(postRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ success: true, appointment_id: "appt-1", booking: bookingResult });
    expect(rpcMock).toHaveBeenCalledWith("create_public_booking", {
      p_shop_id: SHOP,
      p_client_name: "Ahmad Test",
      p_client_phone: "+962791234567",
      p_service_ids: [SERVICE],
      p_barber_id: null,
      p_start_time: validPayload.startTime,
      p_source: "online",
      p_notes: null,
    });
  });

  it("never sends client-supplied price or end time", async () => {
    rpcMock.mockResolvedValue({ data: bookingResult, error: null });
    await POST(postRequest({ ...validPayload, totalPrice: 0.01, endTime: "2026-09-01T23:00:00.000Z" }));
    const args = rpcMock.mock.calls[0][1];
    expect(args).not.toHaveProperty("p_total_price");
    expect(args).not.toHaveProperty("p_end_time");
  });

  it("checks the rate limit before any other network call", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfter: 42, source: "memory" });
    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 400 with field errors for an invalid payload", async () => {
    const res = await POST(postRequest({ ...validPayload, clientPhone: "bad" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors.clientPhone).toBeDefined();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-JSON body", async () => {
    const res = await POST(postRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("requires at least one service", async () => {
    const res = await POST(postRequest({ ...validPayload, serviceIds: [] }));
    expect(res.status).toBe(400);
  });

  it("maps barberId 'any' to null", async () => {
    rpcMock.mockResolvedValue({ data: bookingResult, error: null });
    await POST(postRequest({ ...validPayload, barberId: "any" }));
    expect(rpcMock).toHaveBeenCalledWith("create_public_booking", expect.objectContaining({ p_barber_id: null }));
  });

  it("passes a concrete barber through", async () => {
    rpcMock.mockResolvedValue({ data: bookingResult, error: null });
    await POST(postRequest({ ...validPayload, barberId: BARBER }));
    expect(rpcMock).toHaveBeenCalledWith("create_public_booking", expect.objectContaining({ p_barber_id: BARBER }));
  });

  it("maps SLOT_TAKEN to 409 with its code", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "SLOT_TAKEN" } });
    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SLOT_TAKEN");
  });

  it("maps SLOT_IN_PAST to 422", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "SLOT_IN_PAST" } });
    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(422);
  });

  it("returns a generic 500 and does not leak an unknown RPC error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "secret internals", details: "table x" } });
    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("secret internals");
    expect(text).not.toContain("table x");
  });

  it("never uses a service-role client or writes to clients", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    rpcMock.mockResolvedValue({ data: bookingResult, error: null });
    await POST(postRequest(validPayload));
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("replays the stored result for a repeated Idempotency-Key instead of booking twice", async () => {
    rpcMock.mockResolvedValue({ data: bookingResult, error: null });
    const key = "0b5a9a52-7d8e-4c1e-9d0b-6f1f2a3b4c5d";

    const first = await POST(postRequest(validPayload, { "idempotency-key": key }));
    const second = await POST(postRequest(validPayload, { "idempotency-key": key }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect((await second.json()).appointment_id).toBe("appt-1");
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight RPC between concurrent requests with the same key", async () => {
    let resolve!: (v: unknown) => void;
    rpcMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const key = "1b5a9a52-7d8e-4c1e-9d0b-6f1f2a3b4c5d";

    const a = POST(postRequest(validPayload, { "idempotency-key": key }));
    const b = POST(postRequest(validPayload, { "idempotency-key": key }));
    await new Promise((r) => setTimeout(r, 0));
    resolve({ data: bookingResult, error: null });

    const [ra, rb] = await Promise.all([a, b]);
    expect([ra.status, rb.status].sort()).toEqual([200, 201]);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("does not remember failures, so a retry with the same key runs again", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "SLOT_TAKEN" } })
      .mockResolvedValueOnce({ data: bookingResult, error: null });
    const key = "2b5a9a52-7d8e-4c1e-9d0b-6f1f2a3b4c5d";

    const first = await POST(postRequest(validPayload, { "idempotency-key": key }));
    const second = await POST(postRequest(validPayload, { "idempotency-key": key }));
    expect(first.status).toBe(409);
    expect(second.status).toBe(201);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("returns 500 on an unexpected exception", async () => {
    rpcMock.mockRejectedValue(new Error("boom"));
    const res = await POST(postRequest(validPayload));
    expect(res.status).toBe(500);
  });
});
