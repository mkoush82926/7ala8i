/**
 * Formatting for the back office. Times are shown in Amman time (the whole
 * marketplace runs on Asia/Amman) so agents in different places agree.
 */
import { ADMIN_COPY } from "./dictionary";

export const ADMIN_TIMEZONE = "Asia/Amman";
const LOCALE = "en-GB";

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "13 Nov 2026, 14:05" in Amman time; "—" when empty. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return ADMIN_COPY.common.dash;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ADMIN_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** "13 Nov 2026" in Amman time. */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return ADMIN_COPY.common.dash;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ADMIN_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "3 hours ago" / "in 25 minutes"; "just now" under a minute. */
export function formatRelative(value: string | number | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return ADMIN_COPY.common.dash;
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, "second");
}

/** Integer with thousands separators; "—" for null. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ADMIN_COPY.common.dash;
  return new Intl.NumberFormat("en-US").format(value);
}

/** Rating to one decimal ("4.6"); "—" when there are no ratings. */
export function formatRating(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return ADMIN_COPY.common.dash;
  return n.toFixed(1);
}

/** JOD with 3 decimals, as the POS stores it. */
export function formatJodPlain(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return ADMIN_COPY.common.dash;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
}

export interface DiffChange {
  field: string;
  before: string;
  after: string;
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return ADMIN_COPY.common.dash;
  if (typeof value === "boolean") return value ? ADMIN_COPY.common.yes : ADMIN_COPY.common.no;
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  // Timestamps from jsonb: show them in Amman time.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return formatDateTime(s);
  return s;
}

/**
 * Turns an audit diff ({before:{…}, after:{…}, …}) into field-level changes.
 * Extra keys (shop_id, session_id, …) become "after-only" rows.
 */
export function summarizeDiff(diff: Record<string, unknown> | null | undefined): DiffChange[] {
  if (!diff || typeof diff !== "object") return [];
  const before = (diff.before && typeof diff.before === "object" ? diff.before : {}) as Record<string, unknown>;
  const after = (diff.after && typeof diff.after === "object" ? diff.after : {}) as Record<string, unknown>;
  const changes: DiffChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const a = show(before[key]);
    const b = show(after[key]);
    if (a === b) continue;
    changes.push({ field: key, before: a, after: b });
  }
  for (const [key, value] of Object.entries(diff)) {
    if (key === "before" || key === "after") continue;
    changes.push({ field: key, before: "", after: show(value) });
  }
  return changes;
}

/** "in 24 minutes" style countdown for an impersonation session. */
export function formatExpiry(expiresAt: string, now: Date = new Date()): string {
  return formatRelative(expiresAt, now);
}

/** True when an ISO timestamp is in the past. */
export function isPast(value: string | null | undefined, now: Date = new Date()): boolean {
  const d = toDate(value);
  return !!d && d.getTime() <= now.getTime();
}
