import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const userRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock }, from: vi.fn(), rpc: userRpc }),
}));

const { POST } = await import("./route");
const { gatewayArgs, __setBookingGatewayClient } = await import("./gateway");
const { __resetIdempotencyStore } = await import("./idempotency");
const { __resetRateLimitMemory, __resetRateLimitClient } = await import("@/lib/rate-limit");

const SHOP = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const payload = {
  shopId: SHOP,
  items: [{ serviceId: SERVICE }],
  barberId: "any",
  clientName: "Ahmad Test",
  clientPhone: "0791234567",
  startTime: "2026-09-01T10:00:00.000Z",
};
const booking = { appointment_id: "appt-1", barber_id: "b", start_time: payload.startTime, end_time: payload.startTime, price: 10, currency: "JOD", service_name: "Cut", status: "pending" };

let ip = 0;
const post = (body: unknown, from = `10.1.0.${++ip}`) =>
  new NextRequest("http://localhost/api/booking", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": from } });

const ENV = ["NEXT_PUBLIC_OTP_MODE", "OTP_PROVIDER", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  userRpc.mockReset();
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: null } });
  __resetIdempotencyStore();
  __resetRateLimitMemory();
  __resetRateLimitClient(null);
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __setBookingGatewayClient(undefined);
});

describe("gatewayArgs", () => {
  it("adds the actor and a usable client IP in front of the RPC args", () => {
    expect(gatewayArgs({ p_shop_id: SHOP }, USER, " 203.0.113.9 ")).toEqual({ p_actor: USER, p_client_ip: "203.0.113.9", p_shop_id: SHOP });
    expect(gatewayArgs({}, null, "unknown")).toEqual({ p_actor: null, p_client_ip: null });
    expect(gatewayArgs({}, undefined, "x".repeat(100)).p_client_ip).toHaveLength(64);
  });
});

describe("POST /api/booking through the trusted gateway", () => {
  it("calls create_public_booking_gateway with the signed-in user and the client IP", async () => {
    const gwRpc = vi.fn().mockResolvedValue({ data: booking, error: null });
    __setBookingGatewayClient({ rpc: gwRpc });
    getUserMock.mockResolvedValue({ data: { user: { id: USER } } });
    const res = await POST(post(payload, "198.51.100.7"));
    expect(res.status).toBe(201);
    expect(userRpc).not.toHaveBeenCalled();
    expect(gwRpc).toHaveBeenCalledWith(
      "create_public_booking_gateway",
      expect.objectContaining({ p_actor: USER, p_client_ip: "198.51.100.7", p_shop_id: SHOP, p_client_phone: "0791234567" }),
    );
  });

  it("still enforces the OTP gate before the gateway", async () => {
    process.env.NEXT_PUBLIC_OTP_MODE = "supabase";
    const gwRpc = vi.fn();
    __setBookingGatewayClient({ rpc: gwRpc });
    // A confirmed phone in another country that shares the last 9 digits does not count.
    getUserMock.mockResolvedValue({ data: { user: { id: USER, phone: "9647791234567", phone_confirmed_at: "2026-01-01" } } });
    const res = await POST(post(payload));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("OTP_REQUIRED");
    expect(gwRpc).not.toHaveBeenCalled();
  });

  it("falls back to the direct RPC without a service-role key", async () => {
    __setBookingGatewayClient(null);
    userRpc.mockResolvedValue({ data: booking, error: null });
    expect((await POST(post(payload))).status).toBe(201);
    expect(userRpc).toHaveBeenCalledWith("create_public_booking", expect.any(Object));
  });

  it("maps OTP_REQUIRED raised by the database", async () => {
    __setBookingGatewayClient(null);
    userRpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "OTP_REQUIRED" } });
    const res = await POST(post(payload));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("OTP_REQUIRED");
  });
});
