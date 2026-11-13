// ═══════════════════════════════════════════════════════
// Recurring blocked time (blocked_times.rrule / series_id).
//
// The engine reads one row per occurrence; a series is materialised by the
// writer as rows sharing series_id, with the rule kept in rrule for editing.
// This expands the supported RFC 5545 subset into shop-local dates:
//   FREQ=DAILY|WEEKLY, INTERVAL, COUNT, UNTIL (yyyymmdd[Thhmmss[Z]]),
//   BYDAY=SU,MO,TU,WE,TH,FR,SA (weekly only).
// Turn each date + wall time into instants with zonedTimeToUtc().
// ═══════════════════════════════════════════════════════

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY";
  interval: number;
  count: number | null;
  /** Last allowed local date "yyyy-MM-dd" (inclusive). */
  until: string | null;
  /** 0 = Sunday … 6 = Saturday. Empty = the start date's weekday. */
  byDay: number[];
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
/** Hard cap so a bad rule can never write thousands of rows. */
export const MAX_OCCURRENCES = 366;

/** Parses "FREQ=WEEKLY;BYDAY=FR;COUNT=4" (optionally prefixed "RRULE:"). Null when unsupported. */
export function parseRrule(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null;
  const body = raw.trim().replace(/^RRULE:/i, "");
  const parts = new Map<string, string>();
  for (const seg of body.split(";")) {
    const [k, v] = seg.split("=");
    if (!k || v === undefined) return null;
    parts.set(k.trim().toUpperCase(), v.trim().toUpperCase());
  }
  const freq = parts.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY") return null;

  const interval = parts.has("INTERVAL") ? Number(parts.get("INTERVAL")) : 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) return null;

  let count: number | null = null;
  if (parts.has("COUNT")) {
    count = Number(parts.get("COUNT"));
    if (!Number.isInteger(count) || count < 1) return null;
  }

  let until: string | null = null;
  if (parts.has("UNTIL")) {
    const m = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(parts.get("UNTIL")!);
    if (!m) return null;
    until = `${m[1]}-${m[2]}-${m[3]}`;
  }

  const byDay: number[] = [];
  if (parts.has("BYDAY")) {
    if (freq !== "WEEKLY") return null;
    for (const code of parts.get("BYDAY")!.split(",")) {
      const idx = DAY_CODES.indexOf(code.trim() as (typeof DAY_CODES)[number]);
      if (idx < 0) return null;
      if (!byDay.includes(idx)) byDay.push(idx);
    }
    byDay.sort((a, b) => a - b);
  }
  return { freq, interval, count, until, byDay };
}

function toUtcDay(date: string): number {
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
}

function fromUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Occurrence dates ("yyyy-MM-dd", shop-local) starting at `startDate`
 * (always the first occurrence when it matches the rule), capped by COUNT,
 * UNTIL, `hardEnd` (inclusive) and MAX_OCCURRENCES.
 */
export function expandRecurrence(
  rule: RecurrenceRule | string,
  startDate: string,
  hardEnd?: string | null,
): string[] {
  const r = typeof rule === "string" ? parseRrule(rule) : rule;
  if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return [];
  const DAY = 86_400_000;
  const start = toUtcDay(startDate);
  const ends = [r.until, hardEnd ?? null].filter((d): d is string => !!d).map(toUtcDay);
  const end = ends.length > 0 ? Math.min(...ends) : start + 2 * 366 * DAY;
  const limit = Math.min(r.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const out: string[] = [];

  if (r.freq === "DAILY") {
    for (let t = start; t <= end && out.length < limit; t += r.interval * DAY) out.push(fromUtcDay(t));
    return out;
  }

  const startDow = new Date(start).getUTCDay();
  const days = r.byDay.length > 0 ? r.byDay : [startDow];
  const weekStart = start - startDow * DAY; // Sunday of the first week
  for (let w = weekStart; w <= end && out.length < limit; w += r.interval * 7 * DAY) {
    for (const dow of days) {
      const t = w + dow * DAY;
      if (t < start || t > end) continue;
      out.push(fromUtcDay(t));
      if (out.length >= limit) break;
    }
  }
  return out;
}
