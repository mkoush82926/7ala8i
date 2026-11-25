import { describe, expect, it } from "vitest";
import {
  bookingCalendarEvent,
  hoursUntil,
  isManageToken,
  manageState,
  parseManageBooking,
  rescheduleDates,
  rpcErrorCode,
  servicesLabel,
} from "./manage";
import {
  allowanceUsage,
  fallbackWaLink,
  filsToJod,
  monthStartIn,
  needsManualSend,
  offsetParts,
  offsetsValid,
  parseMessagingSettings,
  parseMonthCost,
  parseOffsets,
  statusTone,
  toSettingsPayload,
  toggleOffset,
  validateMessagingSettings,
  type OutboxRow,
} from "./dashboard";
import { buildIcs } from "./calendar";

const RAW = {
  appointment_id: "a1",
  status: "pending",
  start_time: "2026-12-05T15:00:00+00:00",
  end_time: "2026-12-05T15:45:00+00:00",
  timezone: "Asia/Amman",
  price: "7.500",
  currency: "JOD",
  client_name: "Ahmad",
  barber: { id: "b1", name: "Samer", avatar_url: null },
  items: [
    { service_id: "s1", name: "Haircut", name_ar: "حلاقة", duration: 30, price: 5 },
    { service_id: "s2", name: "Beard", name_ar: null, duration: 15, price: 2.5 },
  ],
  service_ids: ["s1", "s2"],
  shop: { id: "sh", name: "Elegance", name_ar: "الأناقة", slug: "elegance", address: "Rainbow St", lat: 31.95, lng: 35.93 },
  policy: { hours: 3, fee_percent: 0, deadline: "2026-12-05T12:00:00+00:00" },
  can_confirm: true,
  can_cancel: true,
  can_reschedule: true,
};

