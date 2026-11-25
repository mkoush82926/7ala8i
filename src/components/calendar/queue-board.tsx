"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Armchair, CalendarDays, Clock, Loader2, LogOut, MonitorPlay, RotateCcw, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation, interpolate, headingTracking } from "@/hooks/use-translation";
import { QueueActionError, useQueue } from "./use-queue";
import { roundWait, type QueueEntry } from "./queue-model";
import { errorText } from "./error-text";

const NEXT_FREE = "__next__";

/**
 * Front desk walk-in queue: check in (name optional), live estimated waits,
 * seat with the next free barber (pick_any_barber) or a chosen one, and mark
 * clients who left. Changes appear on every screen through Realtime.
 */
export function QueueBoard() {
  const { t, isRTL, FFD, href, locale, formatTime, formatNumber } = useTranslation();
  const barbers = useWorkspaceStore((s) => s.barbers);
  const role = useWorkspaceStore((s) => s.role);
  const selfId = useWorkspaceStore((s) => s.userId);
  const isAdmin = role === "shop_admin";
  const q = useQueue();
  const id = useId();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [seatFor, setSeatFor] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<QueueEntry | null>(null);

  const serviceName = (sid: string) => {
    const s = q.services.find((x) => x.id === sid);
    return s ? (locale === "ar" && s.name_ar ? s.name_ar : s.name) : "";
  };
  const barberName = (bid: string | null) => (bid ? barbers.find((b) => b.id === bid)?.name ?? t.calendar.barber : t.queue.anyBarber);
  const label = (e: QueueEntry) => e.clientName || interpolate(t.queue.ticket, { n: formatNumber(e.ticketNo) });

  const waitText = (e: QueueEntry) => {
    const est = q.estimates.get(e.id);
    if (!est || est.waitMinutes < 0) return t.queue.waitUnknown;
    const m = roundWait(est.waitMinutes);
    return m === 0 ? t.queue.waitNow : interpolate(t.queue.waitMinutes, { n: formatNumber(m) });
  };

  const fail = (err: unknown) => errorText(t, err instanceof QueueActionError ? err.code : null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const entry = await q.checkIn({
        clientName: name,
        phone,
        serviceIds: picked,
        preferredBarberId: preferred || null,
        note,
      });
      toast.success(interpolate(t.queue.checkedIn, { name: entry ? label(entry) : "" }));
      setName("");
      setPhone("");
      setPicked([]);
      setPreferred("");
      setNote("");
    } catch (err) {
      toast.error(fail(err));
    } finally {
      setSaving(false);
    }
  };

  const seat = async (e: QueueEntry) => {
    const choice = seatFor[e.id] ?? (e.preferredBarberId || (isAdmin ? NEXT_FREE : selfId ?? NEXT_FREE));
    setBusyId(e.id);
    try {
      const res = await q.assign(e.id, choice === NEXT_FREE ? null : choice);
      toast.success(interpolate(t.queue.seated, { name: label(e), barber: barberName(res?.barber_id ?? null) }));
    } catch (err) {
      toast.error(fail(err));
    } finally {
      setBusyId(null);
    }
  };

  const markLeft = async () => {
    if (!leaving) return;
    try {
      await q.setStatus(leaving.id, "left");
    } catch (err) {
      throw new Error(fail(err));
    }
    const entry = leaving;
    toast.success(interpolate(t.queue.markedLeft, { name: label(entry) }), {
      action: { label: t.calendar.undo, onClick: () => q.setStatus(entry.id, "waiting").catch((err) => toast.error(fail(err))) },
    });
  };

  const seatOptions = isAdmin ? barbers : barbers.filter((b) => b.id === selfId);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-light text-[var(--text-primary)]" style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.012em") }}>
            {t.queue.title}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)]">{t.queue.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={href("/calendar")} className="btn btn-ghost">
            <CalendarDays size={16} aria-hidden="true" />
            {t.calendar.title}
          </Link>
          <Link href={href("/queue/display")} className="btn btn-secondary">
            <MonitorPlay size={16} aria-hidden="true" />
            {t.queue.tvView}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Check-in */}
        <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4" aria-labelledby={`${id}-h`}>
          <h2 id={`${id}-h`} className="flex items-center gap-2 text-[16px] font-medium text-[var(--text-primary)]">
            <UserPlus size={18} aria-hidden="true" />
            {t.queue.checkIn}
          </h2>
          <div>
            <label htmlFor={`${id}-name`} className="field-label">
              {t.queue.nameOptional}
            </label>
            <input id={`${id}-name`} className="field-input" value={name} maxLength={120} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-phone`} className="field-label">
              {t.calendar.clientPhone}
            </label>
            <input
              id={`${id}-phone`}
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="field-input text-start"
              value={phone}
              maxLength={20}
              autoComplete="off"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <fieldset>
            <legend className="field-label">{t.calendar.service}</legend>
            {q.services.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">{t.queue.noServices}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.services.map((s) => {
                  const on = picked.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== s.id) : prev.length >= 10 ? prev : [...prev, s.id]))}
                      className={cn(
                        "min-h-[40px] rounded-full border px-3 text-[13px] transition-colors",
                        on ? "border-[var(--accent-brass)] bg-[var(--accent-blue-muted)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]",
                      )}
                    >
                      {locale === "ar" && s.name_ar ? s.name_ar : s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
          <div>
            <label htmlFor={`${id}-pref`} className="field-label">
              {t.queue.preferredBarber}
            </label>
            <select id={`${id}-pref`} className="field-input" value={preferred} onChange={(e) => setPreferred(e.target.value)}>
              <option value="">{t.queue.anyBarber}</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-note`} className="field-label">
              {t.calendar.notes}
            </label>
            <input id={`${id}-note`} className="field-input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={saving} aria-busy={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
            {t.queue.addToQueue}
          </button>
        </form>

        {/* Queue */}
        <div className="space-y-6">
          <section aria-labelledby={`${id}-waiting`}>
            <h2 id={`${id}-waiting`} className="mb-3 flex items-center gap-2 text-[16px] font-medium text-[var(--text-primary)]">
              <Clock size={18} aria-hidden="true" />
              {interpolate(t.queue.waitingCount, { n: formatNumber(q.waiting.length) })}
            </h2>

            {q.loading && (
              <SkeletonGroup className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </SkeletonGroup>
            )}
            {!q.loading && q.error && (
              <EmptyState icon={AlertTriangle} tone="error" title={t.queue.loadError} description={errorText(t, q.error)} action={{ label: t.common.retry, onClick: q.reload }} />
            )}
            {!q.loading && !q.error && q.waiting.length === 0 && (
              <EmptyState icon={Users} title={t.queue.emptyTitle} description={t.queue.emptyDescription} />
            )}

            {!q.loading && !q.error && q.waiting.length > 0 && (
              <ol className="space-y-2">
                {q.waiting.map((e) => {
                  const est = q.estimates.get(e.id);
                  const choice = seatFor[e.id] ?? (e.preferredBarberId || (isAdmin ? NEXT_FREE : selfId ?? NEXT_FREE));
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[15px] font-semibold tabular-nums text-[var(--text-primary)]"
                        aria-label={interpolate(t.queue.ticket, { n: formatNumber(e.ticketNo) })}
                      >
                        {formatNumber(e.ticketNo)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-[var(--text-primary)]">{label(e)}</p>
                        <p className="truncate text-[12px] text-[var(--text-muted)]">
                          {[e.serviceIds.map(serviceName).filter(Boolean).join(" + "), e.preferredBarberId ? barberName(e.preferredBarberId) : null, interpolate(t.queue.since, { time: formatTime(e.checkedInAt) })]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-[15px] font-semibold tabular-nums text-[var(--accent-text)]">{waitText(e)}</p>
                        {est?.barberId && <p className="text-[12px] text-[var(--text-muted)]">{barberName(est.barberId)}</p>}
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <label className="sr-only" htmlFor={`${id}-seat-${e.id}`}>
                          {t.queue.seatWith}
                        </label>
                        <select
                          id={`${id}-seat-${e.id}`}
                          className="field-input h-10 w-auto flex-1 py-0 text-[13px] sm:flex-none"
                          value={choice}
                          onChange={(ev) => setSeatFor((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                        >
                          {isAdmin && <option value={NEXT_FREE}>{t.queue.nextFree}</option>}
                          {seatOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-primary h-10 min-h-0" disabled={busyId === e.id} aria-busy={busyId === e.id} onClick={() => seat(e)}>
                          {busyId === e.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Armchair size={16} aria-hidden="true" />}
                          {t.queue.seatNow}
                        </button>
                        <button type="button" className="btn btn-ghost h-10 min-h-0" onClick={() => setLeaving(e)} aria-label={interpolate(t.queue.markLeftFor, { name: label(e) })}>
                          <LogOut size={16} aria-hidden="true" className="rtl:-scale-x-100" />
                          <span className="hidden sm:inline">{t.queue.left}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {q.serving.length > 0 && (
            <section aria-labelledby={`${id}-serving`}>
              <h2 id={`${id}-serving`} className="mb-3 flex items-center gap-2 text-[16px] font-medium text-[var(--text-primary)]">
                <Armchair size={18} aria-hidden="true" />
                {t.queue.serving}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {q.serving.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--text-muted)]">#{formatNumber(e.ticketNo)}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-primary)]">{label(e)}</span>
                    <span className="text-[12px] text-[var(--text-secondary)]">{barberName(e.assignedBarberId)}</span>
                    {e.appointmentId && (
                      <Link
                        href={`${href("/calendar")}?appt=${e.appointmentId}`}
                        className="text-[12px] text-[var(--accent-text)] underline-offset-4 hover:underline"
                      >
                        {t.queue.openBooking}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {q.finished.length > 0 && (
            <details className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
              <summary className="cursor-pointer text-[13px] text-[var(--text-secondary)]">
                {interpolate(t.queue.finishedToday, { n: formatNumber(q.finished.length) })}
              </summary>
              <ul className="mt-2 space-y-1">
                {q.finished.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                    <span className="tabular-nums text-[var(--text-muted)]">#{formatNumber(e.ticketNo)}</span>
                    <span className="flex-1 truncate">{label(e)}</span>
                    <span>{e.status === "done" ? t.queue.done : t.queue.left}</span>
                    {e.status === "left" && (
                      <button
                        type="button"
                        className="btn btn-ghost h-8 min-h-0 px-2"
                        onClick={() => q.setStatus(e.id, "waiting").catch((err) => toast.error(fail(err)))}
                        aria-label={interpolate(t.queue.backToQueueFor, { name: label(e) })}
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!leaving}
        onClose={() => setLeaving(null)}
        onConfirm={markLeft}
        title={leaving ? interpolate(t.queue.leftTitle, { name: label(leaving) }) : ""}
        description={t.queue.leftDescription}
        confirmLabel={t.queue.left}
        destructive
      />
    </div>
  );
}
