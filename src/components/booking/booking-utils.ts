// ═══════════════════════════════════════════════════════
// Pure helpers for the public booking flow (no React, no Supabase).
//
// Availability mirrors the rules create_public_booking enforces on the
// server, so the slots shown are the ones the server will accept:
//   • times are wall-clock times in the SHOP's time zone, not the visitor's;
//   • a barber with no working_hours rows works 09:00–18:00 every day;
//   • the whole service duration must fit in the barber's hours, outside
//     their break, and must not overlap one of their pending/confirmed
//     appointments;
//   • a barber with no barber_services rows offers every service, otherwise
//     they must offer ALL selected services;
//   • "any barber" = at least one eligible barber is free.
// The server stays the authority (it re-checks everything under a lock).
// ═══════════════════════════════════════════════════════

export const DEFAULT_TIME_ZONE = "Asia/Amman";
export const FALLBACK_OPEN_MIN = 9 * 60;
export const FALLBACK_CLOSE_MIN = 18 * 60;
export const SLOT_STEP_MIN = 30;
/** Bookings must start at least this many minutes from now. */
export const MIN_LEAD_MIN = 5;

export interface WorkingHourRow {
  barber_id: string;
  day_of_week: number;
  is_working: boolean | null;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
}

export interface BusyRow {
  barber_id: string | null;
  start_time: string;
  end_time: string;
}

export interface BarberCapability {
  id: string;
  barber_services?: { service_id: string; is_active?: boolean | null }[] | null;
}

export interface SlotInfo {
  /** Shop-local wall time "HH:mm". */
  time: string;
  /** Absolute start instant (UTC ISO) to send to the API. */
  startIso: string;
  available: boolean;
  /** Barbers free for the whole duration at this time. */
  freeBarberIds: string[];
}

