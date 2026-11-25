"use client";

import React, { useEffect, useId, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, MessageCircle } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isSlotBookable } from "@/lib/availability";
import { getClientById } from "@/lib/queries/clients";
import type { BlockedTimeRow } from "@/lib/queries/appointments";
import type { CalendarAppointment } from "@/hooks/use-appointments";
import { overlapping, type MoveTarget } from "./calendar-model";

export interface MoveRequest {
  appointment: CalendarAppointment;
  target: MoveTarget;
  kind: "move" | "resize";
}

interface MoveConfirmDialogProps {
  request: MoveRequest | null;
  appointments: CalendarAppointment[];
  blocks: BlockedTimeRow[];
  barberName: (id: string | null) => string;
  blockLabel: (b: BlockedTimeRow) => string;
  onClose: () => void;
  /** Saves the move; `notifyPhone` is set when the client should get a WhatsApp. Throws to keep the dialog open. */
  onConfirm: (req: MoveRequest, notifyPhone: string | null) => Promise<void>;
}

/**
 * Confirms a drag/resize/keyboard move. Lists conflicts (other bookings and
 * blocked time from local data, plus the P0V is_slot_bookable verdict) and
 * offers "Notify client on WhatsApp" when the time changed. Staff may still
 * move into a warned slot; the DB exclusion constraint rejects true overlaps.
 */
export function MoveConfirmDialog({ request, appointments, blocks, barberName, blockLabel, onClose, onConfirm }: MoveConfirmDialogProps) {
  const { t, formatDate, formatTime } = useTranslation();
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const notifyId = useId();
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forKey, setForKey] = useState<string | null>(null);

  const key = request ? `${request.appointment.id}|${request.target.startIso}|${request.target.endIso}|${request.target.barberId}` : null;
  if (key !== forKey) {
    setForKey(key);
    setServerOk(null);
    setError(null);
    setNotify(true);
    setPhone(null);
  }

  const a = request?.appointment;
  const target = request?.target;
  const timeChanged = !!(a && target && (a.startTime !== target.startIso || a.endTime !== target.endIso));

  // Server-side bookability (only meaningful for a move with known services).
  useEffect(() => {
    if (!request || request.kind !== "move" || !request.target.barberId || request.appointment.serviceIds.length === 0) return;
    let cancelled = false;
    setChecking(true);
    isSlotBookable(supabase as never, {
      shopId,
      start: request.target.startIso,
      items: request.appointment.serviceIds,
      barberId: request.target.barberId,
      ignoreAppointmentId: request.appointment.id,
    })
      .then((ok) => !cancelled && setServerOk(ok))
      .catch(() => !cancelled && setServerOk(null))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [request, supabase, shopId]);

  // Client phone for the WhatsApp notice.
  useEffect(() => {
    const clientId = request?.appointment.clientId;
    if (!clientId) return;
    let cancelled = false;
    getClientById(supabase, clientId)
      .then(({ data }: { data: { phone?: string | null } | null }) => !cancelled && setPhone(data?.phone ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [request, supabase]);

  const clashes = request
    ? [
        ...overlapping(
          { startIso: request.target.startIso, endIso: request.target.endIso, barberId: request.target.barberId, ignoreId: request.appointment.id },
          appointments.filter((x) => x.status !== "cancelled" && x.status !== "no_show" && x.status !== "completed"),
        ).map((x) => interpolate(t.calendar.conflictBooking, { name: x.clientName || t.calendar.walkIn, time: formatTime(x.startTime) })),
        ...overlapping(
          {
            startIso: request.target.startIso,
            endIso: request.target.endIso,
            barberId: request.target.barberId,
          },
          blocks.map((b) => ({ id: b.id, startTime: b.start_time, endTime: b.end_time, barberId: b.barber_id, b })),
          { nullIsShopWide: true },
        ).map((x) => interpolate(t.calendar.conflictBlock, { title: blockLabel(x.b), time: formatTime(x.startTime) })),
        ...(serverOk === false ? [t.calendar.conflictUnavailable] : []),
      ]
    : [];

  const submit = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(request, timeChanged && notify && phone ? phone : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!request}
      onClose={() => !busy && onClose()}
      size="sm"
      title={request?.kind === "resize" ? t.calendar.resizeTitle : t.calendar.moveTitle}
      description={a ? a.clientName || t.calendar.walkIn : undefined}
      footer={
        <DialogFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy} aria-busy={busy} data-autofocus>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {clashes.length ? t.calendar.moveAnyway : t.calendar.confirmMove}
          </button>
        </DialogFooter>
      }
    >
      {a && target && (
        <div className="space-y-4 text-[14px]">
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] p-3">
            <span className="text-[var(--text-secondary)]">
              {formatDate(a.startTime, "weekdayDay")} {formatTime(a.startTime)}–{formatTime(a.endTime)}
              <span className="block text-[12px]">{barberName(a.barberId)}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)] rtl:-scale-x-100" aria-hidden="true" />
            <span className="font-medium text-[var(--text-primary)]">
              {formatDate(target.startIso, "weekdayDay")} {formatTime(target.startIso)}–{formatTime(target.endIso)}
              <span className="block text-[12px] font-normal">{barberName(target.barberId)}</span>
            </span>
          </div>

          {checking && (
            <p className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t.calendar.checkingSlot}
            </p>
          )}

          {clashes.length > 0 && (
            <div role="alert" className="rounded-[var(--radius-sm)] border border-[var(--accent-rose)]/40 bg-[var(--accent-rose-muted)] p-3">
              <p className="flex items-center gap-2 font-medium text-[var(--accent-rose)]">
                <AlertTriangle size={16} aria-hidden="true" />
                {t.calendar.conflictsTitle}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 ps-6 text-[13px] text-[var(--text-secondary)]">
                {clashes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {timeChanged && (
            <label htmlFor={notifyId} className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                id={notifyId}
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent-brass)]"
                checked={notify && !!phone}
                disabled={!phone}
                onChange={(e) => setNotify(e.target.checked)}
              />
              <MessageCircle size={16} aria-hidden="true" className="text-[var(--text-muted)]" />
              <span>
                {t.calendar.notifyWhatsapp}
                {!phone && <span className="block text-[12px] text-[var(--text-muted)]">{t.calendar.notifyNoPhone}</span>}
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
