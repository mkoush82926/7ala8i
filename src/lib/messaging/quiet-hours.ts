// Quiet hours: TS twin of public.messaging_quiet_until(). Reminders,
// thank-you and waitlist messages due inside the night window (default
// 23:00–08:00 Asia/Amman) or the Friday Jumu'ah window wait for its end.

export interface QuietHours {
  enabled: boolean;
  start: string; // HH:MM
  end: string;
  jumuah: boolean;
  jumuahStart: string;
  jumuahEnd: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: true,
  start: "23:00",
  end: "08:00",
  jumuah: true,
  jumuahStart: "11:30",
  jumuahEnd: "13:30",
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isHHMM(v: unknown): v is string {
  return typeof v === "string" && HHMM.test(v);
}

/** DB jsonb (snake_case) → QuietHours with defaults for anything malformed. */
export function parseQuietHours(raw: unknown): QuietHours {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const t = (k: string, d: string) => (isHHMM(o[k]) ? (o[k] as string) : d);
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_QUIET_HOURS.enabled,
    start: t("start", DEFAULT_QUIET_HOURS.start),
    end: t("end", DEFAULT_QUIET_HOURS.end),
    jumuah: typeof o.jumuah === "boolean" ? o.jumuah : DEFAULT_QUIET_HOURS.jumuah,
    jumuahStart: t("jumuah_start", DEFAULT_QUIET_HOURS.jumuahStart),
    jumuahEnd: t("jumuah_end", DEFAULT_QUIET_HOURS.jumuahEnd),
  };
}

export function quietHoursToJson(q: QuietHours): Record<string, string | boolean> {
  return {
    enabled: q.enabled,
    start: q.start,
    end: q.end,
    jumuah: q.jumuah,
    jumuah_start: q.jumuahStart,
    jumuah_end: q.jumuahEnd,
  };
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

interface LocalParts {
  y: number;
  m: number;
  d: number;
  min: number; // minutes since local midnight
  dow: number; // 0 = Sunday … 5 = Friday
}

function localParts(at: Date, timeZone: string): LocalParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(at)) p[part.type] = part.value;
  const y = Number(p.year);
  const m = Number(p.month);
  const d = Number(p.day);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, min: Number(p.hour) * 60 + Number(p.minute) + Number(p.second) / 60, dow };
}

/** Offset (ms) of `timeZone` at instant `at`: local wall clock minus UTC. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const wall = Date.UTC(p.y, p.m - 1, p.d) + Math.round(p.min * 60) * 1000;
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant of local wall time (y-m-d + minutes) in `timeZone`. */
function zonedInstant(y: number, m: number, d: number, minutes: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d) + minutes * 60_000;
  let ts = guess - zoneOffsetMs(new Date(guess), timeZone);
  ts = guess - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

function safeZone(tz: string | null | undefined): string {
  const zone = tz || "Asia/Amman";
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
    return zone;
  } catch {
    return "Asia/Amman";
  }
}

/**
 * First allowed send instant when `at` is inside quiet hours; null when `at`
 * is already allowed.
 */
export function quietUntil(at: Date, quiet: QuietHours, timeZone?: string | null): Date | null {
  const zone = safeZone(timeZone);
  let cur = new Date(at.getTime());
  let moved = false;
  for (let i = 0; i < 4; i++) {
    let step = false;
    const p = localParts(cur, zone);
    const s = toMin(quiet.start);
    const e = toMin(quiet.end);
    if (quiet.enabled && s !== e) {
      if (s > e) {
        if (p.min >= s) {
          const next = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
          cur = zonedInstant(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), e, zone);
          step = true;
        } else if (p.min < e) {
          cur = zonedInstant(p.y, p.m, p.d, e, zone);
          step = true;
        }
      } else if (p.min >= s && p.min < e) {
        cur = zonedInstant(p.y, p.m, p.d, e, zone);
        step = true;
      }
    }
    const q = localParts(cur, zone);
    const js = toMin(quiet.jumuahStart);
    const je = toMin(quiet.jumuahEnd);
    if (quiet.jumuah && js < je && q.dow === 5 && q.min >= js && q.min < je) {
      cur = zonedInstant(q.y, q.m, q.d, je, zone);
      step = true;
    }
    if (!step) break;
    moved = true;
  }
  return moved ? cur : null;
}

/** When a deferrable message due at `at` will actually go out. */
export function nextSendTime(at: Date, quiet: QuietHours, timeZone?: string | null): Date {
  return quietUntil(at, quiet, timeZone) ?? at;
}
