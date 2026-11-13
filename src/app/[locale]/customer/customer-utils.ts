/**
 * Pure logic for the customer portal (no React, no Supabase) so it can be
 * unit-tested. The DB (cancel_customer_booking) is the authority; these
 * helpers only decide what the UI offers.
 */
import { normalizeAppointmentStatus, type AppointmentStatus } from "@/lib/types";

export type AppointmentTab = "upcoming" | "past" | "cancelled";

export interface AppointmentLike {
  status: string;
  start_time: string;
  cancellation_policy_hours?: number | null;
}

const HOUR_MS = 3_600_000;

export function statusOf(appt: Pick<AppointmentLike, "status">): AppointmentStatus {
  return normalizeAppointmentStatus(appt.status) ?? "pending";
}

export function isActiveStatus(status: AppointmentStatus): boolean {
  return status === "pending" || status === "confirmed";
}

/** Upcoming = still active AND starts in the future (not "today or later"). */
export function classifyAppointment(appt: AppointmentLike, now: Date = new Date()): AppointmentTab {
  const status = statusOf(appt);
  if (status === "cancelled") return "cancelled";
  if (isActiveStatus(status) && new Date(appt.start_time).getTime() > now.getTime()) return "upcoming";
  return "past";
}

export type CancelBlockReason = "status" | "started" | "inside_window";

export interface CancellationState {
  canCancel: boolean;
  /** Last moment a free cancellation is allowed (null when there is no window). */
  deadline: Date | null;
  policyHours: number;
  reason: CancelBlockReason | null;
}

export function cancellationState(appt: AppointmentLike, now: Date = new Date()): CancellationState {
  const policyHours = Math.max(0, Number(appt.cancellation_policy_hours ?? 0) || 0);
  const start = new Date(appt.start_time).getTime();
  const deadline = policyHours > 0 && Number.isFinite(start) ? new Date(start - policyHours * HOUR_MS) : null;
  const status = statusOf(appt);
  if (!isActiveStatus(status)) return { canCancel: false, deadline, policyHours, reason: "status" };
  if (!Number.isFinite(start) || start <= now.getTime()) return { canCancel: false, deadline, policyHours, reason: "started" };
  if (deadline && now.getTime() > deadline.getTime()) return { canCancel: false, deadline, policyHours, reason: "inside_window" };
  return { canCancel: true, deadline, policyHours, reason: null };
}

/** Error code from a Supabase RPC error ({ code: 'P0001', message: '<CODE>' }). */
export function rpcErrorCode(error: { message?: string | null; code?: string | null } | null | undefined): string | null {
  if (!error) return null;
  const message = (error.message ?? "").trim();
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(message)) return message;
  return null;
}

/** Localized message for an error code, falling back to the generic message. */
export function errorMessageFor(
  error: { title?: string; message: string; codes?: Record<string, string> } | Record<string, unknown>,
  code: string | null | undefined,
): string {
  const e = error as { message?: string; codes?: Record<string, string> };
  return (code && e.codes?.[code]) || e.message || "";
}

export interface NudgeAppointment {
  status: string;
  start_time: string;
  barber_id: string | null;
  barber_name: string | null;
  shop_id: string;
}

/**
 * For 2+ completed visits with the same barber, flags when the customer is
 * past their usual cadence. Null when there is not enough history.
 */
export function rebookingNudge(
  appointments: readonly NudgeAppointment[],
  now: Date = new Date(),
): { shopId: string; barberName: string | null } | null {
  const byBarber = new Map<string, NudgeAppointment[]>();
  for (const a of appointments) {
    if (statusOf(a) === "completed" && a.barber_id) {
      const list = byBarber.get(a.barber_id) ?? [];
      list.push(a);
      byBarber.set(a.barber_id, list);
    }
  }
  for (const visits of byBarber.values()) {
    if (visits.length < 2) continue;
    const sorted = [...visits].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    let total = 0;
    for (let i = 1; i < sorted.length; i++) {
      total += new Date(sorted[i].start_time).getTime() - new Date(sorted[i - 1].start_time).getTime();
    }
    const avgGap = total / (sorted.length - 1);
    const last = sorted[sorted.length - 1];
    if (avgGap > 0 && now.getTime() - new Date(last.start_time).getTime() > avgGap) {
      return { shopId: last.shop_id, barberName: last.barber_name };
    }
  }
  return null;
}

/** 7–15 digits, optional leading +; empty is allowed (phone is optional). */
export function isValidOptionalPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
