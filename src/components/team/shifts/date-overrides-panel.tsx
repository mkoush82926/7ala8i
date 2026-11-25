"use client";

import React, { useState } from "react";
import { AlertCircle, CalendarDays, Loader2, Trash2 } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { formatHijri } from "@/lib/hijri";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { normalizeSegments, parseSegments, validateSegments, type Segment, type ScheduleChange } from "./schedule-logic";
import { SegmentsEditor, segmentIssueMessage } from "./segments-editor";
import { AffectedAppointments } from "./affected-appointments";
import { dbErrorMessage, todayIn, type ShiftMember } from "./shared";

interface OverrideRow {
  id: string;
  date: string;
  segments: unknown;
  note: string | null;
}

/**
 * Per-date shift overrides for one barber (P0V shift_overrides): several
 * segments on a date, or [] for a day off. Saving lists the bookings that no
 * longer fit so the owner can tell those clients.
 */
export function DateOverridesPanel({ member, onBusy }: { member: ShiftMember; onBusy: (b: boolean) => void }) {
  const { t, locale, formatDate } = useTranslation();
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const tz = useWorkspaceStore((s) => s.timezone) || "Asia/Amman";
  const isAdmin = useWorkspaceStore((s) => s.role) === "shop_admin";
  const today = todayIn(tz);

  const [date, setDate] = useState(today);
  const [segments, setSegments] = useState<Segment[]>([{ start: "09:00", end: "18:00" }]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<ScheduleChange | null>(null);
  const [toDelete, setToDelete] = useState<OverrideRow | null>(null);

  const list = useSupabaseQuery<OverrideRow[]>(
    async () => {
      const res = await supabase
        .from("shift_overrides")
        .select("id, date, segments, note")
        .eq("barber_id", member.id)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(60);
      return { data: (res.data ?? []) as OverrideRow[], error: res.error ? { message: res.error.message } : null };
    },
    [supabase, member.id, today],
    { retryCount: 0 },
  );

  async function save() {
    if (!date) return setError(t.shifts.dateRequired);
    const segs = normalizeSegments(segments);
    const issue = validateSegments(segs);
    if (issue) return setError(segmentIssueMessage(t, issue));
    setSaving(true);
    onBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("shift_overrides").upsert(
        { shop_id: shopId, barber_id: member.id, date, segments: segs, note: note.trim() || null },
        { onConflict: "barber_id,date" },
      );
      if (e) throw e;
      toast.success(t.shifts.overrideSaved);
      setLastChange({ type: "shift_override", barberId: member.id, date, segments: segs });
      setNote("");
      list.refetch();
    } catch (err) {
      setError(dbErrorMessage(t, err, t.shifts.saveFailed));
    } finally {
      setSaving(false);
      onBusy(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    const { error: e } = await supabase.from("shift_overrides").delete().eq("id", toDelete.id);
    if (e) throw new Error(dbErrorMessage(t, e, t.shifts.deleteFailed));
    toast.success(t.shifts.overrideDeleted);
    list.refetch();
  }

  const dateLabel = (d: string) =>
    `${formatDate(`${d}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · ${formatHijri(d, locale, { withYear: false })}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-ink-soft">{t.shifts.overridesHelp}</p>

      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`ovr-date-${member.id}`} className="field-label">
              {t.shifts.date}
            </label>
            <input
              id={`ovr-date-${member.id}`}
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field-input"
            />
            {date && <span className="text-[12px] text-ink-muted">{formatHijri(date, locale)}</span>}
          </div>
          <SegmentsEditor value={segments} onChange={setSegments} label={date || t.shifts.date} emptyLabel={t.shifts.dayOffOnDate} disabled={saving} />
          <div className="flex flex-col gap-1">
            <label htmlFor={`ovr-note-${member.id}`} className="field-label">
              {t.shifts.noteOptional}
            </label>
            <input
              id={`ovr-note-${member.id}`}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="field-input"
            />
          </div>
          {error && (
            <p role="alert" className="field-error m-0">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-primary w-full sm:w-fit" onClick={() => void save()} disabled={saving} aria-busy={saving || undefined}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? t.common.processing : t.shifts.saveOverride}
          </button>
        </div>
      )}

      {lastChange && <AffectedAppointments change={lastChange} />}

      <h4 className="m-0 text-sm font-bold text-ink">{t.shifts.upcomingOverrides}</h4>
      {list.initialLoading ? (
        <ListSkeleton rows={2} />
      ) : list.error ? (
        <EmptyState size="sm" tone="error" icon={AlertCircle} title={t.shifts.loadFailed} action={{ label: t.common.retry, onClick: list.refetch }} />
      ) : !list.data?.length ? (
        <EmptyState size="sm" icon={CalendarDays} title={t.shifts.noOverrides} description={t.shifts.noOverridesHint} />
      ) : (
        <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
          {list.data.map((row) => {
            const segs = parseSegments(row.segments);
            return (
              <li key={row.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{dateLabel(row.date)}</span>
                  <span className="block text-[12px] text-ink-soft" dir="ltr">
                    {segs.length ? segs.map((s) => `${s.start}–${s.end}`).join(" · ") : t.shifts.dayOff}
                  </span>
                  {row.note && <span className="block truncate text-[12px] text-ink-muted">{row.note}</span>}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setToDelete(row)}
                    aria-label={interpolate(t.shifts.deleteOverrideFor, { date: dateLabel(row.date) })}
                    className="focus-ring inline-flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-danger-text"
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
        title={t.shifts.deleteOverrideTitle}
        description={toDelete ? dateLabel(toDelete.date) : undefined}
        confirmLabel={t.common.delete}
        destructive
      />
    </div>
  );
}
