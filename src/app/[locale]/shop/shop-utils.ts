/**
 * Pure helpers shared by the public shop page, the explore directory and the
 * customer portal. No React, no Supabase: safe on the server and in tests.
 */

// ─── Cover tile (honest per-shop stand-in until shops have real photos) ───

export interface ShopCover {
  /** Background colour (CSS value). */
  bg: string;
  /** Foreground colour (CSS value). */
  fg: string;
}

// Ink & Brass: ink, brass and warm umber. Tokens resolve to the light palette
// on public routes (they are never dark-themed).
const COVER_PALETTE: ShopCover[] = [
  { bg: "var(--text-primary)", fg: "var(--bg-secondary)" },
  { bg: "var(--accent-mint)", fg: "var(--on-accent)" },
  { bg: "var(--text-secondary)", fg: "var(--bg-secondary)" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** Deterministic accent for a shop id (same shop → same colour everywhere). */
export function coverForShop(id: string): ShopCover {
  return COVER_PALETTE[hashString(id || "") % COVER_PALETTE.length];
}

/** "The Gentleman's Chair" → "TG"; Arabic names keep their first letters. */
export function shopInitials(name: string | null | undefined): string {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
  return initials || "?";
}

// ─── Links ───

/** Google Maps link: the shop's own URL when set, else a search for the address. */
export function mapsUrl(googleMapsUrl: string | null | undefined, address: string | null | undefined): string | null {
  const url = (googleMapsUrl ?? "").trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  const addr = (address ?? "").trim();
  if (!addr) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

/** wa.me link from any phone format, or null when there are too few digits. */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

/** Instagram profile URL from "@handle", "handle" or a full URL. */
export function instagramUrl(handle: string | null | undefined): string | null {
  const raw = (handle ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  return clean ? `https://instagram.com/${clean}` : null;
}

/** tel: href with only dialable characters. */
export function telHref(phone: string | null | undefined): string | null {
  const dial = (phone ?? "").replace(/[^\d+]/g, "");
  return dial.length >= 6 ? `tel:${dial}` : null;
}

// ─── Ratings ───

export interface RatingSummary {
  average: number;
  count: number;
  /** Counts for 5★ → 1★. */
  distribution: { star: number; count: number }[];
}

export function summarizeRatings(ratings: readonly number[]): RatingSummary {
  const valid = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= 5);
  const count = valid.length;
  const average = count ? valid.reduce((a, b) => a + b, 0) / count : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: valid.filter((r) => Math.round(r) === star).length,
  }));
  return { average, count, distribution };
}

// ─── Opening hours ───

export interface WorkingHourRow {
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  is_working: boolean | null;
  start_time: string; // "HH:mm[:ss]"
  end_time: string;
}

export interface DayHours {
  day: number;
  /** "HH:mm", or null when closed. */
  open: string | null;
  close: string | null;
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

/**
 * Collapses per-barber working hours into shop opening hours: a day is open
 * from the earliest barber start to the latest barber end. Days start on
 * Saturday (the Jordanian working week).
 */
export function computeWeeklyHours(rows: readonly WorkingHourRow[]): DayHours[] {
  const order = [6, 0, 1, 2, 3, 4, 5];
  return order.map((day) => {
    const working = rows.filter(
      (r) => r.day_of_week === day && r.is_working !== false && hhmm(r.start_time) < hhmm(r.end_time),
    );
    if (working.length === 0) return { day, open: null, close: null };
    const open = working.map((r) => hhmm(r.start_time)).sort()[0];
    const close = working.map((r) => hhmm(r.end_time)).sort().at(-1) ?? null;
    return { day, open, close };
  });
}

/** Weekday (0–6) and "HH:mm" for `now` in an IANA time zone. */
export function zonedDayAndTime(now: Date, timeZone: string): { day: number; time: string } {
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "Asia/Amman";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hour = get("hour").padStart(2, "0").replace(/^24/, "00");
  return { day: Math.max(0, days.indexOf(get("weekday"))), time: `${hour}:${get("minute").padStart(2, "0")}` };
}

/** Whether the shop is open at `now` (shop time zone). Null when hours are unknown. */
export function isOpenAt(hours: readonly DayHours[], now: Date, timeZone: string): boolean | null {
  if (!hours.some((h) => h.open)) return null;
  const { day, time } = zonedDayAndTime(now, timeZone);
  const today = hours.find((h) => h.day === day);
  if (!today?.open || !today.close) return false;
  return time >= today.open && time < today.close;
}

/** A Date whose weekday is `day` (0 = Sunday); for locale weekday names. */
export function referenceDateForWeekday(day: number): Date {
  // 7 Jan 2024 was a Sunday. Noon avoids DST edges.
  return new Date(2024, 0, 7 + day, 12);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
