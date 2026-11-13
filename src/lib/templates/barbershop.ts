// ═══════════════════════════════════════════════════════════════════════════
// Barbershop starter template (WS-1G onboarding wizard).
//
// Arabic names are written first, in the words Jordanian barbers use; the
// English names are translations. Prices are typical Amman prices in JOD and
// are only starting points: the owner edits every price and duration.
//
// Category slugs match public.service_categories (P0 marketplace spine).
// Day numbers follow Postgres/JS: 0 = Sunday … 6 = Saturday.
// ═══════════════════════════════════════════════════════════════════════════

export type ServiceCategorySlug =
  | "haircut"
  | "fade"
  | "beard"
  | "shave"
  | "kids"
  | "styling"
  | "colour"
  | "treatments"
  | "facial"
  | "packages"
  | "home-service";

export interface TemplateService {
  /** Stable key, used to track template rows in the wizard draft. */
  key: string;
  nameAr: string;
  nameEn: string;
  /** Minutes. */
  duration: number;
  /** JOD. */
  price: number;
  category: ServiceCategorySlug;
  /** services.icon value ("scissors" or "sparkles", as the signup defaults use). */
  icon: string;
  /** Pre-ticked in the wizard. */
  selected: boolean;
}

export const BARBERSHOP_SERVICES: readonly TemplateService[] = [
  { key: "haircut", nameAr: "حلاقة شعر", nameEn: "Haircut", duration: 30, price: 5, category: "haircut", icon: "scissors", selected: true },
  { key: "fade", nameAr: "حلاقة تدريج (فيد)", nameEn: "Skin fade", duration: 40, price: 6, category: "fade", icon: "scissors", selected: true },
  { key: "beard", nameAr: "دقن", nameEn: "Beard trim", duration: 20, price: 3, category: "beard", icon: "scissors", selected: true },
  { key: "lineup", nameAr: "تحديد", nameEn: "Line-up", duration: 15, price: 2, category: "beard", icon: "scissors", selected: true },
  { key: "hair-beard", nameAr: "شعر ودقن", nameEn: "Haircut and beard", duration: 50, price: 7, category: "packages", icon: "scissors", selected: true },
  { key: "blowdry", nameAr: "سشوار", nameEn: "Blow-dry", duration: 15, price: 2, category: "styling", icon: "scissors", selected: true },
  { key: "black-mask", nameAr: "ماسك أسود", nameEn: "Black mask", duration: 15, price: 3, category: "facial", icon: "sparkles", selected: true },
  { key: "kids", nameAr: "حلاقة أطفال", nameEn: "Kids haircut", duration: 25, price: 4, category: "kids", icon: "scissors", selected: true },
  { key: "shave", nameAr: "حلاقة ع الموس مع فوطة سخنة", nameEn: "Hot towel shave", duration: 25, price: 4, category: "shave", icon: "scissors", selected: false },
  { key: "threading", nameAr: "فتلة وشمع", nameEn: "Threading and wax", duration: 15, price: 2, category: "facial", icon: "sparkles", selected: false },
  { key: "beard-dye", nameAr: "صبغة دقن", nameEn: "Beard colour", duration: 30, price: 5, category: "colour", icon: "scissors", selected: false },
  { key: "protein", nameAr: "بروتين شعر", nameEn: "Hair protein treatment", duration: 90, price: 30, category: "treatments", icon: "sparkles", selected: false },
  { key: "groom", nameAr: "تجهيز عريس", nameEn: "Groom package", duration: 120, price: 40, category: "packages", icon: "sparkles", selected: false },
] as const;

/** Durations offered in the picker (minutes). */
export const DURATION_OPTIONS: readonly number[] = [10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180];

export const MIN_SERVICE_DURATION = 5;
export const MAX_SERVICE_DURATION = 480;
export const MAX_SERVICE_PRICE = 1000;
export const MAX_SERVICES = 40;
export const MAX_BARBERS = 20;

// ─── Hours ─────────────────────────────────────────────────────────────────