// ─── Time zone helpers (Intl only; no extra dependency) ───

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of `date` in `tz`. */
export function zonedParts(date: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset of `tz` from UTC at `date`, in minutes (Amman summer = +180). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** "2026-11-12" + "14:30" in `tz` → the absolute instant. Handles DST shifts. */
export function zonedTimeToUtc(dateStr: string, time: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const first = tzOffsetMinutes(new Date(guess), tz);
  let ts = guess - first * 60000;
  const second = tzOffsetMinutes(new Date(ts), tz);
  if (second !== first) ts = guess - second * 60000;
  return new Date(ts);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Today's calendar date in `tz` as "yyyy-MM-dd". */
export function todayInZone(tz: string, now: Date = new Date()): string {
  const p = zonedParts(now, tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Calendar arithmetic on "yyyy-MM-dd" strings (time-zone free). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday, matching working_hours.day_of_week. */
export function weekdayOfDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isDateStr(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

// ─── Capability + hours ───

/** No barber_services rows = offers everything (same as the server). */
export function barberOffersServices(barber: BarberCapability, serviceIds: string[]): boolean {
  const rows = barber.barber_services ?? [];
  if (rows.length === 0 || serviceIds.length === 0) return true;
  return serviceIds.every((id) => rows.some((r) => r.service_id === id && r.is_active !== false));
}

interface DayWindow {
  open: number;
  close: number;
  breakStart: number | null;
  breakEnd: number | null;
}

/** The barber's working window on a weekday, or null when not working. */
export function barberWindow(barberId: string, weekday: number, hours: WorkingHourRow[]): DayWindow | null {
  const rows = hours.filter((h) => h.barber_id === barberId);
  if (rows.length === 0) {
    return { open: FALLBACK_OPEN_MIN, close: FALLBACK_CLOSE_MIN, breakStart: null, breakEnd: null };
  }
  const row = rows.find((h) => h.day_of_week === weekday);
  if (!row || row.is_working !== true) return null;
  return {
    open: toMinutes(row.start_time),
    close: toMinutes(row.end_time),
    breakStart: row.break_start ? toMinutes(row.break_start) : null,
    breakEnd: row.break_end ? toMinutes(row.break_end) : null,
  };
}

function fitsWindow(w: DayWindow, start: number, duration: number): boolean {
  const end = start + duration;
  if (start < w.open || end > w.close || end > 24 * 60) return false;
  if (w.breakStart != null && w.breakEnd != null && start < w.breakEnd && end > w.breakStart) return false;
  return true;
}

/** True when at least one of the barbers works on that date. */
export function isDayOpen(dateStr: string, barberIds: string[], hours: WorkingHourRow[]): boolean {
  const weekday = weekdayOfDateStr(dateStr);
  return barberIds.some((id) => barberWindow(id, weekday, hours) !== null);
}

// ─── Slots ───

export interface ComputeSlotsInput {
  date: string;
  timeZone: string;
  durationMin: number;
  /** Eligible barbers (already filtered by capability / the customer's pick). */
  barberIds: string[];
  workingHours: WorkingHourRow[];
  busy: BusyRow[];
  now?: Date;
  stepMin?: number;
  leadMin?: number;
}

/**
 * All candidate start times for the day, each flagged available or not.
 * Past times (and those inside the lead time) are left out entirely.
 */
export function computeSlots(input: ComputeSlotsInput): SlotInfo[] {
  const {
    date,
    durationMin,
    barberIds,
    workingHours,
    busy,
    now = new Date(),
    stepMin = SLOT_STEP_MIN,
    leadMin = MIN_LEAD_MIN,
  } = input;
  const tz = safeTimeZone(input.timeZone);
  if (!isDateStr(date) || durationMin <= 0 || barberIds.length === 0) return [];

  const weekday = weekdayOfDateStr(date);
  const windows = new Map<string, DayWindow>();
  for (const id of barberIds) {
    const w = barberWindow(id, weekday, workingHours);
    if (w) windows.set(id, w);
  }
  if (windows.size === 0) return [];

  const candidates = new Set<number>();
  for (const w of windows.values()) {
    for (let m = w.open; m + durationMin <= w.close; m += stepMin) candidates.add(m);
  }

  const busyParsed = busy
    .map((b) => ({ barber: b.barber_id, start: Date.parse(b.start_time), end: Date.parse(b.end_time) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));
  const earliest = now.getTime() + leadMin * 60000;

  const out: SlotInfo[] = [];
  for (const m of Array.from(candidates).sort((a, b) => a - b)) {
    const time = minutesToTime(m);
    const start = zonedTimeToUtc(date, time, tz).getTime();
    if (start < earliest) continue;
    const end = start + durationMin * 60000;

    const working = Array.from(windows.entries())
      .filter(([, w]) => fitsWindow(w, m, durationMin))
      .map(([id]) => id);
    if (working.length === 0) continue;

    const free = working.filter(
      (id) => !busyParsed.some((b) => b.barber === id && b.start < end && b.end > start),
    );
    // Unassigned bookings still occupy one chair while they overlap.
    const unassigned = busyParsed.filter((b) => b.barber === null && b.start < end && b.end > start).length;

    out.push({
      time,
      startIso: new Date(start).toISOString(),
      available: free.length - unassigned > 0,
      freeBarberIds: free,
    });
  }
  return out;
}

// ─── Calendar export ───

export interface CalendarEvent {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  location?: string | null;
  description?: string | null;
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** RFC 5545 calendar file for one appointment (UTC times, CRLF lines). */
export function buildIcs(ev: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Halaqy//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(ev.uid)}@halaqy`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(ev.start)}`,
    `DTEND:${icsDate(ev.end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    ev.location ? `LOCATION:${icsEscape(ev.location)}` : "",
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(ev.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsDate(ev.start)}/${icsDate(ev.end)}`,
  });
  if (ev.location) params.set("location", ev.location);
  if (ev.description) params.set("details", ev.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─── Misc ───

/** wa.me number from whatever a shop typed (local Jordanian 07… → 9627…). */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 7) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `962${digits.slice(1)}`;
  return digits;
}

/** Same rule as the server: 7–15 digits, optional leading +. */
export function isValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^\+?[0-9\s\-()]{7,20}$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s\-()]/g, "");
}

/** Short human reference for an appointment id. */
export function bookingReference(appointmentId: string): string {
  return appointmentId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
