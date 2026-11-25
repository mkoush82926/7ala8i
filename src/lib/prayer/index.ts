/**
 * Prayer times for shop calendars (WS-1E).
 *
 * Method "jordan_awqaf" reproduces the Amman timetable of the Jordanian
 * Ministry of Awqaf as published by the General Iftaa Department
 * (aliftaa.jo, "Prayer Timings in accordance to the local time in Amman"):
 *   - Fajr: sun 18° below the horizon
 *   - Isha: sun 18° below the horizon
 *   - Asr: Shafi'i (shadow = object length + noon shadow)
 *   - Sunrise/sunset at 0.833° (refraction + solar radius)
 *   - Precautionary minutes (tamkin): sunrise −6, Dhuhr +1, Maghrib +6
 *     (sunset + 6). Fitted on the published days in
 *     __fixtures__/amman-official.json, where every prayer is within ±1 min.
 *
 * Why not Muslim World League or Umm al-Qura: MWL (Isha 17°, no tamkin)
 * puts Maghrib ~6 min early and sunrise ~6 min late; Umm al-Qura uses a
 * fixed 90-min Isha that is up to ~20 min off in Amman. Both fail ±2 min.
 *
 * The same algorithm lives in SQL (public.prayer_compute_times, migration
 * 20250101002400) so the nightly generator needs no server process; both
 * agree within a minute.
 */
import { CalculationMethod, CalculationParameters, Coordinates, Madhab, PrayerTimes } from "adhan";

export const PRAYER_METHOD = "jordan_awqaf" as const;
export type PrayerMethod = typeof PRAYER_METHOD | "mwl" | "umm_al_qura";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYERS)[number];

/** Amman (Downtown) — fallback when a shop has no city or pin. */
export const AMMAN = { lat: 31.9539, lng: 35.9106 } as const;
export const DEFAULT_TIMEZONE = "Asia/Amman";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PrayerDay {
  date: string; // yyyy-MM-dd (local)
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

/** Minutes added to the astronomical times (Ministry tamkin). */
export const JORDAN_ADJUSTMENTS = { fajr: 0, sunrise: -6, dhuhr: 1, asr: 0, maghrib: 6, isha: 0 } as const;

/** Calculation parameters for a method. */
export function methodParams(method: PrayerMethod = PRAYER_METHOD): CalculationParameters {
  if (method === "mwl") return CalculationMethod.MuslimWorldLeague();
  if (method === "umm_al_qura") return CalculationMethod.UmmAlQura();
  const params = CalculationMethod.Other();
  params.fajrAngle = 18;
  params.ishaAngle = 18;
  params.madhab = Madhab.Shafi;
  params.methodAdjustments = { ...params.methodAdjustments, ...JORDAN_ADJUSTMENTS };
  return params;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(date: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Prayer times for a local calendar date (instants are absolute). */
export function computePrayerTimes(
  coords: LatLng,
  date: string,
  method: PrayerMethod = PRAYER_METHOD,
): PrayerDay {
  const { y, m, d } = parseIsoDate(date);
  // adhan reads the calendar day from the Date's local fields only.
  const times = new PrayerTimes(new Coordinates(coords.lat, coords.lng), new Date(y, m - 1, d, 12), methodParams(method));
  return {
    date,
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
}

/** "HH:MM" (24h, Latin digits) of an instant in a time zone. */
export function timeInZone(instant: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

/** Minutes between two "HH:MM" strings (b - a). */
export function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

/** ISO weekday (Mon=1 … Sun=7) of a yyyy-MM-dd date. */
export function isoWeekday(date: string): number {
  const { y, m, d } = parseIsoDate(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseIsoDate(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

// ─── Block rules (mirror of public.prayer_block_rules) ─────────────────────

export interface PrayerBlockRule {
  prayer: PrayerName;
  enabled: boolean;
  minutes: number; // 5..180
  start_offset_minutes: number; // -60..60
  jumuah_minutes: number; // dhuhr row only; 0 = none
  allow_online: boolean;
}

export const RULE_LIMITS = {
  minutes: { min: 5, max: 180 },
  offset: { min: -60, max: 60 },
  jumuah: { min: 0, max: 180 },
} as const;

/** Sensible defaults: nothing blocked until the owner opts in; 15 min each, 60 for Jumu'ah. */
export function defaultPrayerRules(): PrayerBlockRule[] {
  return PRAYERS.map((prayer) => ({
    prayer,
    enabled: false,
    minutes: 15,
    start_offset_minutes: 0,
    jumuah_minutes: prayer === "dhuhr" ? 60 : 0,
    allow_online: false,
  }));
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

/** Clamps rules to the DB CHECKs and fills missing prayers with defaults. */
export function normalizePrayerRules(rows: Partial<PrayerBlockRule>[] | null | undefined): PrayerBlockRule[] {
  const byPrayer = new Map((rows ?? []).filter((r) => r?.prayer).map((r) => [r.prayer, r]));
  return defaultPrayerRules().map((def) => {
    const row = byPrayer.get(def.prayer);
    if (!row) return def;
    return {
      prayer: def.prayer,
      enabled: Boolean(row.enabled),
      minutes: clamp(row.minutes ?? def.minutes, RULE_LIMITS.minutes.min, RULE_LIMITS.minutes.max),
      start_offset_minutes: clamp(row.start_offset_minutes ?? 0, RULE_LIMITS.offset.min, RULE_LIMITS.offset.max),
      jumuah_minutes:
        def.prayer === "dhuhr"
          ? clamp(row.jumuah_minutes ?? 0, RULE_LIMITS.jumuah.min, RULE_LIMITS.jumuah.max)
          : 0,
      allow_online: Boolean(row.allow_online),
    };
  });
}

export interface PlannedPrayerBlock {
  date: string;
  prayer: PrayerName | "jumuah";
  start: Date;
  end: Date;
  allowOnline: boolean;
}

/**
 * The blocks the nightly generator writes for a day (same rules as
 * public.generate_prayer_blocks): on Friday, a dhuhr row with
 * jumuah_minutes > 0 becomes a Jumu'ah block even when dhuhr is disabled.
 */
export function planPrayerBlocks(day: PrayerDay, rules: PrayerBlockRule[]): PlannedPrayerBlock[] {
  const friday = isoWeekday(day.date) === 5;
  const out: PlannedPrayerBlock[] = [];
  for (const rule of rules) {
    const jumuah = friday && rule.prayer === "dhuhr" && rule.jumuah_minutes > 0;
    if (!rule.enabled && !jumuah) continue;
    const start = new Date(day[rule.prayer].getTime() + rule.start_offset_minutes * 60_000);
    const minutes = jumuah ? rule.jumuah_minutes : rule.minutes;
    out.push({
      date: day.date,
      prayer: jumuah ? "jumuah" : rule.prayer,
      start,
      end: new Date(start.getTime() + minutes * 60_000),
      allowOnline: rule.allow_online,
    });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Prayer times for N consecutive local dates starting at `from`. */
export function prayerRange(coords: LatLng, from: string, days: number, method: PrayerMethod = PRAYER_METHOD): PrayerDay[] {
  const out: PrayerDay[] = [];
  for (let i = 0; i < Math.max(0, Math.min(days, 400)); i++) {
    out.push(computePrayerTimes(coords, addDays(from, i), method));
  }
  return out;
}