describe("manage page helpers", () => {
  it("validates tokens like SQL", () => {
    expect(isManageToken("abcDEF0123456789_-xyzABCD")).toBe(true);
    expect(isManageToken("short")).toBe(false);
    expect(isManageToken("has space in it 12345678901")).toBe(false);
    expect(isManageToken(null)).toBe(false);
  });

  it("parses the token RPC payload", () => {
    const b = parseManageBooking(RAW)!;
    expect(b.price).toBe(7.5);
    expect(b.items[1].nameAr).toBe("Beard");
    expect(b.serviceIds).toEqual(["s1", "s2"]);
    expect(b.shop.nameAr).toBe("الأناقة");
    expect(b.policy.hours).toBe(3);
    expect(b.canConfirm).toBe(true);
    expect(servicesLabel(b.items, "ar")).toBe("حلاقة + Beard");
    expect(parseManageBooking(null)).toBeNull();
    expect(parseManageBooking({ appointment_id: "x" })).toBeNull();
  });

  it("falls back to item ids when service_ids is missing", () => {
    const b = parseManageBooking({ ...RAW, service_ids: undefined })!;
    expect(b.serviceIds).toEqual(["s1", "s2"]);
  });

  it("derives the booking state", () => {
    const b = parseManageBooking(RAW)!;
    const before = new Date("2026-12-01T00:00:00Z");
    expect(manageState(b, before)).toBe("pending");
    expect(manageState({ ...b, status: "confirmed" }, before)).toBe("upcoming");
    expect(manageState({ ...b, status: "cancelled" }, before)).toBe("cancelled");
    expect(manageState(b, new Date("2026-12-06T00:00:00Z"))).toBe("past");
  });

  it("reads RPC error codes", () => {
    expect(rpcErrorCode({ message: "INSIDE_CANCELLATION_WINDOW" })).toBe("INSIDE_CANCELLATION_WINDOW");
    expect(rpcErrorCode({ message: "permission denied" })).toBeNull();
    expect(rpcErrorCode(null)).toBeNull();
  });

  it("builds calendar entries", () => {
    const b = parseManageBooking(RAW)!;
    const ev = bookingCalendarEvent(b, { locale: "en", title: "Haircut at Elegance", url: "https://x/m/t" });
    expect(ev.location).toContain("Rainbow St");
    const ics = buildIcs(ev, new Date("2026-12-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261205T150000Z");
    expect(ics).toContain("UID:a1@halaqy");
  });

  it("lists shop-local dates for rescheduling", () => {
    // 22:30 UTC on 30 Nov is already 1 Dec in Amman (UTC+3).
    const dates = rescheduleDates(new Date("2026-11-30T22:30:00Z"), "Asia/Amman", 3);
    expect(dates).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
  });

  it("counts hours to the deadline", () => {
    expect(hoursUntil("2026-12-05T12:00:00Z", new Date("2026-12-05T09:30:00Z"))).toBe(2);
    expect(hoursUntil("2026-12-05T12:00:00Z", new Date("2026-12-05T13:00:00Z"))).toBe(0);
    expect(hoursUntil(null)).toBe(0);
  });
});

describe("dashboard helpers", () => {
  it("formats and validates offsets", () => {
    expect(offsetParts(1440)).toEqual({ value: 1, unit: "days" });
    expect(offsetParts(120)).toEqual({ value: 2, unit: "hours" });
    expect(offsetParts(30)).toEqual({ value: 30, unit: "minutes" });
    expect(offsetsValid([1440, 120])).toBe(true);
    expect(offsetsValid([10, 120])).toBe(false);
    expect(offsetsValid([60, 60])).toBe(false);
    expect(offsetsValid([30, 60, 120, 240, 720])).toBe(false);
    expect(toggleOffset([120], 1440)).toEqual([1440, 120]);
    expect(toggleOffset([1440, 120], 120)).toEqual([1440]);
    expect(toggleOffset([30, 60, 120, 240], 720)).toEqual([240, 120, 60, 30]);
    expect(parseOffsets("x")).toEqual([1440, 120]);
    expect(parseOffsets([]).length).toBe(0);
  });

  it("round-trips settings", () => {
    const s = parseMessagingSettings({
      reminder_offsets: [120, 1440],
      quiet_hours: { enabled: true, start: "22:00", end: "08:00", jumuah: false },
      messaging_channel: "sms",
      sms_fallback: true,
      review_request_delay_minutes: 60,
    });
    expect(s.reminderOffsets).toEqual([1440, 120]);
    expect(s.quietHours.jumuahStart).toBe("11:30");
    expect(s.channel).toBe("sms");
    expect(validateMessagingSettings(s)).toBeNull();
    const p = toSettingsPayload(s) as { quiet_hours: Record<string, unknown> };
    expect(p.quiet_hours.start).toBe("22:00");
    expect(p.quiet_hours.jumuah).toBe(false);
    expect(validateMessagingSettings({ ...s, quietHours: { ...s.quietHours, start: "08:00" } })).toBe("quiet_hours");
    expect(validateMessagingSettings({ ...s, quietHours: { ...s.quietHours, jumuah: true, jumuahStart: "14:00", jumuahEnd: "13:00" } })).toBe("jumuah");
  });

  it("maps statuses and builds wa.me fallbacks", () => {
    expect(statusTone("delivered")).toBe("success");
    expect(statusTone("fallback")).toBe("brass");
    expect(statusTone("failed")).toBe("danger");
    const row: OutboxRow = {
      id: "o1",
      appointment_id: "a1",
      to_phone: "962791234567",
      channel: "wa_link",
      template: "confirmation",
      locale: "en",
      payload: {
        ctx: {
          token: "tok_tok_tok_tok_tok_tok_",
          shop_name: "Elegance",
          services: "Haircut",
          client_name: "Ahmad",
          start_time: "2026-12-05T15:00:00Z",
          timezone: "Asia/Amman",
        },
      },
      body: null,
      status: "fallback",
      scheduled_for: "2026-12-01T00:00:00Z",
      sent_at: null,
      cost_fils: 0,
      error: null,
      created_at: "2026-12-01T00:00:00Z",
    };
    expect(needsManualSend(row)).toBe(true);
    const link = fallbackWaLink(row, "https://halaqy.com")!;
    expect(link.startsWith("https://wa.me/962791234567?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("https://halaqy.com/en/m/tok_tok_tok_tok_tok_tok_");
    expect(fallbackWaLink({ ...row, to_phone: null }, "x")).toBeNull();
    expect(needsManualSend({ ...row, status: "sent" })).toBe(false);
  });

  it("summarises the month's cost", () => {
    const c = parseMonthCost({ sent_count: 330, cost_fils: 3960, allowance: 300 }, "2026-11-01");
    expect(filsToJod(c.costFils)).toBe(3.96);
    expect(allowanceUsage(c)).toEqual({ ratio: 1.1, over: true, remaining: 0 });
    expect(parseMonthCost(null, "2026-11-01").allowance).toBe(300);
    expect(monthStartIn(new Date("2026-11-30T22:30:00Z"), "Asia/Amman")).toBe("2026-12-01");
  });
});
