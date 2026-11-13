// ═══════════════════════════════════════════════════════
// WS-P0V availability engine — TypeScript wrapper.
//
// Every booking surface (public booking, staff calendar, reschedule,
// waitlist, "next available") calls these instead of computing slots on
// the client. The SQL functions apply working hours, overrides, special
// hours, closures, time off, blocked time, holds, buffers, processing time,
// min notice, booking window and slot interval, and they understand night
// shifts that run past midnight in the shop's time zone.
// ═══════════════════════════════════════════════════════

import type {
  AvailabilityErrorCode,
  AvailabilityItem,
  AvailableSlot,
  AvailableSlotRow,
  DayPart,
  NextSlotQuery,
  RpcClient,
  SlotCheck,
  SlotQuery,
} from "./types";

export * from "./types";
export { expandRecurrence, parseRrule, type RecurrenceRule } from "./recurrence";

/** Max days per get_available_slots call (mirrors the SQL guard). */
export const MAX_RANGE_DAYS = 62;
/** Max items per booking (mirrors the SQL guard). */
export const MAX_ITEMS = 10;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class AvailabilityError extends Error {
  readonly code: AvailabilityErrorCode;
  constructor(code: AvailabilityErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AvailabilityError";
    this.code = code;
  }
}

/** Maps a Supabase RPC error to an availability error code. */
export function availabilityErrorCode(
  error: { message?: string | null; code?: string | null } | null | undefined,
): AvailabilityErrorCode | null {
  if (!error) return null;
  const msg = (error.message ?? "").trim();
  if (msg === "INVALID_INPUT" || msg === "SERVICE_INVALID" || msg === "SHOP_NOT_FOUND") return msg;
  if (error.code === "22P02") return "SERVICE_INVALID"; // bad uuid text
  return "UNKNOWN";
}

