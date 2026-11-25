"use client";

import React, { useState } from "react";
import { Armchair, Banknote, CalendarClock, Check, CreditCard, DoorOpen, Loader2, Move, Undo2, UserX, XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { APPOINTMENT_STATUS_TRANSITIONS, type PaymentMethod } from "@/lib/types";
import type { CalendarAppointment } from "@/hooks/use-appointments";
import { StatusPill } from "./status-pill";
import { canMarkNoShow, isMovable } from "./calendar-model";

interface AppointmentDetailsDialogProps {
  appointment: CalendarAppointment | null;
  barberName: string;
  onClose: () => void;
  onConfirmStatus: (a: CalendarAppointment) => Promise<void>;
  onPay: (a: CalendarAppointment, method: PaymentMethod) => Promise<void>;
  onEdit: (a: CalendarAppointment) => void;
  onNoShow: (a: CalendarAppointment) => void;
  onCancel: (a: CalendarAppointment) => void;
  /** Front desk (WS-1E): checked in / in the chair. */
  onStatus?: (a: CalendarAppointment, status: "arrived" | "in_chair") => Promise<void>;
  /** Reverts a no-show (undo_no_show). */
  onUndoNoShow?: (a: CalendarAppointment) => Promise<void>;
  /** Starts the arrow-key move mode on the calendar. */
  onMoveMode?: (a: CalendarAppointment) => void;
  /** Whether the signed-in member may change this appointment. */
  canEdit?: boolean;
  now?: Date;
}

/** Click/keyboard-accessible replacement for the old hover-only tooltip. */
export function AppointmentDetailsDialog({
  appointment,
  barberName,
  onClose,
  onConfirmStatus,
  onPay,
  onEdit,
  onNoShow,
  onCancel,
  onStatus,
  onUndoNoShow,
  onMoveMode,
  canEdit = true,
  now = new Date(),
}: AppointmentDetailsDialogProps) {
  const { t, locale, formatTime, formatDate, formatDuration, formatCurrency } = useTranslation();
  const [busy, setBusy] = useState<null | "confirm" | "arrived" | "in_chair" | "undo" | PaymentMethod>(null);

  const a = appointment;
  const allowed = a ? APPOINTMENT_STATUS_TRANSITIONS[a.status] : [];
  const active = a ? ["pending", "confirmed", "arrived", "in_chair", "awaiting_deposit"].includes(a.status) && canEdit : false;
  const noShowAllowed = a ? canMarkNoShow(a, now) : false;
  const services = a?.services?.length
    ? a.services.map((l) => (locale === "ar" && l.nameAr ? l.nameAr : l.name)).join(" + ")
    : a?.serviceName;

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={!!a}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={a ? a.clientName || t.calendar.walkIn : t.calendar.appointmentDetails}
      description={
        a
          ? `${formatDate(a.startTime, "weekdayDay")} · ${formatTime(a.startTime)} – ${formatTime(a.endTime)}`
          : undefined
      }
      size="md"
    >
      {a && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-line bg-sunken/50 p-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-ink-muted">{t.calendar.status}</dt>
              <dd className="mt-1">
                <StatusPill status={a.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">{t.calendar.barber}</dt>
              <dd className="mt-1 font-medium text-ink">{barberName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">{t.calendar.service}</dt>
              <dd className="mt-1 font-medium text-ink">{services || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">{t.calendar.duration}</dt>
              <dd className="mt-1 font-medium text-ink">{formatDuration(a.durationMinutes)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">{t.calendar.price}</dt>
              <dd className="mt-1 font-semibold tabular-nums text-ink">
                {formatCurrency(a.price, a.currency)}
              </dd>
            </div>
            {(a.arrivedAt || a.startedAt) && (
              <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-soft">
                {a.arrivedAt && <span>{interpolate(t.calendar.arrivedAt, { time: formatTime(a.arrivedAt) })}</span>}
                {a.startedAt && <span>{interpolate(t.calendar.startedAt, { time: formatTime(a.startedAt) })}</span>}
              </div>
            )}
            {a.notes && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-ink-muted">{t.calendar.notes}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink-soft">{a.notes}</dd>
              </div>
            )}
          </dl>

          {a.status === "no_show" && canEdit && onUndoNoShow && (
            <div className="border-t border-line pt-4">
              <button
                type="button"
                className="btn btn-secondary w-full"
                disabled={!!busy}
                aria-busy={busy === "undo"}
                onClick={() => run("undo", () => onUndoNoShow(a))}
              >
                {busy === "undo" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Undo2 size={16} aria-hidden="true" />}
                {t.calendar.undoNoShow}
              </button>
            </div>
          )}

          {active && (
            <div className="space-y-3 border-t border-line pt-4">
              {/* Front desk: check in, then seat */}
              {onStatus && (allowed.includes("arrived") || allowed.includes("in_chair")) && (
                <div className="grid grid-cols-2 gap-2">
                  {allowed.includes("arrived") && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!!busy}
                      aria-busy={busy === "arrived"}
                      onClick={() => run("arrived", () => onStatus(a, "arrived"))}
                    >
                      {busy === "arrived" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <DoorOpen size={16} aria-hidden="true" />}
                      {t.calendar.checkIn}
                    </button>
                  )}
                  {allowed.includes("in_chair") && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!!busy}
                      aria-busy={busy === "in_chair"}
                      onClick={() => run("in_chair", () => onStatus(a, "in_chair"))}
                    >
                      {busy === "in_chair" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Armchair size={16} aria-hidden="true" />}
                      {t.calendar.startService}
                    </button>
                  )}
                </div>
              )}

              {/* Primary: take payment */}
              {allowed.includes("completed") && (
                <div>
                  <p className="field-label">{t.calendar.markPaid}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["cash", "card"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        className="btn btn-primary"
                        disabled={!!busy}
                        aria-busy={busy === method}
                        onClick={() => run(method, () => onPay(a, method))}
                      >
                        {busy === method ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : method === "cash" ? (
                          <Banknote size={16} aria-hidden="true" />
                        ) : (
                          <CreditCard size={16} aria-hidden="true" />
                        )}
                        {method === "cash" ? t.dashboard.cash : t.dashboard.card}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {allowed.includes("confirmed") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!!busy}
                    aria-busy={busy === "confirm"}
                    onClick={() => run("confirm", () => onConfirmStatus(a))}
                  >
                    {busy === "confirm" ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Check size={16} aria-hidden="true" />
                    )}
                    {t.common.confirm}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => onEdit(a)}>
                  <CalendarClock size={16} aria-hidden="true" />
                  {t.calendar.reschedule}
                </button>
                {onMoveMode && isMovable(a.status) && (
                  <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => onMoveMode(a)}>
                    <Move size={16} aria-hidden="true" />
                    {t.calendar.moveWithKeys}
                  </button>
                )}
                {allowed.includes("no_show") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!!busy || !noShowAllowed}
                    aria-describedby={!noShowAllowed ? "no-show-too-early" : undefined}
                    onClick={() => onNoShow(a)}
                  >
                    <UserX size={16} aria-hidden="true" />
                    {t.calendar.markNoShow}
                  </button>
                )}
                {allowed.includes("cancelled") && (
                  <button
                    type="button"
                    className="btn btn-ghost text-danger-text"
                    disabled={!!busy}
                    onClick={() => onCancel(a)}
                  >
                    <XCircle size={16} aria-hidden="true" />
                    {t.calendar.cancelAppointment}
                  </button>
                )}
              </div>
              {allowed.includes("no_show") && !noShowAllowed && (
                <p id="no-show-too-early" className="text-[12px] text-ink-muted">
                  {t.calendar.noShowTooEarly}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
