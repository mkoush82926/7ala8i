import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AppointmentStatus, BookingSource, PaymentMethod } from "@/lib/types";
import { startOfDay, endOfDay } from "date-fns";

type Client = SupabaseClient<Database>;

/** Columns the dashboard calendar / receipts need (no `select("*")`). */
export const APPOINTMENT_COLUMNS =
  "id, shop_id, client_id, barber_id, service_ids, client_name, service_name, start_time, end_time, status, price, currency, notes, source, payment_status, payment_method, created_at";

/**
 * Calendar v2 (WS-1E): the base columns plus front-desk timestamps
 * (migration 20250101002400) and the 1D service lines.
 */
export const CALENDAR_APPOINTMENT_COLUMNS = `${APPOINTMENT_COLUMNS}, arrived_at, started_at, appointment_services(service_id, name, name_ar, duration, sort)`;

// ─── Day boundaries ───
// "yyyy-MM-dd" → the local-midnight Date (NOT `new Date("yyyy-MM-dd")`, which
// is UTC midnight and lands on the previous day west of Greenwich).
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Inclusive [start, end] bounds of a local calendar day range, as ISO strings
 * WITH an offset (UTC "Z"). Offset-less strings would be interpreted in the
 * Postgres session time zone (UTC), shifting late-evening bookings to the
 * wrong day.
 */
export function dayRangeBounds(startDate: string, endDate: string = startDate) {
  return {
    from: startOfDay(parseDay(startDate)).toISOString(),
    to: endOfDay(parseDay(endDate)).toISOString(),
  };
}

// ─── Today's Appointments ───
export async function getTodayAppointments(supabase: Client, shopId: string, now: Date = new Date()) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .select(APPOINTMENT_COLUMNS)
    .eq("shop_id", shopId)
    .gte("start_time", startOfDay(now).toISOString())
    .lte("start_time", endOfDay(now).toISOString())
    .order("start_time", { ascending: true });
}

// ─── Upcoming (future pending/confirmed) ───
export async function getUpcomingAppointments(
  supabase: Client,
  shopId: string,
  limit = 5,
  now: Date = new Date(),
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .select(APPOINTMENT_COLUMNS)
    .eq("shop_id", shopId)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", now.toISOString())
    .order("start_time", { ascending: true })
    .limit(limit);
}

// ─── Appointments by Date Range ("yyyy-MM-dd", inclusive, local days) ───
export async function getAppointmentsByDateRange(
  supabase: Client,
  shopId: string,
  startDate: string,
  endDate: string,
  barberId?: string,
  columns: string = APPOINTMENT_COLUMNS,
) {
  const { from, to } = dayRangeBounds(startDate, endDate);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("appointments") as any)
    .select(columns)
    .eq("shop_id", shopId)
    .gte("start_time", from)
    .lte("start_time", to)
    .order("start_time", { ascending: true });

  if (barberId) {
    query = query.eq("barber_id", barberId);
  }

  return query;
}

// ─── Busy slots for a date (+ optional barber) ───
// Uses the get_busy_slots RPC: anon can no longer read appointments directly,
// and the RPC computes the day in the shop's time zone.
export async function getAvailableSlots(
  supabase: Client,
  shopId: string,
  date: string,
  barberId?: string | null,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc("get_busy_slots", {
    p_shop_id: shopId,
    p_day: date,
    p_barber_id: barberId && barberId !== "any" ? barberId : null,
  }) as Promise<{
    data: { barber_id: string | null; start_time: string; end_time: string }[] | null;
    error: { message: string; code?: string } | null;
  }>;
}

// ─── Update appointment status ───
// updated_at, cancelled_at and no_show are set by DB triggers.
export async function updateAppointmentStatus(
  supabase: Client,
  appointmentId: string,
  status: AppointmentStatus,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .update({ status })
    .eq("id", appointmentId)
    .select()
    .single();
}

// ─── Staff-created appointment (walk-in / phone / DM) ───
export interface StaffAppointmentInput {
  shopId: string;
  barberId: string | null;
  clientId?: string | null;
  /** Walk-ins can be saved without a name (null). */
  clientName: string | null;
  serviceIds: string[];
  serviceName: string;
  startTime: string; // ISO with offset
  endTime: string; // ISO with offset
  price: number;
  currency?: string | null;
  notes?: string | null;
  source?: BookingSource;
  status?: Extract<AppointmentStatus, "pending" | "confirmed" | "arrived" | "in_chair">;
}

/**
 * Inserts an appointment as staff (RLS: admins any barber; barbers only
 * themselves or unassigned). An overlap raises 23P01 → SLOT_TAKEN.
 */
