"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { addDays, format, isSameDay, isValid, parse, subDays } from "date-fns";
import {
  AlertTriangle,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Plus,
  UserPlus,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn, parseDateInput } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabase } from "@/hooks/use-supabase";
import { getClientById } from "@/lib/queries/clients";
import { useTranslation, interpolate, headingTracking } from "@/hooks/use-translation";
import {
  AppointmentActionError,
  useAppointments,
  type CalendarAppointment,
} from "@/hooks/use-appointments";
import { APPOINTMENT_STATUSES, type PaymentMethod } from "@/lib/types";
import {
  STATUS_STYLES,
  blockPlacement,
  computeHourRange,
  hourTicks,
  initialsOf,
  nowPosition,
  packTracks,
} from "./calendar-utils";
import { useStatusLabel } from "./status-label";
import { errorText } from "./error-text";
import { AppointmentDetailsDialog } from "./appointment-details-dialog";
import { AppointmentFormDialog, type AppointmentFormDefaults } from "./appointment-form-dialog";

const UNASSIGNED_LANE = "__unassigned__";

type Lane = { id: string; name: string; barberId: string | null };
type PendingStatus = { appointment: CalendarAppointment; status: "no_show" | "cancelled" } | null;
type FormState = { open: false } | { open: true; appointment: CalendarAppointment | null; defaults: AppointmentFormDefaults };

