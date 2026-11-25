import { describe, expect, it } from "vitest";
import {
  STAFF_PUSH_EVENTS,
  defaultPref,
  isPushChannel,
  isStaffPushEvent,
  prefRows,
  resolvePrefs,
  setChannelForAll,
  setPref,
  wantsEvent,
} from "./events";

describe("staff push events", () => {
  it("lists the five roadmap events", () => {
    expect(STAFF_PUSH_EVENTS).toEqual([
      "booking_new",
      "booking_cancelled",
      "booking_rescheduled",
      "walk_in_assigned",
      "waitlist_filled",
    ]);
    expect(isStaffPushEvent("booking_new")).toBe(true);
    expect(isStaffPushEvent("test")).toBe(false);
    expect(isPushChannel("whatsapp")).toBe(true);
    expect(isPushChannel("sms")).toBe(false);
  });

  it("defaults to push on, WhatsApp off", () => {
    expect(defaultPref("push")).toBe(true);
    expect(defaultPref("whatsapp")).toBe(false);
    const m = resolvePrefs(null);
    for (const e of STAFF_PUSH_EVENTS) expect(m[e]).toEqual({ push: true, whatsapp: false });
  });

  it("applies stored rows and ignores unknown ones", () => {
    const m = resolvePrefs([
      { event: "booking_new", channel: "push", enabled: false },
      { event: "booking_new", channel: "whatsapp", enabled: true },
      { event: "nope", channel: "push", enabled: false },
      { event: "booking_cancelled", channel: "sms", enabled: true },
    ]);
    expect(m.booking_new).toEqual({ push: false, whatsapp: true });
    expect(m.booking_cancelled).toEqual({ push: true, whatsapp: false });
  });

  it("updates immutably", () => {
    const m = resolvePrefs([]);
    const n = setPref(m, "waitlist_filled", "push", false);
    expect(m.waitlist_filled.push).toBe(true);
    expect(n.waitlist_filled.push).toBe(false);
    expect(n.booking_new).toBe(m.booking_new);
    const all = setChannelForAll(m, "whatsapp", true);
    expect(STAFF_PUSH_EVENTS.every((e) => all[e].whatsapp)).toBe(true);
  });

  it("wantsEvent is false only when both channels are off", () => {
    let m = resolvePrefs([]);
    expect(wantsEvent(m, "booking_new")).toBe(true);
    m = setPref(m, "booking_new", "push", false);
    expect(wantsEvent(m, "booking_new")).toBe(false);
    m = setPref(m, "booking_new", "whatsapp", true);
    expect(wantsEvent(m, "booking_new")).toBe(true);
  });

  it("produces one row per event and channel", () => {
    const rows = prefRows("p1", resolvePrefs([]));
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ profile_id: "p1", event: "booking_new", channel: "push", enabled: true });
  });
});
