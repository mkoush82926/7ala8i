"use client";

import { useCallback, useRef, useState } from "react";
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import type { TranslationKeys } from "@/i18n/en";

/** Methods the dashboard POS offers. The DB also accepts "online" and "mixed". */
export type PaymentMethod = "cash" | "card";

export interface CheckoutOptions {
  appointmentId: string;
  method: PaymentMethod;
  /** Defaults to the appointment price on the server. */
  amount?: number | null;
  // Legacy fields kept so existing call sites still type-check; the server
  // now derives client, service and barber from the appointment row.
  clientName?: string;
  barberName?: string;
  serviceLabel?: string;
  scheduledTime?: string;
}

export type PosResult = { ok: true } | { ok: false; code: string };

/** Localised text for a DB/API error code: t.error.codes[code] ?? t.error.message. */
export function errorMessageFor(t: TranslationKeys, code?: string | null): string {
  const codes = (t.error as { codes?: Record<string, string | undefined> }).codes;
  return (code && codes?.[code]) || t.error.message;
}

/** The P0001 RPC errors carry the code in `message`; PostgREST errors in `code`. */
function codeOf(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "INTERNAL";
  if (error.message && /^[A-Z][A-Z_]+$/.test(error.message)) return error.message;
  if (error.code === "23P01") return "SLOT_TAKEN";
  if (error.code === "42501") return "NOT_AUTHORIZED";
  return "INTERNAL";
}

/**
 * Tiny invalidation counter: every successful POS mutation bumps it, and the
 * overview widgets (metric cards, daily receipt, sales chart, upcoming list)
 * include it in their query deps so they refresh together.
 */
interface DashboardVersionState {
  version: number;
  bump: () => void;
}

export const useDashboardVersionStore = create<DashboardVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function useDashboardVersion(): number {
  return useDashboardVersionStore((s) => s.version);
}

export function invalidateDashboard() {
  useDashboardVersionStore.getState().bump();
}

interface UsePosOptions {
  /** Toast the localised error automatically (default true). */
  toastErrors?: boolean;
}

/**
 * Appointment checkout actions. Every method resolves to `{ ok }` instead of
 * throwing; on failure it has already shown an error toast (unless
 * `toastErrors: false`), so callers only toast success when `ok` is true.
 */
export function usePos({ toastErrors = true }: UsePosOptions = {}) {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const { t } = useTranslation();
  const [supabase] = useState(() => createClient());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  // Guards against double submits (double-click, two tabs of the same row).
  const inFlight = useRef(new Set<string>());

  const run = useCallback(
    async (appointmentId: string, action: () => Promise<PosResult>): Promise<PosResult> => {
      if (!shopId) {
        const res: PosResult = { ok: false, code: "NO_SHOP" };
        if (toastErrors) toast.error(errorMessageFor(t, res.code));
        return res;
      }
      if (inFlight.current.has(appointmentId)) return { ok: false, code: "IN_FLIGHT" };
      inFlight.current.add(appointmentId);
      setLoadingId(appointmentId);
      try {
        const res = await action();
        if (res.ok) invalidateDashboard();
        else if (toastErrors) toast.error(errorMessageFor(t, res.code));
        return res;
      } catch {
        const res: PosResult = { ok: false, code: "INTERNAL" };
        if (toastErrors) toast.error(errorMessageFor(t, res.code));
        return res;
      } finally {
        inFlight.current.delete(appointmentId);
        setLoadingId((cur) => (cur === appointmentId ? null : cur));
      }
    },
    [shopId, t, toastErrors],
  );

  /** Completes the appointment and records the sale atomically (idempotent). */
  const markPaid = useCallback(
    (opts: CheckoutOptions) =>
      run(opts.appointmentId, async () => {
        const { error } = await supabase.rpc("complete_appointment_sale", {
          p_appointment_id: opts.appointmentId,
          p_payment_method: opts.method,
          p_amount: opts.amount ?? null,
        });
        return error ? { ok: false, code: codeOf(error) } : { ok: true };
      }),
    [run, supabase],
  );

  /** Status-only update; DB triggers set no_show/cancelled_at/updated_at. */
  const updateStatus = useCallback(
    (appointmentId: string, patch: Record<string, unknown>) =>
      run(appointmentId, async () => {
        const { data, error } = await supabase
          .from("appointments")
          .update(patch)
          .eq("id", appointmentId)
          .eq("shop_id", shopId)
          .select("id");
        if (error) return { ok: false, code: codeOf(error) };
        // RLS filters rows silently: zero updated rows means "not yours".
        if (Array.isArray(data) && data.length === 0) return { ok: false, code: "NOT_AUTHORIZED" };
        return { ok: true };
      }),
    [run, shopId, supabase],
  );

  const markNoShow = useCallback(
    (appointmentId: string) => updateStatus(appointmentId, { status: "no_show" }),
    [updateStatus],
  );

  const cancelAppointment = useCallback(
    (appointmentId: string, reason?: string | null) =>
      updateStatus(appointmentId, {
        status: "cancelled",
        ...(reason ? { cancellation_reason: reason } : {}),
      }),
    [updateStatus],
  );

  return { markPaid, markNoShow, cancelAppointment, loadingId };
}