export function TimelineView() {
  const { t, isRTL, FFD, href, formatDate, formatTime, formatDuration, formatCurrency } = useTranslation();
  const statusLabel = useStatusLabel();
  const barbers = useWorkspaceStore((s) => s.barbers);
  const currentView = useWorkspaceStore((s) => s.currentView);
  const role = useWorkspaceStore((s) => s.role);
  const shopCurrency = useWorkspaceStore((s) => s.currency);

  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus>(null);
  const [form, setForm] = useState<FormState>({ open: false });

  // Deep links from notifications, the topbar search and the clients drawer:
  //   /calendar?date=yyyy-MM-dd[&appt=<id>]  → that day (and appointment)
  //   /calendar?new=1&client=<id>            → new-booking form for that client
  // Applied whenever the query changes (also while already on /calendar),
  // adjusting state during render. The params are stripped once consumed, so
  // choosing the same result again changes the URL and re-applies it.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useSupabase();
  const linkKey = ["date", "appt", "new", "client"].map((k) => searchParams.get(k) ?? "").join("|");
  const hasLink = linkKey !== "|||";
  const [appliedLink, setAppliedLink] = useState<string | null>(null);
  const [pendingAppt, setPendingAppt] = useState<string | null>(null);
  const [pendingClient, setPendingClient] = useState<string | null>(null);
  if (linkKey !== appliedLink) {
    setAppliedLink(linkKey);
    const linkedDate = parseDateInput(searchParams.get("date"));
    if (linkedDate) setSelectedDate(linkedDate);
    const linkedAppt = searchParams.get("appt");
    if (linkedAppt) {
      setDetailsId(linkedAppt);
      setPendingAppt(linkedAppt);
    }
    if (searchParams.get("new") === "1") setPendingClient(searchParams.get("client") ?? "");
  }

  // Strip consumed deep-link params (state above already holds what they asked for).
  useEffect(() => {
    if (hasLink) router.replace(pathname, { scroll: false });
  }, [hasLink, linkKey, pathname, router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const {
    appointments,
    loading,
    error,
    refetch,
    updateStatus,
    markPaid,
    createAppointment,
    updateAppointment,
    loadedDate,
  } = useAppointments(selectedDate);

  const dayStr = format(selectedDate, "yyyy-MM-dd");

  // A linked appointment that isn't on that day's list (deleted, moved, or
  // another shop's) gets feedback instead of silently doing nothing.
  useEffect(() => {
    if (!pendingAppt || loading || loadedDate !== dayStr) return;
    if (!appointments.some((a) => a.id === pendingAppt)) {
      toast.error(t.common.linkNotFound);
      setDetailsId(null);
    }
    setPendingAppt(null);
  }, [pendingAppt, loading, loadedDate, dayStr, appointments, t]);

  // "New booking" from the clients drawer: prefill the form with that client.
  useEffect(() => {
    if (pendingClient === null) return;
    const clientId = pendingClient;
    let cancelled = false;
    (async () => {
      let defaults: Partial<AppointmentFormDefaults> | null = {};
      if (clientId) {
        try {
          const { data } = await getClientById(supabase, clientId);
          const row = (data ?? null) as { name?: string | null; phone?: string | null } | null;
          defaults = row ? { clientName: row.name ?? "", clientPhone: row.phone ?? "" } : null;
        } catch {
          defaults = null;
        }
      }
      if (cancelled) return;
      setPendingClient(null);
      if (!defaults) {
        toast.error(t.common.linkNotFound);
        return;
      }
      setForm({
        open: true,
        appointment: null,
        defaults: { day: dayStr, barberId: currentView !== "master" ? currentView : null, ...defaults },
      });
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per link; day/lane/t are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClient, supabase]);
  const isToday = isSameDay(selectedDate, now);

  const visible = useMemo(
    () => (currentView === "master" ? appointments : appointments.filter((a) => a.barberId === currentView)),
    [appointments, currentView],
  );

  const barberName = (id: string | null) =>
    id ? barbers.find((b) => b.id === id)?.name ?? t.calendar.barber : t.calendar.unassigned;

  // Lanes: team members in view, plus anyone else who has bookings today
  // (e.g. an owner who also cuts hair), plus "Unassigned" when needed.
  const lanes = useMemo<Lane[]>(() => {
    const base: Lane[] =
      currentView === "master"
        ? barbers.map((b) => ({ id: b.id, name: b.name, barberId: b.id }))
        : barbers.filter((b) => b.id === currentView).map((b) => ({ id: b.id, name: b.name, barberId: b.id }));
    const known = new Set(base.map((l) => l.id));
    for (const a of visible) {
      if (a.barberId && !known.has(a.barberId)) {
        known.add(a.barberId);
        base.push({ id: a.barberId, name: t.calendar.barber, barberId: a.barberId });
      }
    }
    if (currentView === "master" && (visible.some((a) => a.barberId === null) || base.length === 0)) {
      base.push({ id: UNASSIGNED_LANE, name: t.calendar.unassigned, barberId: null });
    }
    return base;
  }, [barbers, currentView, visible, t]);

  const range = useMemo(() => computeHourRange(visible), [visible]);
  const ticks = hourTicks(range);
  const nowPct = isToday ? nowPosition(now, range) : null;
  const currency = shopCurrency || appointments[0]?.currency || "JOD";

  const details = detailsId ? appointments.find((a) => a.id === detailsId) ?? null : null;

  // ─── Actions ───
  const openCreate = (defaults?: Partial<AppointmentFormDefaults>) =>
    setForm({
      open: true,
      appointment: null,
      defaults: {
        day: dayStr,
        barberId: currentView !== "master" ? currentView : null,
        ...defaults,
      },
    });

  const handleConfirmStatus = async (a: CalendarAppointment) => {
    try {
      await updateStatus(a.id, "confirmed");
      toast.success(t.calendar.markedConfirmed);
    } catch (err) {
      toast.error(errorText(t, err instanceof AppointmentActionError ? err.code : null));
    }
  };

  const handlePay = async (a: CalendarAppointment, method: PaymentMethod) => {
    try {
      await markPaid(a.id, method);
      toast.success(t.calendar.markedPaid);
      setDetailsId(null);
    } catch (err) {
      toast.error(errorText(t, err instanceof AppointmentActionError ? err.code : null));
    }
  };

  // Rethrows so ConfirmDialog stays open with an inline error.
  const runPendingStatus = async () => {
    if (!pendingStatus) return;
    const { appointment, status } = pendingStatus;
    try {
      await updateStatus(appointment.id, status);
    } catch (err) {
      throw new Error(errorText(t, err instanceof AppointmentActionError ? err.code : null));
    }
    toast.success(status === "no_show" ? t.calendar.markedNoShow : t.calendar.markedCancelled);
    setDetailsId(null);
  };

  const navButton =
    "inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] cursor-pointer";
  const toggleButton = (active: boolean) =>
    cn(
      "flex min-h-[36px] min-w-[44px] items-center justify-center rounded-[8px] px-4 transition-colors cursor-pointer",
      active
        ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
    );

  const appointmentAriaLabel = (a: CalendarAppointment) =>
    [a.clientName, `${formatTime(a.startTime)} – ${formatTime(a.endTime)}`, a.serviceName, statusLabel(a.status)]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1
            className="text-[22px] font-light text-[var(--text-primary)]"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.012em") }}
          >
            {t.calendar.title}
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
              aria-label={t.calendar.prevDay}
              className={navButton}
            >
              <ChevronLeft size={18} className="rtl:-scale-x-100" aria-hidden="true" />
            </button>
            <label className="relative">
              <span className="sr-only">{t.calendar.jumpToDate}</span>
              <input
                type="date"
                value={dayStr}
                onChange={(e) => {
                  const d = parse(e.target.value, "yyyy-MM-dd", new Date());
                  if (isValid(d)) setSelectedDate(d);
                }}
                className="field-input h-11 w-auto min-w-0 cursor-pointer px-3 text-[14px]"
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label={t.calendar.nextDay}
              className={navButton}
            >
              <ChevronRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              disabled={isToday}
              className="btn btn-ghost ms-1 disabled:opacity-50"
            >
              {t.common.today}
            </button>
          </div>
          <p className="w-full text-[13px] text-[var(--text-secondary)] sm:w-auto" aria-live="polite">
            {formatDate(selectedDate, "long")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label={t.calendar.viewMode}
            className="flex items-center gap-1 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1"
          >
            <button
              type="button"
              onClick={() => setView("timeline")}
              aria-label={t.calendar.timeline}
              aria-pressed={view === "timeline"}
              className={toggleButton(view === "timeline")}
            >
              <Clock size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label={t.calendar.listView}
              aria-pressed={view === "list"}
              className={toggleButton(view === "list")}
            >
              <List size={16} aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="btn btn-primary flex-1 sm:flex-none" onClick={() => openCreate()}>
            <Plus size={16} aria-hidden="true" />
            {t.calendar.newBooking}
          </button>
        </div>
      </div>

      {/* Status legend */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={t.calendar.legend}>
        {APPOINTMENT_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", STATUS_STYLES[status].dot)} aria-hidden="true" />
            <span className="text-[12px] text-[var(--text-secondary)]">{statusLabel(status)}</span>
          </li>
        ))}
      </ul>

      {/* Loading */}
      {loading && (
        <GlassCard hoverable={false} padding="md">
          <SkeletonGroup className="min-h-[200px] space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </SkeletonGroup>
        </GlassCard>
      )}

      {/* Error — distinct from a genuinely empty day */}
      {!loading && error && (
        <EmptyState
          icon={AlertTriangle}
          tone="error"
          title={t.calendar.loadError}
          description={errorText(t, error)}
          action={{ label: t.common.retry, onClick: refetch }}
        />
      )}

      {/* Empty */}
      {!loading && !error && visible.length === 0 && (
        <EmptyState
          icon={CalendarX}
          title={t.calendar.emptyTitle}
          description={t.calendar.emptyDescription}
          action={{ label: t.calendar.newBooking, onClick: () => openCreate(), icon: Plus }}
        />
      )}

      {/* Timeline */}
      {!loading && !error && visible.length > 0 && view === "timeline" && (
        <div className="relative">
          <GlassCard hoverable={false} padding="sm" className="overflow-x-auto overscroll-x-contain !p-0">
            <div style={{ minWidth: Math.max(640, ticks.length * 72 + 128) }}>
              {/* Hour header */}
              <div className="flex border-b border-[var(--border-subtle)]" aria-hidden="true">
                <div className="sticky start-0 z-20 w-28 shrink-0 bg-[var(--bg-primary)] p-3 text-[12px] text-[var(--text-muted)] sm:w-32">
                  {t.calendar.barber}
                </div>
                <div className="flex flex-1">
                  {ticks.map((h) => (
                    <div
                      key={h}
                      className="flex-1 border-s border-[var(--border-subtle)] px-2 py-3 text-start text-[11px] tabular-nums text-[var(--text-muted)]"
                    >
                      {formatTime(`${String(h).padStart(2, "0")}:00`, { minute: undefined })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lanes */}
              {lanes.map((lane, laneIdx) => {
                const laneAppts = visible.filter((a) =>
                  lane.id === UNASSIGNED_LANE ? a.barberId === null : a.barberId === lane.id,
                );
                const tracks = packTracks(laneAppts);
                const maxTracks = Math.max(1, ...Array.from(tracks.values()).map((v) => v.tracks));
                const laneHeight = Math.max(72, maxTracks * 44 + 12);

                return (
                  <motion.div
                    key={lane.id}
                    role="group"
                    aria-label={lane.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: laneIdx * 0.04 }}
                    className="flex border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <div className="sticky start-0 z-20 flex w-28 shrink-0 items-center gap-2 bg-[var(--bg-primary)] p-3 sm:w-32">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-primary)]"
                        aria-hidden="true"
                      >
                        {lane.id === UNASSIGNED_LANE ? "—" : initialsOf(lane.name)}
                      </span>
                      <span className="truncate text-[13px] text-[var(--text-secondary)]">{lane.name}</span>
                    </div>

                    <div className="relative flex-1" style={{ minHeight: laneHeight }}>
                      {/* Hour cells: click an empty slot to book it (mouse shortcut; keyboard uses "New Booking") */}
                      <div className="absolute inset-0 flex">
                        {ticks.map((h) => {
                          const timeStr = `${String(h).padStart(2, "0")}:00`;
                          return (
                            <button
                              key={h}
                              type="button"
                              tabIndex={-1}
                              aria-label={interpolate(t.calendar.addAtTime, {
                                barber: lane.name,
                                time: formatTime(timeStr),
                              })}
                              onClick={() => openCreate({ time: timeStr, barberId: lane.barberId })}
                              className="flex-1 cursor-copy border-s border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-secondary)]/60"
                            />
                          );
                        })}
                      </div>

                      {/* Now line */}
                      {nowPct !== null && (
                        <div
                          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[var(--accent-mint)]/60"
                          style={{ insetInlineStart: `${nowPct}%` }}
                          aria-hidden="true"
                        >
                          {laneIdx === 0 && (
                            <span className="absolute top-0 h-2 w-2 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-[var(--accent-mint)]" />
                          )}
                        </div>
                      )}

                      {/* Appointment blocks */}
                      {laneAppts.map((a) => {
                        const { startPct, widthPct } = blockPlacement(a.startTime, a.endTime, range);
                        const { track, tracks: n } = tracks.get(a.id) ?? { track: 0, tracks: 1 };
                        const styles = STATUS_STYLES[a.status];
                        const usable = laneHeight - 12;
                        const h = usable / n;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setDetailsId(a.id)}
                            aria-label={appointmentAriaLabel(a)}
                            aria-haspopup="dialog"
                            className={cn(
                              "absolute z-[15] overflow-hidden rounded-[var(--radius-sm)] border px-2 py-1 text-start",
                              "cursor-pointer transition-shadow hover:shadow-md focus-visible:z-30",
                              styles.bg,
                              styles.border,
                            )}
                            style={{
                              insetInlineStart: `${startPct}%`,
                              width: `calc(${widthPct}% - 2px)`,
                              top: 6 + track * h,
                              height: h - 4,
                            }}
                          >
                            <span className={cn("block truncate text-[12px] font-medium", styles.text)}>
                              {a.clientName}
                            </span>
                            {h >= 40 && (
                              <span className="block truncate text-[11px] tabular-nums text-[var(--text-muted)]">
                                {formatTime(a.startTime)} · {formatDuration(a.durationMinutes)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>

          {role === "shop_admin" && (
            <Link
              href={href("/team")}
              aria-label={t.calendar.addTeamMember}
              title={t.calendar.addTeamMember}
              className="absolute -bottom-5 end-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-[0_10px_24px_-8px_rgba(28,22,17,0.45)] transition-opacity hover:opacity-90"
            >
              <UserPlus size={20} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {/* List */}
      {!loading && !error && visible.length > 0 && view === "list" && (
        <GlassCard hoverable={false} padding="sm" className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <caption className="sr-only">{formatDate(selectedDate, "long")}</caption>
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {[
                    t.calendar.time,
                    t.calendar.client,
                    t.calendar.barber,
                    t.calendar.duration,
                    t.calendar.price,
                    t.calendar.status,
                  ].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn(
                        "px-4 py-3 text-start text-[12px] font-medium text-[var(--text-secondary)]",
                        (i === 2 || i === 3) && "hidden md:table-cell",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const styles = STATUS_STYLES[a.status];
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-[var(--border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--bg-secondary)]"
                    >
                      <td className="px-4 py-3 text-[13px] tabular-nums text-[var(--text-primary)]">
                        {formatTime(a.startTime)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailsId(a.id)}
                          aria-haspopup="dialog"
                          className="min-h-[44px] cursor-pointer text-start text-[14px] text-[var(--text-primary)] underline-offset-4 hover:underline"
                        >
                          {a.clientName}
                          {a.serviceName && (
                            <span className="block text-[12px] text-[var(--text-muted)]">{a.serviceName}</span>
                          )}
                        </button>
                      </td>
                      <td className="hidden px-4 py-3 text-[13px] text-[var(--text-secondary)] md:table-cell">
                        {barberName(a.barberId)}
                      </td>
                      <td className="hidden px-4 py-3 text-[13px] text-[var(--text-secondary)] md:table-cell">
                        {formatDuration(a.durationMinutes)}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium tabular-nums text-[var(--text-primary)]">
                        {formatCurrency(a.price, a.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium",
                            styles.bg,
                            styles.border,
                            styles.text,
                          )}
                        >
                          {statusLabel(a.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Details (actions) */}
      <AppointmentDetailsDialog
        appointment={pendingStatus || form.open ? null : details}
        barberName={details ? barberName(details.barberId) : ""}
        onClose={() => setDetailsId(null)}
        onConfirmStatus={handleConfirmStatus}
        onPay={handlePay}
        onEdit={(a) =>
          setForm({ open: true, appointment: a, defaults: { day: dayStr, barberId: a.barberId } })
        }
        onNoShow={(a) => setPendingStatus({ appointment: a, status: "no_show" })}
        onCancel={(a) => setPendingStatus({ appointment: a, status: "cancelled" })}
      />

      {/* Destructive confirmations */}
      <ConfirmDialog
        open={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        onConfirm={runPendingStatus}
        title={
          pendingStatus
            ? interpolate(
                pendingStatus.status === "no_show" ? t.calendar.noShowTitle : t.calendar.cancelTitle,
                { name: pendingStatus.appointment.clientName },
              )
            : ""
        }
        description={
          pendingStatus
            ? `${formatTime(pendingStatus.appointment.startTime)} · ${barberName(pendingStatus.appointment.barberId)}. ${t.calendar.irreversible}`
            : undefined
        }
        confirmLabel={pendingStatus?.status === "no_show" ? t.calendar.markNoShow : t.calendar.cancelAppointment}
        cancelLabel={t.calendar.keepAppointment}
        destructive
      />

      {/* Create / edit / reschedule */}
      <AppointmentFormDialog
        open={form.open}
        onClose={() => setForm({ open: false })}
        appointment={form.open ? form.appointment : null}
        defaults={form.open ? form.defaults : { day: dayStr }}
        barbers={barbers}
        currency={currency}
        onCreate={createAppointment}
        onUpdate={updateAppointment}
        onSaved={(mode) => {
          toast.success(mode === "create" ? t.calendar.created : t.calendar.saved);
          setForm({ open: false });
          setDetailsId(null);
        }}
      />
    </div>
  );
}
