"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Scissors } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { getServices } from "@/lib/queries/services";
import { upsertClient } from "@/lib/queries/clients";
import { getAvailableSlots, overlapsAny } from "@/lib/queries/appointments";
import type { BookingSource } from "@/lib/types";
import {
  AppointmentActionError,
  type CalendarAppointment,
} from "@/hooks/use-appointments";
import type { StaffAppointmentInput, StaffAppointmentPatch } from "@/lib/queries/appointments";
import { combineDayAndTime } from "./calendar-utils";
import { errorText } from "./error-text";

interface ServiceOption {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
}

export interface AppointmentFormDefaults {
  day: string; // yyyy-MM-dd
  time?: string; // HH:mm
  barberId?: string | null;
  /** Prefill for "new booking for this client" (clients drawer deep link). */
  clientName?: string;
  clientPhone?: string;
}

interface AppointmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Present → edit / reschedule; absent → create. */
  appointment?: CalendarAppointment | null;
  defaults: AppointmentFormDefaults;
  barbers: { id: string; name: string }[];
  currency: string;
  onCreate: (input: Omit<StaffAppointmentInput, "shopId">) => Promise<void>;
  onUpdate: (id: string, patch: StaffAppointmentPatch) => Promise<void>;
  /** Called after a successful save (toast + close handled by the parent). */
  onSaved: (mode: "create" | "edit") => void;
}

const SOURCES: BookingSource[] = ["walk_in", "whatsapp", "instagram", "other"];
const UNASSIGNED = "__unassigned__";

/**
 * Staff create / edit / reschedule form. Rendered only while open, so every
 * open starts from fresh state (no stale form between appointments).
 */
export function AppointmentFormDialog(props: AppointmentFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!props.appointment;
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      size="lg"
      title={isEdit ? t.calendar.editAppointment : t.calendar.newBooking}
      description={isEdit ? t.calendar.editDescription : t.calendar.createDescription}
      closeOnBackdrop={false}
    >
      {props.open && <AppointmentForm {...props} />}
    </Dialog>
  );
}