/** Items → the jsonb the SQL expects (["uuid", …]), de-duplicated, order kept. */
export function toItemsPayload(items: ReadonlyArray<AvailabilityItem | string>): string[] {
  const ids: string[] = [];
  for (const item of items) {
    const id = typeof item === "string" ? item : item?.serviceId;
    if (typeof id === "string" && id.length > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function normalizeBarber(barberId: string | null | undefined): string | null {
  return barberId && barberId !== "any" ? barberId : null;
}

function toIso(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) throw new AvailabilityError("INVALID_INPUT", "Invalid date");
  return d.toISOString();
}

/** Inclusive day count between two "yyyy-MM-dd" strings (calendar math, TZ-free). */
export function daySpan(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

function validateItems(items: ReadonlyArray<AvailabilityItem | string>): string[] {
  const ids = toItemsPayload(items);
  if (ids.length === 0 || ids.length > MAX_ITEMS) throw new AvailabilityError("INVALID_INPUT", "1–10 services required");
  return ids;
}

/** Parses one SQL row; returns null for malformed rows. */
export function mapSlotRow(row: AvailableSlotRow | null | undefined): AvailableSlot | null {
  if (!row || typeof row.start_time !== "string" || typeof row.end_time !== "string") return null;
  const start = Date.parse(row.start_time);
  const end = Date.parse(row.end_time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const barberIds = Array.isArray(row.barber_ids) ? row.barber_ids.filter((id): id is string => typeof id === "string") : [];
  if (barberIds.length === 0) return null;
  return {
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
    localDate: String(row.local_date).slice(0, 10),
    localTime: String(row.local_time).slice(0, 5),
    barberIds,
    durationMin: Math.round((end - start) / 60_000),
  };
}

function mapRows(data: unknown): AvailableSlot[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((r) => mapSlotRow(r as AvailableSlotRow))
    .filter((s): s is AvailableSlot => s !== null)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/**
 * Bookable starts between two shop-local dates (inclusive).
 * Throws AvailabilityError on invalid input or RPC failure.
 */
export async function getAvailableSlots(client: RpcClient, query: SlotQuery): Promise<AvailableSlot[]> {
  const dateTo = query.dateTo ?? query.dateFrom;
  if (!query.shopId || !DATE_RE.test(query.dateFrom) || !DATE_RE.test(dateTo)) {
    throw new AvailabilityError("INVALID_INPUT", "shopId and yyyy-MM-dd dates required");
  }
  const span = daySpan(query.dateFrom, dateTo);
  if (span < 0 || span > MAX_RANGE_DAYS) throw new AvailabilityError("INVALID_INPUT", "Date range out of bounds");
  const items = validateItems(query.items);

  const { data, error } = await client.rpc("get_available_slots", {
    p_shop_id: query.shopId,
    p_date_from: query.dateFrom,
    p_date_to: dateTo,
    p_items: items,
    p_barber_id: normalizeBarber(query.barberId),
    p_ignore_appointment_id: query.ignoreAppointmentId ?? null,
    p_ignore_hold_id: query.ignoreHoldId ?? null,
  });
  if (error) throw new AvailabilityError(availabilityErrorCode(error) ?? "UNKNOWN", error.message ?? undefined);
  return mapRows(data);
}

/** First bookable start (or null) within the shop's booking window. */
export async function nextAvailableSlot(client: RpcClient, query: NextSlotQuery): Promise<AvailableSlot | null> {
  if (!query.shopId) throw new AvailabilityError("INVALID_INPUT", "shopId required");
  const items = validateItems(query.items);
  const { data, error } = await client.rpc("next_available_slot", {
    p_shop_id: query.shopId,
    p_items: items,
    p_barber_id: normalizeBarber(query.barberId),
    p_after: query.after ? toIso(query.after) : null,
  });
  if (error) throw new AvailabilityError(availabilityErrorCode(error) ?? "UNKNOWN", error.message ?? undefined);
  return mapRows(data)[0] ?? null;
}

/** Exact check for one start (off-grid allowed). Writers must re-check under the barber lock. */
export async function isSlotBookable(client: RpcClient, check: SlotCheck): Promise<boolean> {
  if (!check.shopId) throw new AvailabilityError("INVALID_INPUT", "shopId required");
  const items = validateItems(check.items);
  const { data, error } = await client.rpc("is_slot_bookable", {
    p_shop_id: check.shopId,
    p_start: toIso(check.start),
    p_items: items,
    p_barber_id: normalizeBarber(check.barberId),
    p_ignore_appointment_id: check.ignoreAppointmentId ?? null,
    p_ignore_hold_id: check.ignoreHoldId ?? null,
  });
  if (error) throw new AvailabilityError(availabilityErrorCode(error) ?? "UNKNOWN", error.message ?? undefined);
  return data === true;
}

/** Auto-assign preview (authenticated callers only): the barber the engine would pick, or null. */
export async function pickAnyBarber(
  client: RpcClient,
  check: Omit<SlotCheck, "barberId">,
): Promise<string | null> {
  if (!check.shopId) throw new AvailabilityError("INVALID_INPUT", "shopId required");
  const items = validateItems(check.items);
  const { data, error } = await client.rpc("pick_any_barber", {
    p_shop_id: check.shopId,
    p_start: toIso(check.start),
    p_items: items,
    p_ignore_appointment_id: check.ignoreAppointmentId ?? null,
    p_ignore_hold_id: check.ignoreHoldId ?? null,
  });
  if (error) throw new AvailabilityError(availabilityErrorCode(error) ?? "UNKNOWN", error.message ?? undefined);
  return typeof data === "string" ? data : null;
}

// ─── Pure helpers for UIs ───

/** Slots grouped by shop-local date, dates ascending. */
export function groupSlotsByDate(slots: ReadonlyArray<AvailableSlot>): Map<string, AvailableSlot[]> {
  const out = new Map<string, AvailableSlot[]>();
  for (const s of [...slots].sort((a, b) => a.startIso.localeCompare(b.startIso))) {
    const list = out.get(s.localDate);
    if (list) list.push(s);
    else out.set(s.localDate, [s]);
  }
  return out;
}

/**
 * Day part of a local "HH:mm": morning < 12:00 ≤ afternoon < 17:00 ≤ evening
 * < 22:00 ≤ night; 00:00–04:59 is also night (Ramadan late shifts).
 */
export function dayPartOf(localTime: string): DayPart {
  const h = Number(localTime.slice(0, 2));
  if (!Number.isFinite(h) || h < 5 || h >= 22) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/**
 * Slots for a picker on one "service day": starts on `date` from 05:00, plus
 * the after-midnight tail of that night (next date before 05:00), so a
 * 20:00–02:00 Ramadan shift reads as one evening. Pass slots covering
 * `date` and the next date.
 */
export function slotsForServiceDay(slots: ReadonlyArray<AvailableSlot>, date: string, nextDate: string): AvailableSlot[] {
  return slots
    .filter(
      (s) =>
        (s.localDate === date && s.localTime >= "05:00") ||
        (s.localDate === nextDate && s.localTime < "05:00"),
    )
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/** Groups (in order) for a slot picker, dropping empty groups. */
export function groupSlotsByDayPart(slots: ReadonlyArray<AvailableSlot>): { key: DayPart; items: AvailableSlot[] }[] {
  const order: DayPart[] = ["morning", "afternoon", "evening", "night"];
  const buckets = new Map<DayPart, AvailableSlot[]>(order.map((k) => [k, []]));
  for (const s of slots) buckets.get(dayPartOf(s.localTime))!.push(s);
  return order.map((key) => ({ key, items: buckets.get(key)! })).filter((g) => g.items.length > 0);
}
