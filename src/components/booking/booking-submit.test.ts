import { describe, it, expect } from "vitest";
import { buildBookingPayload, errorRoute, freshSlot } from "./booking-state";
import { CreateBookingV2Schema, toRpcArgs } from "@/app/api/booking/schema";

const SHOP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const V1 = "33333333-3333-4333-8333-333333333333";
const B1 = "44444444-4444-4444-8444-444444444444";

const base = {
  shopId: SHOP,
  lines: [
    { serviceId: S1, variantId: V1, note: "  keep length  " },
    { serviceId: S2, variantId: null, note: "" },
  ],
  barber: "any" as string | null,
  name: "  Omar  ",
  phone: "0791234567",
  startIso: "2026-11-20T10:00:00.000Z",
  notes: "",
  src: null as string | null,
  entry: null as string | null,
  otpToken: null as string | null,
  captchaToken: null as string | null,
};

describe("errorRoute", () => {
  it("sends slot problems back to the time step", () => {
    for (const c of ["SLOT_TAKEN", "NO_BARBER_AVAILABLE", "SLOT_IN_PAST", "OUTSIDE_WORKING_HOURS", "TOO_FAR_AHEAD"]) {
      expect(errorRoute(c)).toBe("time");
    }
  });
  it("routes selection, otp and captcha codes", () => {
    expect(errorRoute("SERVICE_INVALID")).toBe("services");
    expect(errorRoute("BARBER_INVALID")).toBe("barber");
    expect(errorRoute("OTP_REQUIRED")).toBe("otp");
    expect(errorRoute("OTP_INVALID")).toBe("otp");
    expect(errorRoute("CAPTCHA_FAILED")).toBe("captcha");
    expect(errorRoute("RATE_LIMITED")).toBe("inline");
    expect(errorRoute(null)).toBe("inline");
  });
});

describe("buildBookingPayload", () => {
  it("builds a v2 body the API schema accepts, with default src=online", () => {
    const body = buildBookingPayload(base);
    expect(body).toEqual({
      shopId: SHOP,
      items: [{ serviceId: S1, variantId: V1, note: "keep length" }, { serviceId: S2 }],
      barberId: null,
      clientName: "Omar",
      clientPhone: "0791234567",
      startTime: base.startIso,
      src: "online",
    });
    const parsed = CreateBookingV2Schema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const args = toRpcArgs(parsed.data);
      expect(args.p_source).toBe("online");
      expect(args.p_items).toEqual([{ service_id: S1, variant_id: V1, note: "keep length" }, { service_id: S2 }]);
      expect(args.p_service_ids).toEqual([S1, S2]);
    }
  });

  it("passes attribution, a specific barber, notes and tokens through", () => {
    const body = buildBookingPayload({
      ...base, barber: B1, src: "ig_story", entry: "service_row", notes: " hi ", otpToken: "abc123", captchaToken: "tok",
    });
    expect(body.barberId).toBe(B1);
    expect(body.src).toBe("ig_story");
    expect(body).toMatchObject({ entry: "service_row", notes: "hi", otpToken: "abc123", captchaToken: "tok" });
    const parsed = CreateBookingV2Schema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const args = toRpcArgs(parsed.data);
      expect(args).toMatchObject({ p_source: "ig_story", p_entry: "service_row", p_otp_token: "abc123", p_barber_id: B1 });
    }
  });
});

describe("freshSlot", () => {
  const now = Date.parse("2026-11-20T09:00:00Z");
  it("keeps future slots and drops past or broken ones", () => {
    expect(freshSlot({ startIso: "2026-11-20T10:00:00Z" }, now)).not.toBeNull();
    expect(freshSlot({ startIso: "2026-11-20T08:59:00Z" }, now)).toBeNull();
    expect(freshSlot({ startIso: "nope" }, now)).toBeNull();
    expect(freshSlot(null, now)).toBeNull();
  });
});