export async function createStaffAppointment(supabase: Client, input: StaffAppointmentInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .insert({
      shop_id: input.shopId,
      barber_id: input.barberId,
      client_id: input.clientId ?? null,
      client_name: input.clientName?.trim() || null,
      service_ids: input.serviceIds,
      service_name: input.serviceName,
      start_time: input.startTime,
      end_time: input.endTime,
      price: input.price,
      ...(input.currency ? { currency: input.currency } : {}),
      notes: input.notes ?? null,
      source: input.source ?? "walk_in",
      status: input.status ?? "confirmed",
    })
    .select(APPOINTMENT_COLUMNS)
    .single();
}

export type StaffAppointmentPatch = Partial<
  Pick<
    StaffAppointmentInput,
    "barberId" | "clientName" | "serviceIds" | "serviceName" | "startTime" | "endTime" | "price" | "notes"
  >
>;

/** Edit / reschedule. Only the provided fields are sent (never updated_at). */
export async function updateStaffAppointment(
  supabase: Client,
  appointmentId: string,
  patch: StaffAppointmentPatch,
) {
  const updates: Record<string, unknown> = {};
  if (patch.barberId !== undefined) updates.barber_id = patch.barberId;
  if (patch.clientName !== undefined) updates.client_name = patch.clientName?.trim() || null;
  if (patch.serviceIds !== undefined) updates.service_ids = patch.serviceIds;
  if (patch.serviceName !== undefined) updates.service_name = patch.serviceName;
  if (patch.startTime !== undefined) updates.start_time = patch.startTime;
  if (patch.endTime !== undefined) updates.end_time = patch.endTime;
  if (patch.price !== undefined) updates.price = patch.price;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("appointments") as any)
    .update(updates)
    .eq("id", appointmentId)
    .select(APPOINTMENT_COLUMNS)
    .single();
}

// ─── Complete + record the sale atomically (idempotent) ───
export async function completeAppointmentSale(
  supabase: Client,
  appointmentId: string,
  paymentMethod: PaymentMethod,
  amount?: number | null,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc("complete_appointment_sale", {
    p_appointment_id: appointmentId,
    p_payment_method: paymentMethod,
    p_amount: amount ?? null,
  }) as Promise<{
    data: { appointment_id: string; sale_id: string; status: "completed"; amount: number } | null;
    error: { message: string; code?: string } | null;
  }>;
}

// ─── Error → stable code (for t.error.codes[code]) ───
const PG_CODE_MAP: Record<string, string> = {
  "23P01": "SLOT_TAKEN", // exclusion_violation (appointments_no_overlap)
  "23505": "CONFLICT",
  "23503": "INVALID_INPUT",
  "23514": "INVALID_INPUT",
  "22P02": "INVALID_INPUT",
  "42501": "FORBIDDEN", // RLS / privilege
  PGRST116: "NOT_FOUND",
  PGRST301: "UNAUTHORIZED",
};

/**
 * Extracts a stable error code from a Supabase/PostgREST error, an RPC error
 * (`message` is the code, e.g. "SLOT_TAKEN") or an API JSON body (`code`).
 * Returns null when nothing recognisable is present.
 */
export function errorCodeOf(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message.trim() : "";
  const code = typeof e.code === "string" ? e.code : "";
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(message)) return message;
  if (code && PG_CODE_MAP[code]) return PG_CODE_MAP[code];
  if (/^[A-Z][A-Z_]{2,}$/.test(code)) return code;
  return null;
}

