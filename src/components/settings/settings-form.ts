// Pure helpers for the Settings page: mapping DB rows to editable form state,
// validating it and building the update payloads. Kept free of React so the
// rules are unit-tested (settings-form.test.ts) and mirror the DB CHECKs.

export const SETTINGS_TABS = ["general", "policy", "hours", "booking", "team"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export function parseSettingsTab(value: string | null | undefined): SettingsTab | null {
  return (SETTINGS_TABS as readonly string[]).includes(value ?? "") ? (value as SettingsTab) : null;
}

export const CURRENCIES = ["JOD", "SAR", "AED", "KWD", "QAR", "BHD", "OMR", "EGP", "IQD", "USD", "EUR"] as const;
export const TIMEZONES = [
  "Asia/Amman",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Bahrain",
  "Asia/Muscat",
  "Asia/Baghdad",
  "Asia/Beirut",
  "Asia/Damascus",
  "Asia/Jerusalem",
  "Africa/Cairo",
  "Europe/Istanbul",
  "Europe/London",
  "UTC",
] as const;

/**
 * Public columns the settings page reads on `shops`. daily_goal is private
 * (no column SELECT grant), so it comes from the get_my_shop_private RPC.
 */
export const SHOP_SETTINGS_COLUMNS =
  "name, description, email, phone, whatsapp, instagram, address, google_maps_url, currency, timezone, cancellation_policy_hours, cancellation_fee_percent, require_deposit, deposit_type, deposit_value";

export interface ShopForm {
  name: string;
  description: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  address: string;
  google_maps_url: string;
  daily_goal: string;
  currency: string;
  timezone: string;
  cancellation_policy_hours: string;
  cancellation_fee_percent: string;
  require_deposit: boolean;
  deposit_type: "percentage" | "fixed";
  deposit_value: string;
}

export type ShopField = keyof ShopForm;

/** Error codes; the component maps them to translated messages. */
export type FieldError = "name" | "description" | "email" | "phone" | "url" | "instagram" | "range";

export type ShopRow = Partial<{
  name: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  google_maps_url: string | null;
  daily_goal: number | string | null;
  currency: string | null;
  timezone: string | null;
  cancellation_policy_hours: number | string | null;
  cancellation_fee_percent: number | string | null;
  require_deposit: boolean | null;
  deposit_type: string | null;
  deposit_value: number | string | null;
}>;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function shopRowToForm(row: ShopRow | null | undefined, fallbackName = ""): ShopForm {
  const r = row ?? {};
  return {
    name: str(r.name) || fallbackName,
    description: str(r.description),
    email: str(r.email),
    phone: str(r.phone),
    whatsapp: str(r.whatsapp),
    instagram: str(r.instagram),
    address: str(r.address),
    google_maps_url: str(r.google_maps_url),
    daily_goal: r.daily_goal === null || r.daily_goal === undefined ? "120" : str(r.daily_goal),
    currency: str(r.currency) || "JOD",
    timezone: str(r.timezone) || "Asia/Amman",
    cancellation_policy_hours: r.cancellation_policy_hours == null ? "24" : str(r.cancellation_policy_hours),
    cancellation_fee_percent: r.cancellation_fee_percent == null ? "0" : str(r.cancellation_fee_percent),
    require_deposit: r.require_deposit === true,
    deposit_type: r.deposit_type === "fixed" ? "fixed" : "percentage",
    deposit_value: r.deposit_value == null ? "0" : str(r.deposit_value),
  };
}

export function isFormDirty<T extends object>(a: T, b: T): boolean {
  return (Object.keys(a) as (keyof T)[]).some((k) => a[k] !== b[k]);
}

export const RANGES = {
  daily_goal: { min: 0, max: 100000 },
  cancellation_policy_hours: { min: 0, max: 168 },
  cancellation_fee_percent: { min: 0, max: 100 },
  deposit_value: { min: 0, max: 100000 },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s\-()]+$/;
const INSTAGRAM_RE = /^[A-Za-z0-9._]{1,30}$/;

function phoneOk(v: string) {
  if (!PHONE_RE.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

function urlOk(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function numberIn(v: string, min: number, max: number, integer = false) {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

/** Strips a leading @ or a pasted profile URL down to the handle. */
export function normalizeInstagram(v: string): string {
  return v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

export interface ShopUpdate {
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  google_maps_url: string | null;
  daily_goal: number;
  currency: string;
  timezone: string;
  cancellation_policy_hours: number;
  cancellation_fee_percent: number;
  require_deposit: boolean;
  deposit_type: "percentage" | "fixed";
  deposit_value: number;
}

export function validateShopForm(form: ShopForm): {
  errors: Partial<Record<ShopField, FieldError>>;
  update: ShopUpdate | null;
} {
  const errors: Partial<Record<ShopField, FieldError>> = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 100) errors.name = "name";
  const description = form.description.trim();
  if (description.length > 500) errors.description = "description";
  const email = form.email.trim();
  if (email && (!EMAIL_RE.test(email) || email.length > 254)) errors.email = "email";
  const phone = form.phone.trim();
  if (phone && !phoneOk(phone)) errors.phone = "phone";
  const whatsapp = form.whatsapp.trim();
  if (whatsapp && !phoneOk(whatsapp)) errors.whatsapp = "phone";
  const instagram = normalizeInstagram(form.instagram);
  if (instagram && !INSTAGRAM_RE.test(instagram)) errors.instagram = "instagram";
  const maps = form.google_maps_url.trim();
  if (maps && !urlOk(maps)) errors.google_maps_url = "url";

  const goal = numberIn(form.daily_goal, RANGES.daily_goal.min, RANGES.daily_goal.max);
  if (goal === null) errors.daily_goal = "range";
  const hours = numberIn(
    form.cancellation_policy_hours,
    RANGES.cancellation_policy_hours.min,
    RANGES.cancellation_policy_hours.max,
    true,
  );
  if (hours === null) errors.cancellation_policy_hours = "range";
  const fee = numberIn(form.cancellation_fee_percent, RANGES.cancellation_fee_percent.min, RANGES.cancellation_fee_percent.max);
  if (fee === null) errors.cancellation_fee_percent = "range";
  const depositMax = form.deposit_type === "percentage" ? 100 : RANGES.deposit_value.max;
  const deposit = form.require_deposit ? numberIn(form.deposit_value, 0, depositMax) : Number(form.deposit_value) || 0;
  if (form.require_deposit && (deposit === null || deposit <= 0)) errors.deposit_value = "range";

  if (Object.keys(errors).length > 0) return { errors, update: null };
  return {
    errors,
    update: {
      name,
      description: description || null,
      email: email || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      instagram: instagram || null,
      address: form.address.trim() || null,
      google_maps_url: maps || null,
      daily_goal: goal as number,
      currency: form.currency,
      timezone: form.timezone,
      cancellation_policy_hours: hours as number,
      cancellation_fee_percent: fee as number,
      require_deposit: form.require_deposit,
      deposit_type: form.deposit_type,
      deposit_value: Math.max(0, deposit ?? 0),
    },
  };
}

// ─── Working hours ───

export interface DayHours {
  day: number; // 0 = Sunday … 6 = Saturday
  isWorking: boolean;
  start: string; // "HH:mm"
  end: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
}

export type DayHoursError = "order" | "break";

export interface WorkingHoursRow {
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  is_working: boolean | null;
  break_start: string | null;
  break_end: string | null;
}

export const DEFAULT_DAY: Omit<DayHours, "day"> = {
  isWorking: true,
  start: "10:00",
  end: "20:00",
  hasBreak: false,
  breakStart: "14:00",
  breakEnd: "15:00",
};

const hhmm = (v: string | null | undefined, fallback: string) => (v ? v.slice(0, 5) : fallback);

export function rowsToWeek(rows: WorkingHoursRow[] | null | undefined): DayHours[] {
  const byDay = new Map((rows ?? []).map((r) => [r.day_of_week, r]));
  return Array.from({ length: 7 }, (_, day) => {
    const r = byDay.get(day);
    if (!r) return { day, ...DEFAULT_DAY };
    const hasBreak = !!(r.break_start && r.break_end);
    return {
      day,
      isWorking: r.is_working !== false,
      start: hhmm(r.start_time, DEFAULT_DAY.start),
      end: hhmm(r.end_time, DEFAULT_DAY.end),
      hasBreak,
      breakStart: hhmm(r.break_start, DEFAULT_DAY.breakStart),
      breakEnd: hhmm(r.break_end, DEFAULT_DAY.breakEnd),
    };
  });
}

export function isWeekDirty(a: DayHours[], b: DayHours[]): boolean {
  return a.length !== b.length || a.some((d, i) => isFormDirty(d, b[i]));
}

/** "HH:mm" strings compare correctly as text. */
export function validateWeek(week: DayHours[]): Record<number, DayHoursError> {
  const errors: Record<number, DayHoursError> = {};
  for (const d of week) {
    if (!d.isWorking) continue;
    if (!d.start || !d.end || d.end <= d.start) {
      errors[d.day] = "order";
      continue;
    }
    if (d.hasBreak && (!d.breakStart || !d.breakEnd || d.breakEnd <= d.breakStart || d.breakStart < d.start || d.breakEnd > d.end)) {
      errors[d.day] = "break";
    }
  }
  return errors;
}

/** Rows for upsert on (barber_id, day_of_week); satisfies the DB CHECKs. */
export function weekToRows(barberId: string, week: DayHours[]) {
  return week.map((d) => {
    const keepBreak = d.isWorking && d.hasBreak;
    return {
      barber_id: barberId,
      day_of_week: d.day,
      start_time: d.start || DEFAULT_DAY.start,
      end_time: d.end || DEFAULT_DAY.end,
      is_working: d.isWorking,
      break_start: keepBreak ? d.breakStart : null,
      break_end: keepBreak ? d.breakEnd : null,
    };
  });
}

/** Copies one day's times onto every other working day. */
export function copyDayToWorkingDays(week: DayHours[], sourceDay: number): DayHours[] {
  const src = week.find((d) => d.day === sourceDay);
  if (!src) return week;
  return week.map((d) =>
    d.day === sourceDay || !d.isWorking
      ? d
      : { ...d, start: src.start, end: src.end, hasBreak: src.hasBreak, breakStart: src.breakStart, breakEnd: src.breakEnd },
  );
}
