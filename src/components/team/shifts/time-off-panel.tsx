"use client";

import React, { useState } from "react";
import { AlertCircle, Check, Loader2, Plane, Trash2, X } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import type { ScheduleChange } from "./schedule-logic";
import { AffectedAppointments } from "./affected-appointments";
import { dbErrorMessage, todayIn, zonedToIso, type ShiftMember } from "./shared";

export const TIME_OFF_TYPES = ["annual", "sick", "personal", "training", "other"] as const;
type TimeOffType = (typeof TIME_OFF_TYPES)[number];

interface TimeOffRow {
  id: string;
  start_time: string;
  end_time: string;
  type: TimeOffType;
  status: "pending" | "approved" | "declined";
  note: string | null;
}

/**
 * Time off for one barber (P0V time_off). Admins add approved leave and
 * approve or decline requests; a barber viewing their own row can request
 * leave (pending) and withdraw a pending request.
 */
export function TimeOffPanel({ member, onBusy }: { member: ShiftMember; onBusy: (b: boolean) => void }) {
  const { t, formatDate, formatTime } = useTranslation();
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const userId = useWorkspaceStore((s) => s.userId);
  const tz = useWorkspaceStore((s) => s.timezone) || "Asia/Amman";
  const isAdmin = useWorkspaceStore((s) => s.role) === "shop_admin";
  const isSelf = userId === member.id;
  const canRequest = isAdmin || isSelf;
  const today = todayIn(tz);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [type, setType] = useState<TimeOffType>("annual");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<ScheduleChange | null>(null);
  const [toDelete, setToDelete] = useState<TimeOffRow | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const typeLabel: Record<TimeOffType, string> = {
    annual: t.shifts.typeAnnual,
    sick: t.shifts.typeSick,
    personal: t.shifts.typePersonal,
    training: t.shifts.typeTraining,
    other: t.shifts.typeOther,
  };

  const list = useSupabaseQuery<TimeOffRow[]>(
    async () => {
      const res = await supabase
        .from("time_off")
        .select("id, start_time, end_time, type, status, note")
        .eq("barber_id", member.id)
        .gte("end_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(50);
      return { data: (res.data ?? []) as TimeOffRow[], error: res.error ? { message: res.error.message } : null };
    },
    [supabase, member.id],
    { retryCount: 0 },
  );

  async function save() {
    const startIso = zonedToIso(startDate, allDay ? "00:00" : startTime, tz);
    const endIso = allDay
      ? zonedToIso(new Date(Date.parse(`${endDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10), "00:00", tz)
      : zonedToIso(endDate, endTime, tz);
    if (!startDate || !endDate || endIso <= startIso) return setError(t.shifts.timeOffOrder);
    setSaving(true);
    onBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("time_off").insert({
        shop_id: shopId,
        barber_id: member.id,
        start_time: startIso,
        end_time: endIso,
        type,
        // Admins record approved leave; a barber's own entry is a request.
        status: isAdmin ? "approved" : "pending",
        note: note.trim() || null,
      });
      if (e) throw e;
      toast.success(isAdmin ? t.shifts.timeOffSaved : t.shifts.timeOffRequested);
      if (isAdmin) setLastChange({ type: "time_off", barberId: member.id, startIso, endIso });
      setNote("");
      list.refetch();
    } catch (err) {
      setError(dbErrorMessage(t, err, t.shifts.saveFailed));
    } finally {
      setSaving(false);
      onBusy(false);
    }
  }

  async function setStatus(row: TimeOffRow, status: "approved" | "declined") {
    setBusyRow(row.id);
    try {
      const { error: e } = await supabase.from("time_off").update({ status }).eq("id", row.id);
      if (e) throw e;
      toast.success(status === "approved" ? t.shifts.timeOffApproved : t.shifts.timeOffDeclined);
      if (status === "approved") setLastChange({ type: "time_off", barberId: member.id, startIso: row.start_time, endIso: row.end_time });
      list.refetch();
    } catch (err) {
      toast.error(dbErrorMessage(t, err, t.shifts.saveFailed));
    } finally {
      setBusyRow(null);
    }
  }

  async function remove() {
    if (!toDelete) return;
    const { error: e } = await supabase.from("time_off").delete().eq("id", toDelete.id);
    if (e) throw new Error(dbErrorMessage(t, e, t.shifts.deleteFailed));
    toast.success(t.shifts.timeOffDeleted);
    list.refetch();
  }

  const rangeLabel = (r: TimeOffRow) => {
    const opts = { day: "numeric", month: "short", timeZone: tz } as const;
    return `${formatDate(r.start_time, opts)} ${formatTime(r.start_time, { timeZone: tz })} – ${formatDate(r.end_time, opts)} ${formatTime(r.end_time, { timeZone: tz })}`;
  };

  const statusPill = (s: TimeOffRow["status"]) =>
    s === "approved" ? (
      <Pill tone="success" size="sm">{t.shifts.statusApproved}</Pill>
    ) : s === "pending" ? (
      <Pill tone="brass" size="sm">{t.shifts.statusPending}</Pill>
    ) : (
      <Pill tone="neutral" size="sm">{t.shifts.statusDeclined}</Pill>
    );

  const id = (k: string) => `to-${k}-${member.id}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-[var(--text-secondary)]">{t.shifts.timeOffHelp}</p>

      {canRequest && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={id("start")} className="field-label">{t.shifts.from}</label>
              <input id={id("start")} type="date" value={startDate} min={today} onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} className="field-input" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={id("end")} className="field-label">{t.shifts.to}</label>
              <input id={id("end")} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="field-input" />
            </div>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-[var(--accent-brass)]" />
            {t.shifts.allDay}
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={id("st")} className="field-label">{t.shifts.startTime}</label>
                <input id={id("st")} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="field-input" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={id("et")} className="field-label">{t.shifts.endTime}</label>
                <input id={id("et")} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="field-input" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={id("type")} className="field-label">{t.shifts.type}</label>
              <select id={id("type")} value={type} onChange={(e) => setType(e.target.value as TimeOffType)} className="field-input">
                {TIME_OFF_TYPES.map((k) => (
                  <option key={k} value={k}>{typeLabel[k]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={id("note")} className="field-label">{t.shifts.noteOptional}</label>
              <input id={id("note")} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="field-input" />
            </div>
          </div>
          {error && <p role="alert" className="field-error m-0">{error}</p>}
          <button type="button" className="btn btn-primary w-full sm:w-fit" onClick={() => void save()} disabled={saving} aria-busy={saving || undefined}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? t.common.processing : isAdmin ? t.shifts.addTimeOff : t.shifts.requestTimeOff}
          </button>
        </div>
      )}

      {lastChange && <AffectedAppointments change={lastChange} />}

      <h4 className="m-0 text-sm font-bold text-[var(--text-primary)]">{t.shifts.upcomingTimeOff}</h4>
      {list.initialLoading ? (
        <ListSkeleton rows={2} />
      ) : list.error ? (
        <EmptyState size="sm" tone="error" icon={AlertCircle} title={t.shifts.loadFailed} action={{ label: t.common.retry, onClick: list.refetch }} />
      ) : !list.data?.length ? (
        <EmptyState size="sm" icon={Plane} title={t.shifts.noTimeOff} />
      ) : (
        <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
          {list.data.map((row) => {
            const canDelete = isAdmin || (isSelf && row.status === "pending");
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    {typeLabel[row.type] ?? row.type} {statusPill(row.status)}
                  </span>
                  <span className="block text-[12px] text-[var(--text-secondary)]">{rangeLabel(row)}</span>
                  {row.note && <span className="block truncate text-[12px] text-[var(--text-muted)]">{row.note}</span>}
                </div>
                {isAdmin && row.status === "pending" && (
                  <>
                    <button type="button" className="btn btn-secondary min-h-11 px-3 text-sm" disabled={busyRow === row.id} onClick={() => void setStatus(row, "approved")}>
                      <Check size={15} aria-hidden="true" />
                      {t.shifts.approve}
                    </button>
                    <button type="button" className="btn btn-ghost min-h-11 px-3 text-sm" disabled={busyRow === row.id} onClick={() => void setStatus(row, "declined")}>
                      <X size={15} aria-hidden="true" />
                      {t.shifts.decline}
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setToDelete(row)}
                    aria-label={interpolate(t.shifts.deleteTimeOffFor, { range: rangeLabel(row) })}
                    className="focus-ring inline-flex size-11 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-rose)]"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title={t.shifts.deleteTimeOffTitle}
        description={toDelete ? rangeLabel(toDelete) : undefined}
        confirmLabel={t.common.delete}
        destructive
      />
    </div>
  );
}