function AppointmentForm({
  onClose,
  appointment,
  defaults,
  barbers,
  currency,
  onCreate,
  onUpdate,
  onSaved,
}: AppointmentFormDialogProps) {
  const { t, locale, formatCurrency, formatDuration, formatTime } = useTranslation();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const role = useWorkspaceStore((s) => s.role);
  const selfId = useWorkspaceStore((s) => s.userId);
  const [supabase] = useState(() => createClient());
  const formId = useId();
  const ids = {
    name: `${formId}-name`,
    phone: `${formId}-phone`,
    barber: `${formId}-barber`,
    day: `${formId}-day`,
    time: `${formId}-time`,
    notes: `${formId}-notes`,
    source: `${formId}-source`,
    services: `${formId}-services`,
    error: `${formId}-error`,
  };
  const nameRef = useRef<HTMLInputElement>(null);
  const isEdit = !!appointment;

  const initialStart = appointment ? new Date(appointment.startTime) : null;
  const [clientName, setClientName] = useState(appointment?.clientName ?? defaults.clientName ?? "");
  const [phone, setPhone] = useState(appointment ? "" : defaults.clientPhone ?? "");
  const [barberId, setBarberId] = useState<string>(() => {
    const initial = (appointment ? appointment.barberId : defaults.barberId) ?? UNASSIGNED;
    // A barber creating from another lane books themselves (RLS forbids booking colleagues).
    if (!appointment && role === "barber" && initial !== UNASSIGNED && initial !== selfId) {
      return selfId ?? UNASSIGNED;
    }
    return initial;
  });
  const [day, setDay] = useState(initialStart ? format(initialStart, "yyyy-MM-dd") : defaults.day);
  const [time, setTime] = useState(
    initialStart ? format(initialStart, "HH:mm") : defaults.time ?? roundedNow(),
  );
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [source, setSource] = useState<BookingSource>("walk_in");
  const [selected, setSelected] = useState<string[]>(appointment?.serviceIds ?? []);
  const [servicesTouched, setServicesTouched] = useState(false);

  const [services, setServices] = useState<ServiceOption[] | null>(null);
  const [servicesError, setServicesError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load the shop's active services once per open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await getServices(supabase, shopId);
        if (cancelled) return;
        if (error) {
          setServicesError(true);
          setServices([]);
          return;
        }
        const rows = ((data ?? []) as Record<string, unknown>[])
          .filter((r) => r.is_active !== false)
          .map((r) => ({
            id: String(r.id),
            name: String(r.name ?? ""),
            name_ar: (r.name_ar as string | null) ?? null,
            duration: Number(r.duration) || 0,
            price: Number(r.price) || 0,
          }));
        setServices(rows);
      } catch {
        if (!cancelled) {
          setServicesError(true);
          setServices([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, shopId]);

  // Barbers may only book themselves or leave it unassigned (RLS).
  const barberOptions = useMemo(() => {
    if (role === "barber" && selfId) return barbers.filter((b) => b.id === selfId);
    return barbers;
  }, [barbers, role, selfId]);

  const serviceLabel = (s: ServiceOption) => (locale === "ar" && s.name_ar ? s.name_ar : s.name);

  const chosen = (services ?? []).filter((s) => selected.includes(s.id));
  // Editing a legacy appointment without service ids keeps its own price/duration.
  const keepOriginal = isEdit && !servicesTouched;
  const duration = keepOriginal
    ? appointment!.durationMinutes || chosen.reduce((sum, s) => sum + s.duration, 0)
    : chosen.reduce((sum, s) => sum + s.duration, 0);
  const total = keepOriginal ? appointment!.price : chosen.reduce((sum, s) => sum + s.price, 0);

  const start = day && time ? combineDayAndTime(day, time) : null;
  const end = start ? new Date(start.getTime() + duration * 60000) : null;

  const nameMissing = clientName.trim().length === 0;
  const servicesMissing = !keepOriginal && chosen.length === 0;

  const toggleService = (id: string) => {
    setServicesTouched(true);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (nameMissing) {
      nameRef.current?.focus();
      return;
    }
    if (servicesMissing || !start || !end || duration <= 0) return;

    const resolvedBarber = barberId === UNASSIGNED ? null : barberId;
    setSubmitting(true);
    try {
      // UX pre-check against the barber's other bookings (the DB still enforces it).
      if (resolvedBarber) {
        const { data: busy } = await getAvailableSlots(supabase, shopId, day, resolvedBarber);
        const others = (busy ?? []).filter(
          (b) =>
            !(
              appointment &&
              b.barber_id === appointment.barberId &&
              new Date(b.start_time).getTime() === new Date(appointment.startTime).getTime() &&
              new Date(b.end_time).getTime() === new Date(appointment.endTime).getTime()
            ),
        );
        if (overlapsAny(start, end, others)) {
          const barberName = barbers.find((b) => b.id === resolvedBarber)?.name ?? "";
          setFormError(interpolate(t.calendar.overlapWarning, { barber: barberName }));
          return;
        }
      }

      const serviceName = chosen.map(serviceLabel).join(" + ");
      if (isEdit && appointment) {
        await onUpdate(appointment.id, {
          clientName: clientName.trim(),
          barberId: resolvedBarber,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: notes.trim() || null,
          ...(servicesTouched
            ? { serviceIds: chosen.map((s) => s.id), serviceName, price: total }
            : {}),
        });
        onSaved("edit");
      } else {
        // Link (or create) the client record when a phone is given. Non-fatal.
        let clientId: string | null = null;
        if (phone.trim()) {
          try {
            const { data } = await upsertClient(supabase, shopId, { name: clientName.trim(), phone: phone.trim() });
            clientId = (data as { id?: string } | null)?.id ?? null;
          } catch {
            clientId = null;
          }
        }
        await onCreate({
          barberId: resolvedBarber,
          clientId,
          clientName: clientName.trim(),
          serviceIds: chosen.map((s) => s.id),
          serviceName,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          price: total,
          notes: notes.trim() || null,
          source,
          status: "confirmed",
        });
        onSaved("create");
      }
    } catch (err) {
      const code = err instanceof AppointmentActionError ? err.code : null;
      setFormError(errorText(t, code));
    } finally {
      setSubmitting(false);
    }
  }

  const sourceLabels: Record<BookingSource, string> = {
    walk_in: t.booking.walkIn,
    whatsapp: t.calendar.sourceWhatsapp,
    instagram: t.booking.instagram,
    other: t.booking.other,
    online: t.booking.other,
    google: t.booking.google,
    word_of_mouth: t.booking.wordOfMouth,
  };

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Client */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.name} className="field-label">
            {t.calendar.clientName}
          </label>
          <input
            ref={nameRef}
            id={ids.name}
            data-autofocus
            className="field-input"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            autoComplete="off"
            maxLength={120}
            required
            aria-invalid={submitted && nameMissing}
            aria-describedby={submitted && nameMissing ? `${ids.name}-err` : undefined}
          />
          {submitted && nameMissing && (
            <p id={`${ids.name}-err`} className="field-error">
              {t.calendar.nameRequired}
            </p>
          )}
        </div>
        {!isEdit && (
          <div>
            <label htmlFor={ids.phone} className="field-label">
              {t.calendar.clientPhone}
            </label>
            <input
              id={ids.phone}
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="field-input text-start"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              maxLength={20}
            />
          </div>
        )}
      </div>

      {/* Services */}
      <fieldset aria-describedby={submitted && servicesMissing ? `${ids.services}-err` : undefined}>
        <legend className="field-label">{t.booking.services}</legend>
        {services === null ? (
          <div className="grid gap-2 sm:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-sm)]" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-subtle)] p-4 text-[13px] text-[var(--text-secondary)]">
            {servicesError ? t.error.message : t.calendar.noServices}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => {
              const checked = selected.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 transition-colors focus-ring-within",
                    checked
                      ? "border-[var(--text-primary)] bg-[var(--bg-secondary)]"
                      : "border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]",
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[var(--text-primary)]"
                    checked={checked}
                    onChange={() => toggleService(s.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-[var(--text-primary)]">{serviceLabel(s)}</span>
                    <span className="block text-[12px] text-[var(--text-muted)]">
                      {formatDuration(s.duration)} · {formatCurrency(s.price, currency)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {submitted && servicesMissing && (
          <p id={`${ids.services}-err`} className="field-error">
            {t.calendar.selectService}
          </p>
        )}
      </fieldset>

      {/* Barber + time */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={ids.barber} className="field-label">
            {t.calendar.barber}
          </label>
          <select
            id={ids.barber}
            className="field-input"
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
          >
            <option value={UNASSIGNED}>{t.calendar.unassigned}</option>
            {barberOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.day} className="field-label">
            {t.calendar.date}
          </label>
          <input
            id={ids.day}
            type="date"
            className="field-input"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor={ids.time} className="field-label">
            {t.calendar.startTime}
          </label>
          <input
            id={ids.time}
            type="time"
            step={300}
            className="field-input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
      </div>

      {!isEdit && (
        <div>
          <label htmlFor={ids.source} className="field-label">
            {t.calendar.source}
          </label>
          <select
            id={ids.source}
            className="field-input"
            value={source}
            onChange={(e) => setSource(e.target.value as BookingSource)}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceLabels[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor={ids.notes} className="field-label">
          {t.calendar.notes}
        </label>
        <textarea
          id={ids.notes}
          className="field-input min-h-[88px] resize-y py-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Summary */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] px-4 py-3 text-[13px]"
        aria-live="polite"
      >
        <span className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Scissors size={14} aria-hidden="true" />
          {duration > 0 ? formatDuration(duration) : "—"}
          {start && end && duration > 0 && (
            <span className="tabular-nums">
              · {formatTime(start)} – {formatTime(end)}
            </span>
          )}
        </span>
        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
          {t.booking.total}: {formatCurrency(total, currency)}
        </span>
      </div>

      {formError && (
        <p id={ids.error} role="alert" className="rounded-[var(--radius-sm)] border border-[var(--accent-rose)]/40 bg-[var(--accent-rose-muted)] px-4 py-3 text-[13px] text-[var(--accent-rose)]">
          {formError}
        </p>
      )}

      <DialogFooter className="pt-2">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
          {t.common.cancel}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || services === null}
          aria-busy={submitting}
        >
          {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {submitting ? t.common.processing : isEdit ? t.common.save : t.calendar.saveBooking}
        </button>
      </DialogFooter>
    </form>
  );
}

/** Next quarter hour, "HH:mm". */
function roundedNow(): string {
  const d = new Date();
  const m = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(m, 0, 0);
  return format(d, "HH:mm");
}
