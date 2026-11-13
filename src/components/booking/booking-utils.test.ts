import { describe, it, expect } from "vitest";
import {
  addDaysToDateStr,
  barberOffersServices,
  bookingReference,
  buildIcs,
  computeSlots,
  googleCalendarUrl,
  isDayOpen,
  isValidPhone,
  normalizePhone,
  safeTimeZone,
  todayInZone,
  toWhatsAppNumber,
  tzOffsetMinutes,
  weekdayOfDateStr,
  zonedTimeToUtc,
  type WorkingHourRow,
} from "./booking-utils";

const TZ = "Asia/Amman"; // UTC+3 all year since 2022
const DAY = "2026-11-16"; // a Monday
const BEFORE = new Date("2026-11-15T12:00:00Z"); // the day before

function hours(barber: string, day: number, start = "09:00", end = "17:00", extra: Partial<WorkingHourRow> = {}): WorkingHourRow {
  return { barber_id: barber, day_of_week: day, is_working: true, start_time: start, end_time: end, ...extra };
}

describe("time zone helpers", () => {
  it("converts a shop-local wall time to UTC", () => {
    expect(zonedTimeToUtc(DAY, "10:00", TZ).toISOString()).toBe("2026-11-16T07:00:00.000Z");
    expect(zonedTimeToUtc(DAY, "10:00", "UTC").toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });

  it("handles DST transitions (Europe/London spring forward)", () => {
    expect(zonedTimeToUtc("2026-07-01", "10:00", "Europe/London").toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(zonedTimeToUtc("2026-01-01", "10:00", "Europe/London").toISOString()).toBe("2026-01-01T10:00:00.000Z");
  });

  it("computes offsets", () => {
    expect(tzOffsetMinutes(new Date("2026-11-16T00:00:00Z"), TZ)).toBe(180);
  });

  it("returns today's date in the shop's zone, not the visitor's", () => {
    // 22:30 UTC is already the next day in Amman.
    expect(todayInZone(TZ, new Date("2026-11-15T22:30:00Z"))).toBe("2026-11-16");
    expect(todayInZone("UTC", new Date("2026-11-15T22:30:00Z"))).toBe("2026-11-15");
  });

  it("does calendar math on date strings without UTC drift", () => {
    expect(addDaysToDateStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateStr("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayOfDateStr(DAY)).toBe(1);
  });

  it("falls back to Asia/Amman for an invalid zone", () => {
    expect(safeTimeZone("Not/AZone")).toBe("Asia/Amman");
    expect(safeTimeZone(null)).toBe("Asia/Amman");
    expect(safeTimeZone("Europe/London")).toBe("Europe/London");
  });
});

describe("barberOffersServices", () => {
  it("treats a barber with no capability rows as offering everything", () => {
    expect(barberOffersServices({ id: "b" }, ["s1", "s2"])).toBe(true);
  });

  it("requires every selected service, not just one", () => {
    const b = { id: "b", barber_services: [{ service_id: "s1" }] };
    expect(barberOffersServices(b, ["s1"])).toBe(true);
    expect(barberOffersServices(b, ["s1", "s2"])).toBe(false);
  });

  it("ignores inactive capability rows", () => {
    const b = { id: "b", barber_services: [{ service_id: "s1", is_active: false }, { service_id: "s2" }] };
    expect(barberOffersServices(b, ["s1"])).toBe(false);
  });
});

describe("computeSlots", () => {
  const base = { date: DAY, timeZone: TZ, now: BEFORE, workingHours: [hours("a", 1)], busy: [] };

  it("respects the full service duration (45 min) against a later booking", () => {
    const slots = computeSlots({
      ...base,
      durationMin: 45,
      barberIds: ["a"],
      busy: [{ barber_id: "a", start_time: zonedTimeToUtc(DAY, "10:30", TZ).toISOString(), end_time: zonedTimeToUtc(DAY, "11:00", TZ).toISOString() }],
    });
    const at = (t: string) => slots.find((s) => s.time === t);
    // 10:00–10:45 overlaps 10:30–11:00 → not available, even though 10:00–10:30 is free.
    expect(at("10:00")?.available).toBe(false);
    expect(at("09:30")?.available).toBe(true); // 09:30–10:15 ends before 10:30
    expect(at("09:00")?.available).toBe(true);
    // Adjacent booking: 11:00 start touches the 11:00 end → free.
    expect(at("11:00")?.available).toBe(true);
  });

  it("only offers starts where the whole duration fits before closing", () => {
    const slots = computeSlots({ ...base, durationMin: 60, barberIds: ["a"] });
    expect(slots.at(-1)?.time).toBe("16:00");
    const slots30 = computeSlots({ ...base, durationMin: 30, barberIds: ["a"] });
    expect(slots30.at(-1)?.time).toBe("16:30");
  });

  it("skips the barber's break", () => {
    const slots = computeSlots({
      ...base,
      durationMin: 30,
      barberIds: ["a"],
      workingHours: [hours("a", 1, "09:00", "17:00", { break_start: "12:00", break_end: "13:00" })],
    });
    const times = slots.map((s) => s.time);
    expect(times).toContain("11:30");
    expect(times).not.toContain("12:00");
    expect(times).not.toContain("12:30");
    expect(times).toContain("13:00");
  });

  it("returns nothing on a day the barber does not work", () => {
    const slots = computeSlots({ ...base, durationMin: 30, barberIds: ["a"], workingHours: [hours("a", 2)] });
    expect(slots).toEqual([]);
    expect(isDayOpen(DAY, ["a"], [hours("a", 2)])).toBe(false);
  });

  it("uses 09:00–18:00 for an unconfigured barber (same as the server)", () => {
    const slots = computeSlots({ ...base, durationMin: 30, barberIds: ["z"], workingHours: [] });
    expect(slots[0].time).toBe("09:00");
    expect(slots.at(-1)?.time).toBe("17:30");
  });

  it("pools barbers for 'any': one barber's booking does not block the slot", () => {
    const wh = [hours("a", 1), hours("b", 1)];
    const busy = [{ barber_id: "a", start_time: zonedTimeToUtc(DAY, "10:00", TZ).toISOString(), end_time: zonedTimeToUtc(DAY, "10:30", TZ).toISOString() }];
    const pooled = computeSlots({ ...base, durationMin: 30, barberIds: ["a", "b"], workingHours: wh, busy });
    const slot = pooled.find((s) => s.time === "10:00");
    expect(slot?.available).toBe(true);
    expect(slot?.freeBarberIds).toEqual(["b"]);

    const onlyA = computeSlots({ ...base, durationMin: 30, barberIds: ["a"], workingHours: wh, busy });
    expect(onlyA.find((s) => s.time === "10:00")?.available).toBe(false);
  });

  it("counts an unassigned booking as one occupied chair", () => {
    const wh = [hours("a", 1), hours("b", 1)];
    const at10 = { start_time: zonedTimeToUtc(DAY, "10:00", TZ).toISOString(), end_time: zonedTimeToUtc(DAY, "10:30", TZ).toISOString() };
    const one = computeSlots({ ...base, durationMin: 30, barberIds: ["a", "b"], workingHours: wh, busy: [{ barber_id: null, ...at10 }] });
    expect(one.find((s) => s.time === "10:00")?.available).toBe(true);
    const two = computeSlots({
      ...base, durationMin: 30, barberIds: ["a", "b"], workingHours: wh,
      busy: [{ barber_id: null, ...at10 }, { barber_id: "a", ...at10 }],
    });
    expect(two.find((s) => s.time === "10:00")?.available).toBe(false);
  });

  it("hides past times and those inside the lead time, using the shop's zone", () => {
    // 07:20 UTC = 10:20 in Amman.
    const now = new Date("2026-11-16T07:20:00Z");
    const slots = computeSlots({ ...base, now, durationMin: 30, barberIds: ["a"] });
    expect(slots[0].time).toBe("10:30");
    const lead = computeSlots({ ...base, now: new Date("2026-11-16T07:27:00Z"), durationMin: 30, barberIds: ["a"] });
    expect(lead[0].time).toBe("11:00");
  });

  it("returns UTC ISO start instants for the API", () => {
    const slots = computeSlots({ ...base, durationMin: 30, barberIds: ["a"] });
    expect(slots[0].startIso).toBe("2026-11-16T06:00:00.000Z");
  });

  it("returns nothing for bad input", () => {
    expect(computeSlots({ ...base, date: "16/11/2026", durationMin: 30, barberIds: ["a"] })).toEqual([]);
    expect(computeSlots({ ...base, durationMin: 0, barberIds: ["a"] })).toEqual([]);
    expect(computeSlots({ ...base, durationMin: 30, barberIds: [] })).toEqual([]);
  });
});

describe("calendar export", () => {
  const ev = {
    uid: "appt-1",
    start: new Date("2026-11-16T07:00:00Z"),
    end: new Date("2026-11-16T07:45:00Z"),
    title: "Haircut, beard; at Halaqy",
    location: "Rainbow St, Amman",
    description: "Line 1\nLine 2",
  };

  it("builds a valid ICS with escaped text and CRLF line endings", () => {
    const ics = buildIcs(ev, new Date("2026-11-12T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261116T070000Z");
    expect(ics).toContain("DTEND:20261116T074500Z");
    expect(ics).toContain("SUMMARY:Haircut\\, beard\\; at Halaqy");
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("builds a Google Calendar link", () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.searchParams.get("dates")).toBe("20261116T070000Z/20261116T074500Z");
    expect(url.searchParams.get("location")).toBe("Rainbow St, Amman");
  });
});

describe("misc", () => {
  it("normalizes WhatsApp numbers", () => {
    expect(toWhatsAppNumber("079 123 4567")).toBe("962791234567");
    expect(toWhatsAppNumber("00962791234567")).toBe("962791234567");
    expect(toWhatsAppNumber("+962 79 123 4567")).toBe("962791234567");
    expect(toWhatsAppNumber("12")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });

  it("validates phones like the server (7–15 digits)", () => {
    expect(isValidPhone("+962 79 123 4567")).toBe(true);
    expect(isValidPhone("0791234567")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("abc1234567")).toBe(false);
    expect(isValidPhone("+1234567890123456")).toBe(false);
    expect(normalizePhone(" +962 (79) 123-4567 ")).toBe("+962791234567");
  });

  it("makes a short booking reference", () => {
    expect(bookingReference("3f2a9c10-1234-4abc-8def-000000000000")).toBe("3F2A9C10");
  });
});
