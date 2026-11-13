// ═══════════════════════════════════════════════════════
// Period + time-zone helpers for analytics.
//
// All period boundaries and buckets are computed in the SHOP's time zone
// (shops.timezone, default Asia/Amman), so a booking at 00:30 local time is
// counted on the right day regardless of the viewer's browser zone — and the
// numbers line up with the dashboard_metrics RPC, which uses the same rules
// (weeks start on Monday).
// ═══════════════════════════════════════════════════════

export type AnalyticsPeriod = "week" | "month" | "year";

export const DEFAULT_TIMEZONE = "Asia/Amman";
const DAY_MS = 86_400_000;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in the given IANA zone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(safeTimeZone(timeZone)).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

/** Offset (ms) of the zone from UTC at the given instant. */
function offsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(instant / 60_000) * 60_000;
}

/** The UTC instant of local midnight on y-m-d in the given zone. */
export function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const tz = safeTimeZone(timeZone);
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - offsetMs(guess, tz);
  const second = guess - offsetMs(result, tz);
  if (second !== result) result = second; // DST edge
  return new Date(result);
}

/** Calendar arithmetic on a y-m-d triple (time-zone free). */
function addDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dayKey(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function monthKey(y: number, m: number) {
  return `${y}-${pad(m)}`;
}

export interface PeriodRange {
  /** Inclusive start (UTC instant of local midnight). */
  start: Date;
  /** Exclusive end. */
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  /** Ordered bucket keys covering the whole period (no gaps). */
  buckets: string[];
  /** "day" → keys are yyyy-MM-dd, "month" → yyyy-MM. */
  bucket: "day" | "month";
  timeZone: string;
}

/** Current and previous period for `now`, in the shop's time zone. */
export function getPeriodRange(period: AnalyticsPeriod, timeZone: string, now: Date = new Date()): PeriodRange {
  const tz = safeTimeZone(timeZone);
  const today = zonedParts(now, tz);

  if (period === "week") {
    const sinceMonday = (today.weekday + 6) % 7;
    const s = addDays(today.year, today.month, today.day, -sinceMonday);
    const e = addDays(s.y, s.m, s.d, 7);
    const ps = addDays(s.y, s.m, s.d, -7);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const x = addDays(s.y, s.m, s.d, i);
      return dayKey(x.y, x.m, x.d);
    });
    return {
      start: zonedMidnight(s.y, s.m, s.d, tz),
      end: zonedMidnight(e.y, e.m, e.d, tz),
      prevStart: zonedMidnight(ps.y, ps.m, ps.d, tz),
      prevEnd: zonedMidnight(s.y, s.m, s.d, tz),
      buckets,
      bucket: "day",
      timeZone: tz,
    };
  }

  if (period === "month") {
    const { year: y, month: m } = today;
    const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
    const daysInMonth = new Date(Date.UTC(next.y, next.m - 1, 1) - DAY_MS).getUTCDate();
    return {
      start: zonedMidnight(y, m, 1, tz),
      end: zonedMidnight(next.y, next.m, 1, tz),
      prevStart: zonedMidnight(prev.y, prev.m, 1, tz),
      prevEnd: zonedMidnight(y, m, 1, tz),
      buckets: Array.from({ length: daysInMonth }, (_, i) => dayKey(y, m, i + 1)),
      bucket: "day",
      timeZone: tz,
    };
  }

  const y = today.year;
  return {
    start: zonedMidnight(y, 1, 1, tz),
    end: zonedMidnight(y + 1, 1, 1, tz),
    prevStart: zonedMidnight(y - 1, 1, 1, tz),
    prevEnd: zonedMidnight(y, 1, 1, tz),
    buckets: Array.from({ length: 12 }, (_, i) => monthKey(y, i + 1)),
    bucket: "month",
    timeZone: tz,
  };
}

/** Bucket key of an ISO timestamp, in the shop's zone. */
export function bucketKeyOf(iso: string, bucket: "day" | "month", timeZone: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = zonedParts(d, timeZone);
  return bucket === "day" ? dayKey(p.year, p.month, p.day) : monthKey(p.year, p.month);
}

/** Inclusive upper bound for PostgREST `lte` (end is exclusive). */
export function inclusiveEnd(end: Date): string {
  return new Date(end.getTime() - 1).toISOString();
}

/** % change, 0 when both are zero, 100 when growing from zero. */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return +(((current - previous) / previous) * 100).toFixed(1);
}
