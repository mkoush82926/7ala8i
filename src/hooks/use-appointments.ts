"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { useWorkspaceStore } from "@/store/workspace-store";
// Overview widgets (metrics, receipt, chart) refetch when this version bumps.
import { invalidateDashboard } from "@/hooks/use-pos";
import {
  getAppointmentsByDateRange,
  completeAppointmentSale,
  createStaffAppointment,
  updateStaffAppointment,
  errorCodeOf,
  type StaffAppointmentInput,
  type StaffAppointmentPatch,
} from "@/lib/queries/appointments";
import {
  normalizeAppointmentStatus,
  type AppointmentStatus,
  type PaymentMethod,
} from "@/lib/types";

export interface CalendarAppointment {
  id: string;
  shopId: string;
  clientId: string | null;
  barberId: string | null;
  clientName: string;
  serviceName: string | null;
  serviceIds: string[];
  /** ISO strings as stored. */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** Always a canonical status (legacy "no-show" is normalised). */
  status: AppointmentStatus;
  price: number;
  currency: string;
  notes: string | null;
  source: string | null;
}

/** Thrown by the mutation helpers; `code` is a key of t.error.codes (or null). */
export class AppointmentActionError extends Error {
  code: string | null;
  constructor(code: string | null, message?: string) {
    super(message ?? code ?? "APPOINTMENT_ACTION_FAILED");
    this.name = "AppointmentActionError";
    this.code = code;
  }
}

export function toCalendarAppointment(row: Record<string, unknown>): CalendarAppointment {
  const startTime = String(row.start_time ?? "");
  const endTime = String(row.end_time ?? startTime);
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMinutes = Number.isFinite(end - start) ? Math.max(0, Math.round((end - start) / 60000)) : 0;
  return {
    id: String(row.id),
    shopId: String(row.shop_id ?? ""),
    clientId: (row.client_id as string | null) ?? null,
    barberId: (row.barber_id as string | null) ?? null,
    clientName: (row.client_name as string | null) ?? "",
    serviceName: (row.service_name as string | null) ?? null,
    serviceIds: Array.isArray(row.service_ids) ? (row.service_ids as string[]) : [],
    startTime,
    endTime,
    durationMinutes,
    status: normalizeAppointmentStatus(row.status) ?? "pending",
    price: Number(row.price) || 0,
    currency: (row.currency as string | null) || "JOD",
    notes: (row.notes as string | null) ?? null,
    source: (row.source as string | null) ?? null,
  };
}

/**
 * Day view data for the staff calendar: loading/error state, stale-response
 * protection when the date changes quickly, and mutations that throw an
 * AppointmentActionError on failure (so ConfirmDialog stays open).
 */
export function useAppointments(date: Date) {
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** yyyy-MM-dd the current `appointments` list belongs to (null before the first load). */
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const [supabase] = useState(() => createClient());
  const requestRef = useRef(0);

  const dateStr = format(date, "yyyy-MM-dd");

  const fetchAppointments = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!shopId) return;
      const token = ++requestRef.current;
      if (!opts.silent) setLoading(true);
      setError(null);
      try {
        const { data, error: qError } = await getAppointmentsByDateRange(supabase, shopId, dateStr, dateStr);
        if (token !== requestRef.current) return; // superseded by a newer request
        if (qError) {
          setError(errorCodeOf(qError) ?? "LOAD_FAILED");
          if (!opts.silent) setAppointments([]);
        } else {
          setAppointments(((data ?? []) as Record<string, unknown>[]).map(toCalendarAppointment));
          setLoadedDate(dateStr);
        }
      } catch (err) {
        if (token !== requestRef.current) return;
        setError(errorCodeOf(err) ?? "LOAD_FAILED");
      } finally {
        if (token === requestRef.current) setLoading(false);
      }
    },
    [supabase, shopId, dateStr],
  );

  useEffect(() => {
    // Fetch on mount / date or shop change is the intended side effect.
    fetchAppointments();
  }, [fetchAppointments]);

  // Front-desk screens stay open all day: refresh quietly when the tab regains focus.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") fetchAppointments({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchAppointments]);

  const patchLocal = useCallback((id: string, patch: Partial<CalendarAppointment>) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  /** Status change through the API (server validates transitions + barber ownership). */
  const updateStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus, reason?: string) => {
      const before = appointments.find((a) => a.id === appointmentId);
      if (before) patchLocal(appointmentId, { status });
      // Mock preview has no server session for the API route: keep the local patch.
      if (MOCK_DATA_ENABLED) {
        invalidateDashboard();
        return;
      }
      let res: Response;
      try {
        res = await fetch("/api/booking/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointment_id: appointmentId, status, ...(reason ? { reason } : {}) }),
        });
      } catch {
        if (before) patchLocal(appointmentId, { status: before.status });
        throw new AppointmentActionError("NETWORK");
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; code?: string } | null;
      if (!res.ok || !body?.success) {
        if (before) patchLocal(appointmentId, { status: before.status });
        throw new AppointmentActionError(body?.code ?? null);
      }
      invalidateDashboard();
    },
    [appointments, patchLocal],
  );

  /** Completes the appointment and records the sale atomically (idempotent RPC). */
  const markPaid = useCallback(
    async (appointmentId: string, method: PaymentMethod, amount?: number) => {
      const { error: rpcError } = await completeAppointmentSale(supabase, appointmentId, method, amount);
      if (rpcError) throw new AppointmentActionError(errorCodeOf(rpcError));
      patchLocal(appointmentId, { status: "completed" });
      invalidateDashboard();
    },
    [supabase, patchLocal],
  );

  const createAppointment = useCallback(
    async (input: Omit<StaffAppointmentInput, "shopId">) => {
      if (!shopId) throw new AppointmentActionError("NO_SHOP");
      const { error: insError } = await createStaffAppointment(supabase, { ...input, shopId });
      if (insError) throw new AppointmentActionError(errorCodeOf(insError));
      invalidateDashboard();
      await fetchAppointments({ silent: true });
    },
    [supabase, shopId, fetchAppointments],
  );

  const updateAppointment = useCallback(
    async (appointmentId: string, patch: StaffAppointmentPatch) => {
      const { error: upError } = await updateStaffAppointment(supabase, appointmentId, patch);
      if (upError) throw new AppointmentActionError(errorCodeOf(upError));
      invalidateDashboard();
      await fetchAppointments({ silent: true });
    },
    [supabase, fetchAppointments],
  );

  const refetch = useCallback(() => fetchAppointments(), [fetchAppointments]);

  return {
    appointments,
    // Still waiting on the workspace → keep the skeleton instead of flashing "empty".
    loading: shopId ? loading : !hydrated,
    error,
    loadedDate,
    refetch,
    updateStatus,
    markPaid,
    createAppointment,
    updateAppointment,
  };
}
