import { describe, expect, it } from "vitest";
import {
  findAffectedAppointments,
  localParts,
  normalizeSegments,
  parseSegments,
  queryWindow,
  segmentRange,
  validateSegments,
} from "./schedule-logic";

const TZ = "Asia/Amman"; // UTC+3 all year

describe("segments", () => {
  it("validates", () => {
    expect(validateSegments([])).toBeNull();
    expect(validateSegments([{ start: "09:00", end: "13:00" }, { start: "16:00", end: "22:00" }])).toBeNull();
    expect(validateSegments([{ start: "21:00", end: "02:00" }])).toBeNull();
    expect(validateSegments([{ start: "13:00", end: "24:00" }])).toBeNull();
    expect(validateSegments([{ start: "09:00", end: "13:00" }, { start: "12:00", end: "15:00" }])).toBe("OVERLAP");
    expect(validateSegments([{ start: "09:00", end: "09:00" }])).toBe("INVALID_TIME");
    expect(validateSegments([{ start: "9:00", end: "10:00" }])).toBe("INVALID_TIME");
    expect(validateSegments([{ start: "08:00", end: "10:00" }, { start: "22:00", end: "09:00" }])).toBe("OVERLAP");
    expect(validateSegments(Array.from({ length: 9 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` })))).toBe("TOO_MANY");
  });

  it("normalises and parses", () => {
    expect(segmentRange({ start: "21:00", end: "02:00" })).toEqual([1260, 1560]);
    expect(normalizeSegments([{ start: "16:00:00", end: "22:00:00" }, { start: "09:00", end: "13:00" }])).toEqual([
      { start: "09:00", end: "13:00" },
      { start: "16:00", end: "22:00" },
    ]);
    expect(parseSegments([{ start: "09:00", end: "12:00" }, null, { start: 1 }])).toEqual([{ start: "09:00", end: "12:00" }]);
    expect(parseSegments("x")).toEqual([]);
  });

  it("reads local time in the shop zone", () => {
    expect(localParts("2027-02-10T19:30:00Z", TZ)).toEqual({ date: "2027-02-10", minutes: 22 * 60 + 30 });
    expect(localParts("2027-02-10T22:30:00Z", TZ)).toEqual({ date: "2027-02-11", minutes: 90 });
  });

  it("builds a query window around the dates", () => {
    expect(queryWindow("2027-02-08", "2027-02-08")).toEqual({ from: "2027-02-07T00:00:00.000Z", to: "2027-02-10T00:00:00.000Z" });
  });
});

describe("findAffectedAppointments", () => {
  const appt = (id: string, startUtc: string, endUtc: string, barber = "b1", status = "confirmed") => ({
    id,
    start_time: startUtc,
    end_time: endUtc,
    barber_id: barber,
    status,
  });
  // Local times (UTC+3): a1 10:00–10:30, a2 14:00–14:45, a3 22:00–22:30, a4 (next day) 01:00–01:30, a5 cancelled.
  const appts = [
    appt("a1", "2027-02-10T07:00:00Z", "2027-02-10T07:30:00Z"),
    appt("a2", "2027-02-10T11:00:00Z", "2027-02-10T11:45:00Z", "b2"),
    appt("a3", "2027-02-10T19:00:00Z", "2027-02-10T19:30:00Z"),
    appt("a4", "2027-02-10T22:00:00Z", "2027-02-10T22:30:00Z"),
    appt("a5", "2027-02-10T07:00:00Z", "2027-02-10T07:30:00Z", "b1", "cancelled"),
  ];

  it("closure: every active appointment on those dates", () => {
    expect(findAffectedAppointments(appts, { type: "closure", start: "2027-02-10", end: "2027-02-10" }, TZ).map((a) => a.id)).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
  });

  it("Ramadan special hours with a night segment keep the after-iftar bookings", () => {
    const change = {
      type: "special_hours" as const,
      dates: ["2027-02-10", "2027-02-11"],
      segments: [
        { start: "13:00", end: "17:00" },
        { start: "21:00", end: "02:00" },
      ],
    };
    // a1 (10:00) is outside; a2 (14:00) and a3 (22:00) fit; a4 (01:00 next day) fits the night segment.
    expect(findAffectedAppointments(appts, change, TZ).map((a) => a.id)).toEqual(["a1"]);
  });

  it("shift override only touches that barber and date", () => {
    expect(
      findAffectedAppointments(appts, { type: "shift_override", barberId: "b1", date: "2027-02-10", segments: [] }, TZ).map((a) => a.id),
    ).toEqual(["a1", "a3"]);
    expect(
      findAffectedAppointments(
        appts,
        { type: "shift_override", barberId: "b1", date: "2027-02-10", segments: [{ start: "09:00", end: "18:00" }] },
        TZ,
      ).map((a) => a.id),
    ).toEqual(["a3"]);
  });

  it("time off overlaps by instant", () => {
    expect(
      findAffectedAppointments(
        appts,
        { type: "time_off", barberId: "b1", startIso: "2027-02-10T07:15:00Z", endIso: "2027-02-10T20:00:00Z" },
        TZ,
      ).map((a) => a.id),
    ).toEqual(["a1", "a3"]);
  });
});
