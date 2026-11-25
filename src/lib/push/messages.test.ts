import { describe, expect, it } from "vitest";
import {
  buildStaffPushMessage,
  buildStaffWhatsAppText,
  fill,
  formatWhen,
  localDate,
  staffDeepLink,
  toPushPayload,
} from "./messages";
import { DICT } from "./fixtures.test-helpers";

const START = "2026-11-19T14:30:00.000Z"; // 17:30 in Amman (UTC+3)

describe("staff push messages", () => {
  it("fills placeholders and keeps unknown ones", () => {
    expect(fill("{a} and {b}", { a: "x" })).toBe("x and {b}");
  });

  it("formats in the shop time zone", () => {
    expect(localDate(START, "Asia/Amman")).toBe("2026-11-19");
    expect(localDate("2026-11-19T22:30:00Z", "Asia/Amman")).toBe("2026-11-20");
    expect(localDate("bad", "Asia/Amman")).toBeNull();
    expect(formatWhen(START, "en", "Asia/Amman")).toMatch(/(17|5):30/);
    expect(formatWhen(START, "en", "Not/AZone")).toMatch(/(17|5):30/);
    expect(formatWhen(null, "en")).toBe("");
  });

  it("deep-links to the calendar day", () => {
    expect(staffDeepLink("ar", "a1", START, "Asia/Amman")).toBe("/ar/calendar?date=2026-11-19&appt=a1");
    expect(staffDeepLink("en", null)).toBe("/en/my-day");
  });

  it("builds a new-booking alert", () => {
    const m = buildStaffPushMessage(
      { id: "j1", event: "booking_new", appointment_id: "a1", payload: { client_name: "Omar", service_name: "Fade", start_time: START, timezone: "Asia/Amman" } },
      "en",
      DICT,
    );
    expect(m.title).toBe("New booking");
    expect(m.body).toContain("Omar");
    expect(m.body).toContain("Fade");
    expect(m.tag).toBe("halaqy-appt-a1");
    expect(m.dir).toBe("ltr");
    expect(m.url).toBe("/en/calendar?date=2026-11-19&appt=a1");
  });

  it("uses the reassigned titles and the from → to time", () => {
    const toMe = buildStaffPushMessage(
      { id: "j", event: "booking_new", appointment_id: "a", payload: { reassigned: true, start_time: START } },
      "ar",
      DICT,
    );
    expect(toMe.title).toBe("Moved to you");
    expect(toMe.body).toContain("Client");
    expect(toMe.dir).toBe("rtl");
    const away = buildStaffPushMessage({ id: "j", event: "booking_cancelled", payload: { reassigned: true } }, "en", DICT);
    expect(away.title).toBe("Moved away");
    const moved = buildStaffPushMessage(
      { id: "j", event: "booking_rescheduled", appointment_id: "a", payload: { start_time: START, old_start_time: "2026-11-18T14:30:00Z" } },
      "en",
      DICT,
    );
    expect(moved.body).toContain("→");
  });

  it("builds the test alert", () => {
    const m = buildStaffPushMessage({ id: "t1", event: "test" }, "en", DICT);
    expect(m).toMatchObject({ title: "Alerts on", body: "Test body", url: "/en/settings/notifications", tag: "halaqy-test-t1" });
  });

  it("composes WhatsApp text with the shop and link", () => {
    const m = buildStaffPushMessage({ id: "j", event: "booking_new", appointment_id: "a", payload: { client_name: "Omar" } }, "en", DICT);
    const text = buildStaffWhatsAppText(m, DICT, "Fade Lab", "https://halaqy.jo/");
    expect(text.split("\n")[0]).toBe("Halaqy · Fade Lab");
    expect(text).toContain("Open: https://halaqy.jo/en/");
    expect(buildStaffWhatsAppText(m, DICT, "", null)).not.toContain("Open:");
  });

  it("keeps the push payload small", () => {
    const m = buildStaffPushMessage({ id: "j", event: "booking_new", payload: { client_name: "x".repeat(2000) } }, "en", DICT);
    const p = JSON.parse(toPushPayload(m));
    expect(p.v).toBe(1);
    expect(p.body.length).toBeLessThanOrEqual(400);
  });
});