export interface DayHours {
  /** 0 = Sunday … 6 = Saturday. */
  day: number;
  open: boolean;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
  /** Optional break, e.g. Friday prayer. Both or neither. */
  breakStart: string | null;
  breakEnd: string | null;
}

/** Jordan's working week starts on Saturday. */
export const WEEK_ORDER_SAT_FIRST: readonly number[] = [6, 0, 1, 2, 3, 4, 5];
export const FRIDAY = 5;

/** "Closes at midnight": weekly hours end on the same day, so midnight is 23:59. */
export const MIDNIGHT_CLOSE = "23:59";

export const JUMUAH_BREAK = { start: "12:00", end: "13:30" } as const;

export type HoursPresetId = "standard" | "jumuahBreak" | "fridayAfternoon" | "fridayOff";

export const HOURS_PRESETS: readonly HoursPresetId[] = ["standard", "jumuahBreak", "fridayAfternoon", "fridayOff"];

function day(d: number, open: boolean, start = "10:00", end = "22:00", breakStart: string | null = null, breakEnd: string | null = null): DayHours {
  return { day: d, open, start, end, breakStart, breakEnd };
}

/**
 * Full week (Saturday first) for a preset:
 *  - standard: every day 10:00–22:00
 *  - jumuahBreak: as standard, Friday closed 12:00–13:30 for Jumu'ah
 *  - fridayAfternoon: Friday opens after Jumu'ah, 14:00–22:00
 *  - fridayOff: Friday closed
 */
export function hoursPreset(id: HoursPresetId): DayHours[] {
  return WEEK_ORDER_SAT_FIRST.map((d) => {
    if (d !== FRIDAY || id === "standard") return day(d, true);
    switch (id) {
      case "jumuahBreak":
        return day(d, true, "10:00", "22:00", JUMUAH_BREAK.start, JUMUAH_BREAK.end);
      case "fridayAfternoon":
        return day(d, true, "14:00", "22:00");
      case "fridayOff":
      default:
        return day(d, false);
    }
  });
}

/** The default week the wizard opens with. */
export function defaultHours(): DayHours[] {
  return hoursPreset("jumuahBreak");
}

/** "HH:MM" options every `step` minutes from 00:00 to 23:30. */
export function timeOptions(step = 30): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export function toMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!match) return NaN;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return NaN;
  return h * 60 + m;
}

export type DayHoursError = "endBeforeStart" | "breakOutside" | "breakIncomplete" | "invalidTime";

/** Validates one day. Closed days are always valid. */
export function validateDayHours(h: DayHours): DayHoursError | null {
  if (!h.open) return null;
  const s = toMinutes(h.start);
  const e = toMinutes(h.end);
  if (Number.isNaN(s) || Number.isNaN(e)) return "invalidTime";
  if (e <= s) return "endBeforeStart";
  const hasBs = !!h.breakStart;
  const hasBe = !!h.breakEnd;
  if (hasBs !== hasBe) return "breakIncomplete";
  if (hasBs && hasBe) {
    const bs = toMinutes(h.breakStart as string);
    const be = toMinutes(h.breakEnd as string);
    if (Number.isNaN(bs) || Number.isNaN(be)) return "invalidTime";
    if (!(be > bs && bs >= s && be <= e)) return "breakOutside";
  }
  return null;
}

/** Template services as editable wizard rows. */
export function templateServices(): (TemplateService & { selected: boolean })[] {
  return BARBERSHOP_SERVICES.map((s) => ({ ...s }));
}

/** Rounds a JOD price to the nearest 0.05 and clamps it to 0…MAX_SERVICE_PRICE. */
export function normalizePrice(value: number | string): number {
  const n = typeof value === "number" ? value : Number(String(value).replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_SERVICE_PRICE, Math.round(n * 20) / 20);
}

export function normalizeDuration(value: number | string): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 30;
  return Math.min(MAX_SERVICE_DURATION, Math.max(MIN_SERVICE_DURATION, n));
}
