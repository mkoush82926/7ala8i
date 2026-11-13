// ═══════════════════════════════════════════════════════
// WS-P0V availability engine — shared types.
// The SQL functions in supabase/migrations/20250101001950_availability_engine.sql
// are the single source of truth; these mirror their shapes.
// ═══════════════════════════════════════════════════════

/** One requested service. Items run back to back with one barber. */
export interface AvailabilityItem {
  serviceId: string;
}

/** Raw row returned by get_available_slots / next_available_slot. */
export interface AvailableSlotRow {
  start_time: string;
  end_time: string;
  local_date: string;
  local_time: string;
  barber_ids: string[] | null;
}

/** A bookable start time, already parsed. */
export interface AvailableSlot {
  /** Absolute start instant (ISO, UTC) — send this back to the booking RPC. */
  startIso: string;
  /** Client end instant (ISO) for the first free barber (durations can differ per barber). */
  endIso: string;
  /** Shop-local calendar date "yyyy-MM-dd" (a 00:30 Ramadan slot is on the next date). */
  localDate: string;
  /** Shop-local wall time "HH:mm". */
  localTime: string;
  /** Barbers free for the whole booking at this start (never empty). */
  barberIds: string[];
  /** Client minutes in the chair for barberIds[0]. */
  durationMin: number;
}

export interface SlotQuery {
  shopId: string;
  /** Shop-local "yyyy-MM-dd", inclusive. */
  dateFrom: string;
  /** Shop-local "yyyy-MM-dd", inclusive; at most 62 days after dateFrom. Defaults to dateFrom. */
  dateTo?: string;
  items: ReadonlyArray<AvailabilityItem | string>;
  /** Specific barber (profiles.id); omit / null / "any" for any barber. */
  barberId?: string | null;
  /** Reschedule: treat this appointment as free (honoured for staff and the owning customer). */
  ignoreAppointmentId?: string | null;
  /** Checkout: treat this hold as free. */
  ignoreHoldId?: string | null;
}

export interface NextSlotQuery {
  shopId: string;
  items: ReadonlyArray<AvailabilityItem | string>;
  barberId?: string | null;
  /** Search from this instant (default: now). */
  after?: Date | string | null;
}

export interface SlotCheck {
  shopId: string;
  start: Date | string;
  items: ReadonlyArray<AvailabilityItem | string>;
  barberId?: string | null;
  ignoreAppointmentId?: string | null;
  ignoreHoldId?: string | null;
}

/** Error codes the availability RPCs raise (P0001, message = code). */
export type AvailabilityErrorCode = "INVALID_INPUT" | "SERVICE_INVALID" | "SHOP_NOT_FOUND" | "UNKNOWN";

export type DayPart = "morning" | "afternoon" | "evening" | "night";

/**
 * Minimal structural client: anything with Supabase's `.rpc()`. Keeps this
 * module independent of the generated Database types (the new RPCs are not
 * in database.types.ts until types are regenerated).
 */
export interface RpcClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string | null; code?: string | null } | null }>;
}
