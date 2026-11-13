// ═══════════════════════════════════════════════════════════════════════════
// Pure schedule helpers for the hours/closures UI (WS-1F).
//
// Segments use the P0V jsonb shape: [{"start":"HH:MM","end":"HH:MM"|"24:00"}],
// at most 8; end <= start crosses midnight. These helpers validate segment
// lists and find the appointments a schedule change would break, so the owner
// can notify those clients before (or right after) saving.
// ═══════════════════════════════════════════════════════════════════════════

import { isActiveAppointmentStatus } from "@/lib/types";

export interface Segment {
  start: string;
  end: string;
}

export const MAX_SEGMENTS = 8;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type SegmentIssue = "INVALID_TIME" | "TOO_MANY" | "OVERLAP";

export function minutesOf(hhmm: string): number {
  if (hhmm === "24:00") return 1440;
  const m = TIME_RE.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** [start, end) in minutes from local midnight; end may exceed 1440 (night shift). */
export function segmentRange(seg: Segment): [number, number] {
  const s = minutesOf(seg.start);
  let e = minutesOf(seg.end);
  if (e <= s) e += 1440;
  return [s, e];
}

/** null when the list is valid. An empty list means "off that day". */
export function validateSegments(segments: Segment[]): SegmentIssue | null {
  if (segments.length > MAX_SEGMENTS) return "TOO_MANY";
  for (const seg of segments) {
    if (!TIME_RE.test(seg.start) || !(TIME_RE.test(seg.end) || seg.end === "24:00") || seg.start === seg.end) {
      return "INVALID_TIME";
    }
  }
  const ranges = segments.map(segmentRange).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] < ranges[i - 1][1]) return "OVERLAP";
  }
  // A night segment must not run into the first segment of the next day.
  if (ranges.length > 1) {
    const last = ranges[ranges.length - 1];
    if (last[1] > 1440 && last[1] - 1440 > ranges[0][0]) return "OVERLAP";
  }
  return null;
}

/** Sorted copy, normalised to "HH:MM". */
export function normalizeSegments(segments: Segment[]): Segment[] {
  return [...segments]
    .map((s) => ({ start: s.start.slice(0, 5), end: s.end === "24:00" ? "24:00" : s.end.slice(0, 5) }))
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

/** Parses a jsonb segments value defensively. */
export function parseSegments(value: unknown): Segment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { start: string; end: string } => !!v && typeof v === "object" && typeof (v as Segment).start === "string" && typeof (v as Segment).end === "string")
    .map((v) => ({ start: v.start.slice(0, 5), end: v.end === "24:00" ? "24:00" : v.end.slice(0, 5) }));
}

// ─── Local time in the shop's zone ──────────────────────────────────────────

const partsCache = new Map<string, Intl.DateTimeFormat>();
function zoneFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA-u-nu-latn", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** ISO instant → { date: "YYYY-MM-DD", minutes } in `tz`. */
export function localParts(iso: string, tz: string): { date: string; minutes: number } {
  const parts = zoneFormatter(tz).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function prevDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Affected appointments ──────────────────────────────────────────────────

export interface ScheduleAppointment {
  id: string;
  start_time: string;
  end_time: string;
  barber_id: string | null;
  status: string | null;
}

export type ScheduleChange =
  /** Shop closed on every date in [start, end] (closed_periods / special_hours.is_closed). */
  | { type: "closure"; start: string; end: string }
  /** Shop-wide special hours on these dates (special_hours.segments). */
  | { type: "special_hours"; dates: string[]; segments: Segment[] }
  /** One barber's working time on one date (shift_overrides; [] = off). */
  | { type: "shift_override"; barberId: string; date: string; segments: Segment[] }
  /** One barber away between two instants (time_off). */
  | { type: "time_off"; barberId: string; startIso: string; endIso: string };

/**
 * Does [startMin, endMin) on `date` fit the segments of `date` (or a night
 * segment that started the day before)?
 */
function fitsDay(date: string, startMin: number, endMin: number, segmentsFor: (d: string) => Segment[] | null): boolean {
  const today = segmentsFor(date);
  if (today) {
    for (const seg of today) {
      const [s, e] = segmentRange(seg);
      if (startMin >= s && endMin <= e) return true;
    }
  }
  // Night segment from the previous day spilling past midnight.
  const yesterday = segmentsFor(prevDate(date));
  if (yesterday) {
    for (const seg of yesterday) {
      const [s, e] = segmentRange(seg);
      if (e > 1440 && startMin + 1440 >= s && endMin + 1440 <= e) return true;
    }
  }
  return false;
}

/** Active appointments the change would leave outside working time. */
export function findAffectedAppointments<A extends ScheduleAppointment>(appointments: A[], change: ScheduleChange, tz: string): A[] {
  return appointments.filter((a) => {
    if (!isActiveAppointmentStatus(a.status)) return false;
    const start = localParts(a.start_time, tz);
    const end = localParts(a.end_time, tz);
    // End expressed in minutes from the start's local midnight.
    const endMin = end.date === start.date ? end.minutes : end.minutes + 1440;

    switch (change.type) {
      case "closure":
        return start.date >= change.start && start.date <= change.end;
      case "special_hours": {
        if (!change.dates.includes(start.date)) return false;
        const set = new Set(change.dates);
        return !fitsDay(start.date, start.minutes, endMin, (d) => (set.has(d) ? change.segments : null));
      }
      case "shift_override": {
        if (a.barber_id !== change.barberId || start.date !== change.date) return false;
        return !fitsDay(start.date, start.minutes, endMin, (d) => (d === change.date ? change.segments : null));
      }
      case "time_off":
        return a.barber_id === change.barberId && a.start_time < change.endIso && a.end_time > change.startIso;
    }
  });
}

/** Local-midnight bounds of a date range, as a generous UTC window for queries. */
export function queryWindow(start: string, end: string): { from: string; to: string } {
  const from = new Date(`${start}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${end}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 2);
  return { from: from.toISOString(), to: to.toISOString() };
}