/** Overlap check used before submitting a staff booking (UX only — the DB enforces it). */
export function overlapsAny(
  start: Date,
  end: Date,
  busy: { start_time: string; end_time: string }[],
): boolean {
  const s = start.getTime();
  const e = end.getTime();
  return busy.some((b) => {
    const bs = new Date(b.start_time).getTime();
    const be = new Date(b.end_time).getTime();
    return s < be && bs < e;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Calendar v2 / front desk (WS-1E)
// ═══════════════════════════════════════════════════════════════════════════

type RpcResult<T> = Promise<{ data: T | null; error: { message: string; code?: string } | null }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (supabase: Client) => supabase as any;

/** Undo a no-show (staff; barbers only their own). 23P01 → SLOT_TAKEN when the time was rebooked. */
export function undoNoShow(supabase: Client, appointmentId: string): RpcResult<{ appointment_id: string; status: "confirmed" }> {
  return db(supabase).rpc("undo_no_show", { p_appointment_id: appointmentId });
}

// ─── Team presentation (profiles.calendar_order / calendar_color) ───
export interface CalendarTeamMeta {
  id: string;
  calendar_order: number | null;
  calendar_color: string | null;
}

export function getCalendarTeamMeta(supabase: Client, shopId: string): RpcResult<CalendarTeamMeta[]> {
  return db(supabase)
    .from("profiles")
    .select("id, calendar_order, calendar_color")
    .eq("shop_id", shopId)
    .in("role", ["barber", "shop_admin"]);
}

/** Admin only: saves the shared column order (and colours when given). */
export function saveCalendarTeam(
  supabase: Client,
  items: { id: string; order: number; color?: string | null }[],
): RpcResult<number> {
  return db(supabase).rpc("save_calendar_team", { p_items: items });
}

// ─── Schedule inputs for shading and "Scheduled team" ───
export async function getScheduleInputs(supabase: Client, shopId: string, from: string, to: string, barberIds: string[]) {
  const { from: fromIso, to: toIso } = dayRangeBounds(from, to);
  const ids = barberIds.length ? barberIds : ["00000000-0000-0000-0000-000000000000"];
  const [wh, ov, off, closed, special] = await Promise.all([
    db(supabase).from("working_hours").select("barber_id, day_of_week, start_time, end_time, is_working, break_start, break_end").in("barber_id", ids),
    db(supabase).from("shift_overrides").select("barber_id, date, segments").eq("shop_id", shopId).gte("date", from).lte("date", to),
    db(supabase).from("time_off").select("barber_id, start_time, end_time, status").eq("shop_id", shopId).eq("status", "approved").lt("start_time", toIso).gt("end_time", fromIso),
    db(supabase).from("closed_periods").select("start_date, end_date").eq("shop_id", shopId).lte("start_date", to).gte("end_date", from),
    db(supabase).from("special_hours").select("date, is_closed, segments").eq("shop_id", shopId).gte("date", from).lte("date", to),
  ]);
  return {
    workingHours: (wh.data ?? []) as {
      barber_id: string;
      day_of_week: number;
      start_time: string | null;
      end_time: string | null;
      is_working: boolean | null;
      break_start: string | null;
      break_end: string | null;
    }[],
    overrides: (ov.data ?? []) as { barber_id: string; date: string; segments: unknown }[],
    timeOff: (off.data ?? []) as { barber_id: string; start_time: string; end_time: string; status: string }[],
    closures: (closed.data ?? []) as { start_date: string; end_date: string }[],
    specialHours: (special.data ?? []) as { date: string; is_closed: boolean; segments: unknown }[],
    // Any failure degrades to "everyone scheduled" (no shading) rather than an error state.
    error: wh.error ?? ov.error ?? off.error ?? closed.error ?? special.error ?? null,
  };
}

// ─── Blocked time ───
export interface BlockedTimeRow {
  id: string;
  shop_id: string;
  barber_id: string | null;
  start_time: string;
  end_time: string;
  type_id: string | null;
  title: string | null;
  rrule: string | null;
  series_id: string | null;
  source: "manual" | "prayer";
  allow_online: boolean;
}

export interface BlockTypeRow {
  id: string;
  name_en: string;
  name_ar: string | null;
  emoji: string | null;
  default_minutes: number | null;
  is_active: boolean;
  sort_order: number | null;
  system_key: string | null;
}

export const BLOCKED_TIME_COLUMNS = "id, shop_id, barber_id, start_time, end_time, type_id, title, rrule, series_id, source, allow_online";

export function getBlockedTimes(supabase: Client, shopId: string, from: string, to: string): RpcResult<BlockedTimeRow[]> {
  const { from: fromIso, to: toIso } = dayRangeBounds(from, to);
  return db(supabase)
    .from("blocked_times")
    .select(BLOCKED_TIME_COLUMNS)
    .eq("shop_id", shopId)
    .lt("start_time", toIso)
    .gt("end_time", fromIso)
    .order("start_time", { ascending: true });
}

export function getBlockTypes(supabase: Client, shopId: string): RpcResult<BlockTypeRow[]> {
  return db(supabase)
    .from("blocked_time_types")
    .select("id, name_en, name_ar, emoji, default_minutes, is_active, sort_order, system_key")
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true });
}

/** Admin only: seeds Prayer / Jumu'ah / Lunch / Admin types when missing. */
export function ensureDefaultBlockTypes(supabase: Client): RpcResult<number> {
  return db(supabase).rpc("ensure_default_block_types");
}

export function insertBlockedTimes(
  supabase: Client,
  rows: Omit<BlockedTimeRow, "id">[],
): RpcResult<BlockedTimeRow[]> {
  return db(supabase).from("blocked_times").insert(rows).select(BLOCKED_TIME_COLUMNS);
}

export function updateBlockedTime(
  supabase: Client,
  id: string,
  patch: Partial<Pick<BlockedTimeRow, "barber_id" | "start_time" | "end_time" | "type_id" | "title" | "allow_online">>,
): RpcResult<BlockedTimeRow> {
  return db(supabase).from("blocked_times").update(patch).eq("id", id).select(BLOCKED_TIME_COLUMNS).single();
}

/** Deletes one occurrence, or this and every later occurrence of its series. */
export function deleteBlockedTimes(
  supabase: Client,
  target: { id: string } | { seriesId: string; fromIso: string },
): RpcResult<null> {
  const q = db(supabase).from("blocked_times").delete();
  return "id" in target ? q.eq("id", target.id) : q.eq("series_id", target.seriesId).gte("start_time", target.fromIso);
}

// ─── Prayer blocks ───
export interface PrayerRuleRow {
  prayer: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
  enabled: boolean;
  minutes: number;
  start_offset_minutes: number;
  jumuah_minutes: number;
  allow_online: boolean;
}

export function getPrayerRules(supabase: Client, shopId: string): RpcResult<PrayerRuleRow[]> {
  return db(supabase)
    .from("prayer_block_rules")
    .select("prayer, enabled, minutes, start_offset_minutes, jumuah_minutes, allow_online")
    .eq("shop_id", shopId);
}

export function savePrayerRules(supabase: Client, shopId: string, rules: PrayerRuleRow[]): RpcResult<null> {
  return db(supabase)
    .from("prayer_block_rules")
    .upsert(rules.map((r) => ({ ...r, shop_id: shopId })), { onConflict: "shop_id,prayer" });
}

/** Rewrites future prayer blocks for the next `days` days (admin of the shop). */
export function generatePrayerBlocks(supabase: Client, shopId: string, days = 14): RpcResult<number> {
  return db(supabase).rpc("generate_prayer_blocks", { p_shop_id: shopId, p_days: days });
}

/** City (and pin) used for the shop's prayer timetable. */
export function getShopLocation(
  supabase: Client,
  shopId: string,
): RpcResult<{ lat: number | null; lng: number | null; city: { lat: number | null; lng: number | null } | null }> {
  return db(supabase).from("shops").select("lat, lng, city:cities(lat, lng)").eq("id", shopId).maybeSingle();
}

// ─── Walk-in queue ───
export const QUEUE_COLUMNS =
  "id, shop_id, ticket_no, client_name, phone, client_id, service_ids, preferred_barber_id, assigned_barber_id, appointment_id, status, note, checked_in_at, called_at, started_at, finished_at";

/** Today's queue: everything still waiting/serving plus what finished since `sinceIso`. */
export function getQueue(supabase: Client, shopId: string, sinceIso: string): RpcResult<Record<string, unknown>[]> {
  return db(supabase)
    .from("walk_in_queue")
    .select(QUEUE_COLUMNS)
    .eq("shop_id", shopId)
    .or(`status.in.(waiting,serving),checked_in_at.gte.${sinceIso}`)
    .order("checked_in_at", { ascending: true })
    .limit(200);
}

export interface WalkInInput {
  clientName?: string | null;
  phone?: string | null;
  clientId?: string | null;
  serviceIds?: string[];
  preferredBarberId?: string | null;
  note?: string | null;
}

export function checkInWalkIn(supabase: Client, shopId: string, input: WalkInInput): RpcResult<Record<string, unknown>> {
  return db(supabase)
    .from("walk_in_queue")
    .insert({
      shop_id: shopId,
      client_name: input.clientName?.trim() || null,
      phone: input.phone?.trim() || null,
      client_id: input.clientId ?? null,
      service_ids: input.serviceIds ?? [],
      preferred_barber_id: input.preferredBarberId ?? null,
      note: input.note?.trim() || null,
    })
    .select(QUEUE_COLUMNS)
    .single();
}

export function updateQueueEntry(
  supabase: Client,
  id: string,
  patch: Partial<{ status: "waiting" | "done" | "left"; preferred_barber_id: string | null; client_name: string | null; note: string | null }>,
): RpcResult<Record<string, unknown>> {
  return db(supabase).from("walk_in_queue").update(patch).eq("id", id).select(QUEUE_COLUMNS).single();
}

/** Seats a waiting walk-in now (explicit → preferred → next free barber via pick_any_barber). */
export function assignQueueEntry(
  supabase: Client,
  entryId: string,
  barberId?: string | null,
): RpcResult<{ entry_id: string; appointment_id: string; barber_id: string; start_time: string; end_time: string; duration: number }> {
  return db(supabase).rpc("queue_assign", { p_entry_id: entryId, p_barber_id: barberId ?? null });
}
