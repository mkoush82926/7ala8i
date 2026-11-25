// ═══════════════════════════════════════════════════════════════════════════
// Pure helpers for the dashboard messaging page (/settings/messaging):
// reminder offsets, quiet-hours form state, the delivery log and the
// month's cost against the plan allowance.
// ═══════════════════════════════════════════════════════════════════════════
import { buildWaLink } from "./phone";
import { renderMessage } from "./templates";
import type { OutboxPayload, OutboxStatus, TemplateId } from "./types";

/** Reminder offsets the settings page offers (minutes before the visit). */
export const OFFSET_PRESETS = [10080, 2880, 1440, 720, 240, 120, 60, 30] as const;
export const MAX_OFFSETS = 4;
export const DEFAULT_OFFSETS = [1440, 120];

export type OffsetUnit = "days" | "hours" | "minutes";

/** 1440 → {value: 1, unit: "days"}, 120 → {2, "hours"}, 30 → {30, "minutes"}. */
export function offsetParts(minutes: number): { value: number; unit: OffsetUnit } {
  if (minutes >= 1440 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes >= 60 && minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

/** Same rule as messaging_offsets_valid(): ≤4 distinct values in 15..10080. */
export function offsetsValid(offsets: readonly number[]): boolean {
  return (
    offsets.length <= MAX_OFFSETS &&
    new Set(offsets).size === offsets.length &&
    offsets.every((v) => Number.isInteger(v) && v >= 15 && v <= 10080)
  );
}

/** Adds or removes one offset; keeps them sorted (furthest first). */
export function toggleOffset(offsets: readonly number[], value: number): number[] {
  const has = offsets.includes(value);
  const next = has ? offsets.filter((v) => v !== value) : [...offsets, value];
  if (!has && next.length > MAX_OFFSETS) return [...offsets].sort((a, b) => b - a);
  return next.sort((a, b) => b - a);
}

export function parseOffsets(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_OFFSETS];
  const vals = raw.map((v) => Number(v)).filter((v) => Number.isInteger(v));
  return offsetsValid(vals) ? vals.sort((a, b) => b - a) : [...DEFAULT_OFFSETS];
}

// ─── Settings ────────────────────────────────────────────────────────────────
export interface MessagingSettings {
  reminderOffsets: number[];
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    jumuah: boolean;
    jumuahStart: string;
    jumuahEnd: string;
  };
  messagingEnabled: boolean;
  channel: "whatsapp" | "sms";
  smsFallback: boolean;
  reviewDelayMinutes: number;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = (v: unknown, d: string) => (typeof v === "string" && HHMM.test(v) ? v : d);

export function parseMessagingSettings(row: Record<string, unknown> | null | undefined): MessagingSettings {
  const r = row ?? {};
  const q = (r.quiet_hours && typeof r.quiet_hours === "object" ? r.quiet_hours : {}) as Record<string, unknown>;
  const delay = Number(r.review_request_delay_minutes);
  return {
    reminderOffsets: parseOffsets(r.reminder_offsets),
    quietHours: {
      enabled: q.enabled !== false,
      start: hhmm(q.start, "23:00"),
      end: hhmm(q.end, "08:00"),
      jumuah: q.jumuah !== false,
      jumuahStart: hhmm(q.jumuah_start, "11:30"),
      jumuahEnd: hhmm(q.jumuah_end, "13:30"),
    },
    messagingEnabled: r.messaging_enabled !== false,
    channel: r.messaging_channel === "sms" ? "sms" : "whatsapp",
    smsFallback: r.sms_fallback === true,
    reviewDelayMinutes: Number.isFinite(delay) && delay >= 0 && delay <= 2880 ? Math.round(delay) : 120,
  };
}

export type SettingsError = "reminder_offsets" | "quiet_hours" | "jumuah" | "review_delay";

export function validateMessagingSettings(s: MessagingSettings): SettingsError | null {
  if (!offsetsValid(s.reminderOffsets)) return "reminder_offsets";
  const q = s.quietHours;
  if (![q.start, q.end, q.jumuahStart, q.jumuahEnd].every((v) => HHMM.test(v))) return "quiet_hours";
  if (q.enabled && q.start === q.end) return "quiet_hours";
  if (q.jumuah && q.jumuahStart >= q.jumuahEnd) return "jumuah";
  if (!Number.isInteger(s.reviewDelayMinutes) || s.reviewDelayMinutes < 0 || s.reviewDelayMinutes > 2880) return "review_delay";
  return null;
}

/** Payload for update_messaging_settings(p_settings). */
export function toSettingsPayload(s: MessagingSettings): Record<string, unknown> {
  return {
    reminder_offsets: s.reminderOffsets,
    quiet_hours: {
      enabled: s.quietHours.enabled,
      start: s.quietHours.start,
      end: s.quietHours.end,
      jumuah: s.quietHours.jumuah,
      jumuah_start: s.quietHours.jumuahStart,
      jumuah_end: s.quietHours.jumuahEnd,
    },
    messaging_enabled: s.messagingEnabled,
    messaging_channel: s.channel,
    sms_fallback: s.smsFallback,
    review_request_delay_minutes: s.reviewDelayMinutes,
  };
}

// ─── Delivery log ────────────────────────────────────────────────────────────
export interface OutboxRow {
  id: string;
  appointment_id: string | null;
  to_phone: string | null;
  channel: string;
  template: TemplateId;
  locale: string;
  payload: OutboxPayload | null;
  body: string | null;
  status: OutboxStatus;
  scheduled_for: string;
  sent_at: string | null;
  cost_fils: number;
  error: string | null;
  created_at: string;
}

export type StatusTone = "ink" | "brass" | "success" | "danger" | "neutral";

export function statusTone(status: OutboxStatus): StatusTone {
  switch (status) {
    case "delivered":
    case "read":
    case "sent":
      return "success";
    case "failed":
      return "danger";
    case "fallback":
      return "brass";
    case "queued":
    case "sending":
      return "ink";
    default:
      return "neutral";
  }
}

/**
 * Rows staff can still send by hand through wa.me: fallbacks and failures,
 * plus due 'queued' rows when no provider is live (nothing else will send
 * them; the no-provider sweep turns them into fallbacks when it runs).
 */
export function needsManualSend(
  row: Pick<OutboxRow, "status" | "to_phone"> & { scheduled_for?: string | null },
  opts: { live?: boolean; now?: number } = {},
): boolean {
  if (!row.to_phone) return false;
  if (row.status === "fallback" || row.status === "failed") return true;
  if (row.status === "queued" && opts.live === false) {
    const due = row.scheduled_for ? Date.parse(row.scheduled_for) : NaN;
    return Number.isFinite(due) && due <= (opts.now ?? Date.now());
  }
  return false;
}

/** Text of a stored message (rendered from its snapshot when no body). */
export function outboxText(row: Pick<OutboxRow, "template" | "locale" | "body" | "payload">, siteUrl: string): string {
  return renderMessage(row, siteUrl);
}

/** wa.me click-to-send link for a fallback row, or null when no phone/text. */
export function fallbackWaLink(row: OutboxRow, siteUrl: string): string | null {
  if (!row.to_phone) return null;
  const text = outboxText(row, siteUrl);
  return text ? buildWaLink(row.to_phone, text) : null;
}

/** Recipient's first name from the snapshot (never the phone number). */
export function recipientName(row: Pick<OutboxRow, "payload">): string {
  return (row.payload?.ctx?.client_name ?? "").trim();
}

// ─── Cost ────────────────────────────────────────────────────────────────────
export interface MonthCost {
  month: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  fallbackCount: number;
  pendingCount: number;
  smsCount: number;
  costFils: number;
  allowance: number;
}

export function parseMonthCost(row: Record<string, unknown> | null | undefined, month: string): MonthCost {
  const r = row ?? {};
  const n = (k: string) => {
    const v = Number(r[k]);
    return Number.isFinite(v) ? v : 0;
  };
  const allowance = Number(r.allowance);
  return {
    month,
    sentCount: n("sent_count"),
    deliveredCount: n("delivered_count"),
    readCount: n("read_count"),
    failedCount: n("failed_count"),
    fallbackCount: n("fallback_count"),
    pendingCount: n("pending_count"),
    smsCount: n("sms_count"),
    costFils: n("cost_fils"),
    allowance: Number.isFinite(allowance) && allowance >= 0 ? allowance : 300,
  };
}

/** Share of the plan allowance used this month (0..1+), and whether it is over. */
export function allowanceUsage(c: Pick<MonthCost, "sentCount" | "allowance">): { ratio: number; over: boolean; remaining: number } {
  if (c.allowance <= 0) return { ratio: c.sentCount > 0 ? 1 : 0, over: c.sentCount > 0, remaining: 0 };
  const ratio = c.sentCount / c.allowance;
  return { ratio, over: c.sentCount > c.allowance, remaining: Math.max(0, c.allowance - c.sentCount) };
}

/** Fils (1/1000 JOD) → JOD. */
export function filsToJod(fils: number): number {
  return Math.round(fils) / 1000;
}

/** "YYYY-MM-01" for the current month in a time zone (matches the view's month column). */
export function monthStartIn(at: Date, timeZone = "Asia/Amman"): string {
  let ymd: string;
  try {
    ymd = new Intl.DateTimeFormat("en-CA-u-nu-latn", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    ymd = at.toISOString().slice(0, 10);
  }
  return `${ymd.slice(0, 7)}-01`;
}
