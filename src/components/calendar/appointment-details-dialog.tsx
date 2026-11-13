"use client";

import React, { useState } from "react";
import { Banknote, CalendarClock, Check, CreditCard, Loader2, UserX, XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { APPOINTMENT_STATUS_TRANSITIONS, type PaymentMethod } from "@/lib/types";
import type { CalendarAppointment } from "@/hooks/use-appointments";
import { STATUS_STYLES } from "./calendar-utils";
import { useStatusLabel } from "./status-label";

interface AppointmentDetailsDialogProps {
  appointment: CalendarAppointment | null;
  barberName: string;
  onClose: () => void;
  onConfirmStatus: (a: CalendarAppointment) => Promise<void>;
  onPay: (a: CalendarAppointment, method: PaymentMethod) => Promise<void>;
  onEdit: (a: CalendarAppointment) => void;
  onNoShow: (a: CalendarAppointment) => void;
  onCancel: (a: CalendarAppointment) => void;
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
}: AppointmentDetailsDialogProps) {
  const { t, formatTime, formatDate, formatDuration, formatCurrency } = useTranslation();
  const statusLabel = useStatusLabel();
  const [busy, setBusy] = useState<null | "confirm" | PaymentMethod>(null);

  const a = appointment;
  const allowed = a ? APPOINTMENT_STATUS_TRANSITIONS[a.status] : [];
  const active = a ? a.status === "pending" || a.status === "confirmed" : false;

  const run = async (kind: "confirm" | PaymentMethod, fn: () => Promise<void>) => {
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
      title={a?.clientName || t.calendar.appointmentDetails}
      description={
        a
          ? `${formatDate(a.startTime, "weekdayDay")} · ${formatTime(a.startTime)} – ${formatTime(a.endTime)}`
          : undefined
      }
      size="md"
    >
      {a && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">{t.calendar.status}</dt>
              <dd className="mt-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium",
                    STATUS_STYLES[a.status].bg,
                    STATUS_STYLES[a.status].border,
                    STATUS_STYLES[a.status].text,
                    "no-underline",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLES[a.status].dot)} aria-hidden="true" />
                  {statusLabel(a.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">{t.calendar.barber}</dt>
              <dd className="mt-1 text-[var(--text-primary)]">{barberName}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">{t.calendar.service}</dt>
              <dd className="mt-1 text-[var(--text-primary)]">{a.serviceName || "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">{t.calendar.duration}</dt>
              <dd className="mt-1 text-[var(--text-primary)]">{formatDuration(a.durationMinutes)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">{t.calendar.price}</dt>
              <dd className="mt-1 font-semibold tabular-nums text-[var(--text-primary)]">
                {formatCurrency(a.price, a.currency)}
              </dd>
            </div>
            {a.notes && (
              <div className="col-span-2">
                <dt className="text-[12px] text-[var(--text-muted)]">{t.calendar.notes}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{a.notes}</dd>
              </div>
            )}
          </dl>

          {active && (
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
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
                {allowed.includes("no_show") && (
                  <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => onNoShow(a)}>
                    <UserX size={16} aria-hidden="true" />
                    {t.calendar.markNoShow}
                  </button>
                )}
                {allowed.includes("cancelled") && (
                  <button
                    type="button"
                    className="btn btn-ghost text-[var(--accent-rose)]"
                    disabled={!!busy}
                    onClick={() => onCancel(a)}
                  >
                    <XCircle size={16} aria-hidden="true" />
                    {t.calendar.cancelAppointment}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
