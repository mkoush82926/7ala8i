import { describe, expect, it } from "vitest";
import { displayName, estimateWaits, roundWait, toQueueEntry, type QueueEntry } from "./queue-model";

const T0 = Date.UTC(2026, 10, 14, 9, 0); // 12:00 Amman
const min = (m: number) => T0 + m * 60_000;

function entry(id: string, checkedInMin: number, minutes: number, preferred: string | null = null): QueueEntry & { minutes: number } {
  return {
    id,
    ticketNo: Number(id.replace(/\D/g, "")) || 0,
    clientName: null,
    phone: null,
    serviceIds: [],
    preferredBarberId: preferred,
    assignedBarberId: null,
    appointmentId: null,
    status: "waiting",
    note: null,
    checkedInAt: new Date(min(checkedInMin)).toISOString(),
    startedAt: null,
    minutes,
  };
}

describe("estimateWaits — seeded front-desk scenario", () => {
  // Two barbers working 10:00–22:00 local (T0-120 … T0+600).
  // A is in the chair until +20, then has a booking +45..+75.
  // B is free now, but has bookings +10..+40 and +60..+90.
  const barbers = [
    { id: "A", shifts: [[min(-120), min(600)]] as [number, number][] },
    { id: "B", shifts: [[min(-120), min(600)]] as [number, number][] },
  ];
  const busy = [
    { barberId: "A", start: min(-10), end: min(20) },
    { barberId: "A", start: min(45), end: min(75) },
    { barberId: "B", start: min(10), end: min(40) },
    { barberId: "B", start: min(60), end: min(90) },
  ];
  const entries = [
    entry("w1", -15, 20), // A 20..40 (B's 0..10 gap too short)
    entry("w2", -10, 30), // B 40..60? only 20 min gap → A 75..105 vs B 90..120 → A at 75
    entry("w3", -5, 15, "B"), // B 40..55 (fits before 60)
    entry("w4", -2, 30), // B 90..120 vs A 105..135 → B at 90
  ];
  // Expected by hand from the schedule above.
  const expected: Record<string, { wait: number; barber: string }> = {
    w1: { wait: 20, barber: "A" },
    w2: { wait: 75, barber: "A" },
    w3: { wait: 40, barber: "B" },
    w4: { wait: 90, barber: "B" },
  };

  it("matches the hand-computed waits within ±5 minutes", () => {
    const result = estimateWaits({
      now: T0,
      entries,
      barbers,
      busy,
      durationOf: (e) => (e as (typeof entries)[number]).minutes,
    });
    for (const [id, exp] of Object.entries(expected)) {
      const got = result.get(id)!;
      expect(Math.abs(got.waitMinutes - exp.wait)).toBeLessThanOrEqual(5);
      expect(got.barberId).toBe(exp.barber);
    }
    expect(result.get("w4")!.position).toBe(4);
  });

  it("ignores served entries and past appointments", () => {
    const served = { ...entry("s1", -30, 30), status: "serving" as const };
    const result = estimateWaits({
      now: T0,
      entries: [served, entry("w9", -1, 10)],
      barbers: [{ id: "A", shifts: [[min(-60), min(60)]] }],
      busy: [{ barberId: "A", start: min(-60), end: min(-5) }],
      durationOf: () => 10,
    });
    expect(result.has("s1")).toBe(false);
    expect(result.get("w9")!.waitMinutes).toBe(0);
  });

  it("returns -1 when nobody can take the client before closing", () => {
    const result = estimateWaits({
      now: T0,
      entries: [entry("w1", 0, 60)],
      barbers: [{ id: "A", shifts: [[min(-60), min(30)]] }],
      busy: [],
      durationOf: () => 60,
    });
    expect(result.get("w1")!.waitMinutes).toBe(-1);
  });
});

describe("helpers", () => {
  it("roundWait", () => {
    expect(roundWait(1)).toBe(0);
    expect(roundWait(3)).toBe(5);
    expect(roundWait(23)).toBe(25);
  });

  it("displayName hides surnames and handles anonymous walk-ins", () => {
    expect(displayName("Ahmad Khalil Saleh", 3)).toBe("Ahmad K.");
    expect(displayName("  ", 7)).toBe("#7");
    expect(displayName(null, 12)).toBe("#12");
  });

  it("toQueueEntry maps DB rows defensively", () => {
    const e = toQueueEntry({ id: "x", ticket_no: "4", status: "weird", service_ids: null, checked_in_at: "2026-11-14T09:00:00Z" });
    expect(e).toMatchObject({ id: "x", ticketNo: 4, status: "waiting", serviceIds: [] });
  });
});
