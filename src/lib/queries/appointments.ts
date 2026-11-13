import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AppointmentStatus, BookingSource, PaymentMethod } from "@/lib/types";
import { startOfDay, endOfDay } from "date-fns";

type Client = SupabaseClient<Database>;

/** Columns the dashboard calendar / receipts need (no `select("*")`). */
export const APPOINTMENT_COLUMNS =
  "id, shop_id, client_id, barber_id, service_ids, client_name, service_name, start_time, end_time, status, price, currency, notes, source, payment_status, payment_method, created_at";

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
) {
  const { from, to } = dayRangeBounds(startDate, endDate);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("appointments") as any)
    .select(APPOINTMENT_COLUMNS)
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
  clientName: string;
  serviceIds: string[];
  serviceName: string;
  startTime: string; // ISO with offset
  endTime: string; // ISO with offset
  price: number;
  currency?: string | null;
  notes?: string | null;
  source?: BookingSource;
  status?: Extract<AppointmentStatus, "pending" | "confirmed">;
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
      client_name: input.clientName,
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
  if (patch.clientName !== undefined) updates.client_name = patch.clientName;
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
