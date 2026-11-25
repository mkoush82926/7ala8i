import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock }, from: vi.fn(), rpc: rpcMock }),
}));

const { POST } = await import("./route");
const { __resetIdempotencyStore } = await import("./idempotency");
const { __resetRateLimitMemory, __resetRateLimitClient } = await import("@/lib/rate-limit");
const { toRpcArgs, CreateBookingV2Schema } = await import("./schema");
// These cases cover the direct RPC path; gateway.test.ts covers the service-role gateway.
const { __setBookingGatewayClient } = await import("./gateway");
__setBookingGatewayClient(null);

const SHOP = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-8222-222222222222";
const VARIANT = "44444444-4444-4444-8444-444444444444";

const v2Payload = {
  shopId: SHOP,
  items: [{ serviceId: SERVICE, variantId: VARIANT, note: "Keep the length" }],
  barberId: "any",
  clientName: "Ahmad Test",
  clientPhone: "0791234567",
  startTime: "2026-09-01T10:00:00.000Z",
  src: "IG_Bio",
  entry: "profile_sticky",
};

const booking = {
  appointment_id: "appt-1",
  barber_id: "b",
  start_time: v2Payload.startTime,
  end_time: "2026-09-01T10:30:00.000Z",
  price: 10,
  currency: "JOD",
  service_name: "Haircut",
  status: "pending",
};

let ipCounter = 0;
function post(body: unknown, ip = `10.0.0.${++ipCounter}`) {
  return new NextRequest("http://localhost/api/booking", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": ip },
  });
}

const ENV_KEYS = ["NEXT_PUBLIC_OTP_MODE", "OTP_PROVIDER", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  rpcMock.mockReset();
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: null } });
  __resetIdempotencyStore();
  __resetRateLimitMemory();
  __resetRateLimitClient(null);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("toRpcArgs", () => {
  it("keeps the legacy 8-argument shape for legacy payloads", () => {
    const input = CreateBookingV2Schema.parse({ ...v2Payload, items: undefined, src: undefined, entry: undefined, serviceIds: [SERVICE, SERVICE] });
    expect(Object.keys(toRpcArgs(input)).sort()).toEqual(
      ["p_barber_id", "p_client_name", "p_client_phone", "p_notes", "p_service_ids", "p_shop_id", "p_source", "p_start_time"].sort(),
    );
    expect(toRpcArgs(input).p_service_ids).toEqual([SERVICE]);
    expect(toRpcArgs(input).p_source).toBe("online");
  });

  it("adds items, attribution and tokens for v2", () => {
    const args = toRpcArgs(CreateBookingV2Schema.parse({ ...v2Payload, otpToken: "abc123", captchaToken: "x" }));
    expect(args.p_items).toEqual([{ service_id: SERVICE, variant_id: VARIANT, note: "Keep the length" }]);
    expect(args.p_service_ids).toEqual([SERVICE]);
    expect(args.p_source).toBe("ig_bio");
    expect(args.p_entry).toBe("profile_sticky");
    expect(args.p_otp_token).toBe("abc123");
    expect(args.p_barber_id).toBeNull();
  });

  it("rejects an empty selection and bad attribution", () => {
    expect(CreateBookingV2Schema.safeParse({ ...v2Payload, items: [] }).success).toBe(false);
    expect(CreateBookingV2Schema.safeParse({ ...v2Payload, src: "<script>" }).success).toBe(false);
  });
});

describe("POST /api/booking v2", () => {
  it("passes items + src + entry to create_public_booking", async () => {
    rpcMock.mockResolvedValue({ data: booking, error: null });
    const res = await post(v2Payload);
    expect((await POST(res)).status).toBe(201);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_public_booking",
      expect.objectContaining({ p_items: expect.any(Array), p_source: "ig_bio", p_entry: "profile_sticky" }),
    );
  });

  it("blocks a burst of 100 attempts from one IP after the threshold", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "SLOT_TAKEN" } });
    const statuses: number[] = [];
    for (let i = 0; i < 100; i++) {
      statuses.push((await POST(post({ ...v2Payload, clientPhone: `07912${String(i).padStart(5, "0")}` }, "9.9.9.9"))).status);
    }
    expect(statuses.filter((s) => s === 429).length).toBe(80);
    expect(statuses.slice(0, 20).every((s) => s === 409)).toBe(true);
    expect(rpcMock).toHaveBeenCalledTimes(20);
  });

  it("requires a Turnstile token when Turnstile is configured", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site";
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: false }) }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(post({ ...v2Payload, captchaToken: "bad" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CAPTCHA_FAILED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires phone verification when OTP is on, and accepts an OTP token", async () => {
    process.env.NEXT_PUBLIC_OTP_MODE = "hook";
    process.env.OTP_PROVIDER = "log";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    rpcMock.mockResolvedValue({ data: booking, error: null });

    const blocked = await POST(post(v2Payload));
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe("OTP_REQUIRED");

    const ok = await POST(post({ ...v2Payload, otpToken: "abcdef0123" }));
    expect(ok.status).toBe(201);
    expect(rpcMock).toHaveBeenCalledWith("create_public_booking", expect.objectContaining({ p_otp_token: "abcdef0123" }));
  });

  it("accepts a signed-in user with a confirmed matching phone in supabase mode", async () => {
    process.env.NEXT_PUBLIC_OTP_MODE = "supabase";
    getUserMock.mockResolvedValue({ data: { user: { id: "u", phone: "962791234567", phone_confirmed_at: "2026-01-01" } } });
    rpcMock.mockResolvedValue({ data: booking, error: null });
    expect((await POST(post(v2Payload))).status).toBe(201);
  });

  it("maps OTP_INVALID from the RPC", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "OTP_INVALID" } });
    const res = await POST(post({ ...v2Payload, otpToken: "abcdef" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("OTP_INVALID");
  });
});
