"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Armchair, CalendarDays, Check, CheckCheck, Clock, LogOut, MonitorPlay, RotateCcw, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, ButtonLink } from "@/components/ui/button";
import { FilterChip, Pill } from "@/components/ui/pill";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { textLinkClasses } from "@/components/ui/recipes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { QueueActionError, useQueue } from "./use-queue";
import { roundWait, type QueueEntry } from "./queue-model";
import { errorText } from "./error-text";

const NEXT_FREE = "__next__";
/** Waits at or above this read as amber (still paired with the minutes text). */
const LONG_WAIT_MINUTES = 30;
type Lane = "waiting" | "serving" | "done";

/**
 * Front desk walk-in queue: check in (name optional), live estimated waits,
 * seat with the next free barber (pick_any_barber) or a chosen one, and mark
 * clients who left. Changes appear on every screen through Realtime.
 */
export function QueueBoard() {
  const { t, href, locale, formatTime, formatNumber } = useTranslation();
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
  const [lane, setLane] = useState<Lane>("waiting");
  // v2 keys (queue.lanesLabel, queue.finishedEmpty) land with the shared i18n merge; fall back until then.
  const tq = t.queue as typeof t.queue & { lanesLabel?: string; finishedEmpty?: string };

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
  const lanes: { value: Lane; label: string }[] = [
    { value: "waiting", label: interpolate(t.queue.waitingCount, { n: formatNumber(q.waiting.length) }) },
    { value: "serving", label: `${t.queue.serving} (${formatNumber(q.serving.length)})` },
    { value: "done", label: `${t.queue.done} (${formatNumber(q.finished.length)})` },
  ];
  // Below lg one lane shows at a time (segmented switch); from lg every lane is visible.
  const laneClass = (value: Lane) => cn(lane !== value && "hidden lg:block");

  return (
    <div className="space-y-5 pb-28 lg:space-y-6 lg:pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h2 text-ink">{t.queue.title}</h1>
          <p className="mt-1 max-w-[65ch] text-meta text-ink-muted">{t.queue.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={href("/calendar")} variant="ghost" size="sm" icon={<CalendarDays aria-hidden="true" />}>
            {t.calendar.title}
          </ButtonLink>
          <ButtonLink href={href("/queue/display")} variant="secondary" size="sm" icon={<MonitorPlay aria-hidden="true" />}>
            {t.queue.tvView}
          </ButtonLink>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-6">
        {/* Check-in */}
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-line bg-card p-4 lg:sticky lg:top-24 lg:p-5"
          aria-labelledby={`${id}-h`}
        >
          <h2 id={`${id}-h`} className="flex items-center gap-2.5 text-h3 text-ink">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-text">
              <UserPlus size={16} />
            </span>
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
              className="field-input text-start tabular-nums"
              value={phone}
              maxLength={20}
              autoComplete="off"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <fieldset>
            <legend className="field-label">{t.calendar.service}</legend>
            {q.services.length === 0 ? (
              <p className="rounded-lg bg-sunken px-3 py-2.5 text-[13px] text-ink-muted">{t.queue.noServices}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.services.map((s) => {
                  const on = picked.includes(s.id);
                  return (
                    <FilterChip
                      key={s.id}
                      pressed={on}
                      icon={on ? <Check aria-hidden="true" /> : undefined}
                      onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== s.id) : prev.length >= 10 ? prev : [...prev, s.id]))}
                    >
                      {locale === "ar" && s.name_ar ? s.name_ar : s.name}
                    </FilterChip>
                  );
                })}
              </div>
            )}
          </fieldset>
          <div>
            <label htmlFor={`${id}-pref`} className="field-label">
              {t.queue.preferredBarber}
            </label>
            <select id={`${id}-pref`} className="field-input cursor-pointer" value={preferred} onChange={(e) => setPreferred(e.target.value)}>
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
          <Button type="submit" size="lg" fullWidth loading={saving} icon={<UserPlus aria-hidden="true" />}>
            {t.queue.addToQueue}
          </Button>
        </form>

        {/* Board */}
        <div className="min-w-0 space-y-4">
          <SegmentedControl
            ariaLabel={tq.lanesLabel ?? t.queue.title}
            value={lane}
            onChange={setLane}
            options={lanes}
            fullWidth
            size="sm"
            className="lg:hidden"
          />

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            {/* Waiting */}
            <section aria-labelledby={`${id}-waiting`} className={cn("rounded-xl bg-sunken p-3", laneClass("waiting"))}>
              <h2 id={`${id}-waiting`} className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-ink">
                <Clock size={16} aria-hidden="true" className="text-ink-muted" />
                {interpolate(t.queue.waitingCount, { n: formatNumber(q.waiting.length) })}
              </h2>

              {q.loading && (
                <SkeletonGroup className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl bg-card" />
                  ))}
                </SkeletonGroup>
              )}
              {!q.loading && q.error && (
                <EmptyState icon={AlertTriangle} tone="error" size="sm" title={t.queue.loadError} description={errorText(t, q.error)} action={{ label: t.common.retry, onClick: q.reload }} />
              )}
              {!q.loading && !q.error && q.waiting.length === 0 && (
                <EmptyState icon={Users} size="sm" title={t.queue.emptyTitle} description={t.queue.emptyDescription} />
              )}

              {!q.loading && !q.error && q.waiting.length > 0 && (
                <ol className="space-y-2">
                  {q.waiting.map((e) => {
                    const est = q.estimates.get(e.id);
                    const choice = seatFor[e.id] ?? (e.preferredBarberId || (isAdmin ? NEXT_FREE : selfId ?? NEXT_FREE));
                    const long = !!est && est.waitMinutes >= LONG_WAIT_MINUTES;
                    const meta = [
                      e.serviceIds.map(serviceName).filter(Boolean).join(" + "),
                      e.preferredBarberId ? barberName(e.preferredBarberId) : null,
                      interpolate(t.queue.since, { time: formatTime(e.checkedInAt) }),
                    ].filter(Boolean);
                    return (
                      <li key={e.id} className="rounded-xl border border-line bg-card p-4 shadow-xs">
                        <div className="flex items-start gap-3">
                          <span
                            className="min-w-[2ch] text-[28px] font-bold leading-8 tabular-nums text-ink"
                            aria-label={interpolate(t.queue.ticket, { n: formatNumber(e.ticketNo) })}
                          >
                            {formatNumber(e.ticketNo)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-title text-ink">{label(e)}</p>
                            {meta.length > 0 && <p className="mt-0.5 line-clamp-2 text-meta text-ink-muted">{meta.join(" · ")}</p>}
                          </div>
                          <div className="shrink-0 text-end">
                            <p className={cn("flex items-center justify-end gap-1 text-[15px] font-semibold tabular-nums", long ? "text-warning-text" : "text-brand-text")}>
                              {long && <AlertTriangle size={14} aria-hidden="true" />}
                              {waitText(e)}
                            </p>
                            {est?.barberId && <p className="mt-0.5 text-xs text-ink-muted">{barberName(est.barberId)}</p>}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                          <label className="sr-only" htmlFor={`${id}-seat-${e.id}`}>
                            {t.queue.seatWith}
                          </label>
                          <select
                            id={`${id}-seat-${e.id}`}
                            className="h-9 min-w-0 flex-1 cursor-pointer rounded-full border border-line-strong bg-card px-3 text-sm font-medium text-ink hover:border-ink-soft focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 sm:flex-none"
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
                          <Button size="sm" loading={busyId === e.id} icon={<Armchair aria-hidden="true" />} onClick={() => seat(e)}>
                            {t.queue.seatNow}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ms-auto"
                            onClick={() => setLeaving(e)}
                            aria-label={interpolate(t.queue.markLeftFor, { name: label(e) })}
                            icon={<LogOut aria-hidden="true" className="rtl:-scale-x-100" />}
                          >
                            <span className="hidden sm:inline">{t.queue.left}</span>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <div className="space-y-4">
              {/* In the chair */}
              <section aria-labelledby={`${id}-serving`} className={cn("rounded-xl bg-sunken p-3", laneClass("serving"))}>
                <h2 id={`${id}-serving`} className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-ink">
                  <Armchair size={16} aria-hidden="true" className="text-ink-muted" />
                  {t.queue.serving}
                  <span className="ms-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-soft">{formatNumber(q.serving.length)}</span>
                </h2>
                {q.serving.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line-strong/50 px-4 py-6 text-center text-meta text-ink-muted">{t.queue.displayNobodyServing}</p>
                ) : (
                  <ul className="space-y-2">
                    {q.serving.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 shadow-xs">
                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-base font-bold tabular-nums text-on-brand">
                          {formatNumber(e.ticketNo)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{label(e)}</span>
                          <span className="block truncate text-xs text-ink-muted">{barberName(e.assignedBarberId)}</span>
                        </span>
                        {e.appointmentId && (
                          <Link href={`${href("/calendar")}?appt=${e.appointmentId}`} className={cn(textLinkClasses, "shrink-0 text-[13px]")}>
                            {t.queue.openBooking}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Done today */}
              <section aria-labelledby={`${id}-done`} className={cn("rounded-xl bg-sunken p-3", laneClass("done"))}>
                <h2 id={`${id}-done`} className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-ink">
                  <CheckCheck size={16} aria-hidden="true" className="text-ink-muted" />
                  {interpolate(t.queue.finishedToday, { n: formatNumber(q.finished.length) })}
                </h2>
                {q.finished.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line-strong/50 px-4 py-6 text-center text-meta text-ink-muted">{tq.finishedEmpty ?? t.common.noData}</p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
                    {q.finished.map((e) => (
                      <li key={e.id} className="flex min-h-12 items-center gap-3 px-3 py-1.5 text-sm">
                        <span className="w-8 shrink-0 font-semibold tabular-nums text-ink-muted">#{formatNumber(e.ticketNo)}</span>
                        <span className="min-w-0 flex-1 truncate text-ink">{label(e)}</span>
                        <Pill tone={e.status === "done" ? "success" : "neutral"} size="sm" icon={e.status === "done" ? <Check /> : <LogOut className="rtl:-scale-x-100" />}>
                          {e.status === "done" ? t.queue.done : t.queue.left}
                        </Pill>
                        {e.status === "left" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => q.setStatus(e.id, "waiting").catch((err) => toast.error(fail(err)))}
                            aria-label={interpolate(t.queue.backToQueueFor, { name: label(e) })}
                          >
                            <RotateCcw aria-hidden="true" className="rtl:-scale-x-100" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
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
