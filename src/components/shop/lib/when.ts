/** "YYYY-MM-DD" for `now` in an IANA time zone (falls back to Asia/Amman). */
export function localDateIn(now: Date, timeZone: string): string {
  let tz = timeZone || "Asia/Amman";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    tz = "Asia/Amman";
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Whole days from `fromDate` to `toDate` (both "YYYY-MM-DD"). */
export function dayDiff(fromDate: string, toDate: string): number {
  const a = Date.UTC(+fromDate.slice(0, 4), +fromDate.slice(5, 7) - 1, +fromDate.slice(8, 10));
  const b = Date.UTC(+toDate.slice(0, 4), +toDate.slice(5, 7) - 1, +toDate.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export type RelativeDay = "today" | "tomorrow" | "date";

export function relativeDay(slotDate: string, today: string): RelativeDay {
  const d = dayDiff(today, slotDate);
  return d === 0 ? "today" : d === 1 ? "tomorrow" : "date";
}

/** Noon on a local date: safe Date for weekday/day formatting in any zone. */
export function noonOf(localDate: string): Date {
  return new Date(`${localDate}T12:00:00`);
}
