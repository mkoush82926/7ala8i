"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

import { toast } from "@/components/ui/toast";
import { dbErrorMessage, PanelActions, type ShiftMember } from "./shared";

// Weekly working hours for one team member (moved here from the team page,
// behaviour unchanged). Per-date overrides and time off live next to it.

interface DaySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
  break_start: string | null;
  break_end: string | null;
}

/** "09:00" → "09:00:00"; keeps already-qualified values. */
const withSeconds = (v: string) => (v.length === 5 ? `${v}:00` : v);

export function WeeklyHoursPanel({
  member, onBusy, onSaved, onCancel,
}: {
  member: ShiftMember;
  onBusy: (b: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t, formatDate } = useTranslation();
  const supabase = useSupabase();
  const [schedule, setSchedule] = useState<DaySchedule[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Localised weekday names (0 = Sunday): 7 Jan 2024 was a Sunday.
  const dayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => formatDate(new Date(2024, 0, 7 + i), { weekday: "long" })),
    [formatDate],
  );

  const hours = useSupabaseQuery<DaySchedule[]>(
    async () => {
      const res = await supabase
        .from("working_hours")
        .select("day_of_week, start_time, end_time, is_working, break_start, break_end")
        .eq("barber_id", member.id)
        .order("day_of_week", { ascending: true });
      const rows = res.data ?? [];
      const full = Array.from({ length: 7 }, (_, i): DaySchedule => {
        const existing = rows.find((d) => d.day_of_week === i);
        return existing
          ? {
              day_of_week: i,
              start_time: existing.start_time,
              end_time: existing.end_time,
              is_working: existing.is_working ?? true,
              break_start: existing.break_start ?? null,
              break_end: existing.break_end ?? null,
            }
          : { day_of_week: i, start_time: "09:00:00", end_time: "18:00:00", is_working: true, break_start: null, break_end: null };
      });
      return { data: full, error: res.error };
    },
    [supabase, member.id],
    { retryCount: 0 },
  );

  const days = schedule ?? hours.data;

  const updateDay = (day: number, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => (prev ?? hours.data ?? []).map((d) => (d.day_of_week === day ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    if (!days) return;
    for (const d of days) {
      if (!d.is_working) continue;
      const day = dayLabels[d.day_of_week];
      if (d.end_time <= d.start_time) return setError(interpolate(t.team.hoursOrder, { day }));
      if (!d.break_start && !d.break_end) continue;
      if (!d.break_start || !d.break_end) return setError(interpolate(t.team.breakIncomplete, { day }));
      if (d.break_end <= d.break_start) return setError(interpolate(t.team.breakOrder, { day }));
      if (d.break_start < d.start_time || d.break_end > d.end_time)
        return setError(interpolate(t.team.breakOutside, { day }));
    }

    setSaving(true);
    onBusy(true);
    setError(null);
    try {
      const rows = days.map((d) => ({
        barber_id: member.id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        is_working: d.is_working,
        break_start: d.is_working ? d.break_start : null,
        break_end: d.is_working ? d.break_end : null,
      }));
      const { error: saveError } = await supabase
        .from("working_hours")
        .upsert(rows, { onConflict: "barber_id,day_of_week" });
      if (saveError) throw saveError;
      toast.success(t.team.hoursSaved);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(t, err, t.team.hoursFailed));
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  if (hours.initialLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  if (hours.error || !days) {
    return (
      <EmptyState
        size="sm"
        tone="error"
        icon={AlertCircle}
        title={t.team.hoursLoadFailed}
        action={{ label: t.common.retry, onClick: hours.refetch }}
      />
    );
  }

  const timeInput =
    "h-11 w-full min-w-0 rounded-[var(--radius-inputs)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 text-center text-sm text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent-brass)] sm:w-28 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2" disabled={saving}>
        <legend className="sr-only">{t.team.tabHours}</legend>
        {days.map((day) => {
          const label = dayLabels[day.day_of_week];
          return (
            <div
              key={day.day_of_week}
              className={cn(
                "flex flex-col gap-2 rounded-[var(--radius-inputs)] border border-[var(--border-subtle)] p-3",
                day.is_working ? "bg-[var(--bg-secondary)]" : "bg-[var(--bg-primary)]",
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-[140px] cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.is_working}
                    onChange={(e) => updateDay(day.day_of_week, { is_working: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-[var(--accent-mint)]"
                  />
                  <span className={cn("text-sm font-medium", day.is_working ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>
                    {label}
                  </span>
                  {!day.is_working && <span className="text-[12px] text-[var(--text-muted)]">· {t.team.dayOff}</span>}
                </label>

                {day.is_working && (
                  <div className="flex flex-1 items-center gap-2 sm:flex-none">
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.startTime}`}
                      value={day.start_time.substring(0, 5)}
                      onChange={(e) => e.target.value && updateDay(day.day_of_week, { start_time: withSeconds(e.target.value) })}
                      className={timeInput}
                    />
                    <span aria-hidden="true" className="text-[var(--text-muted)]">–</span>
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.endTime}`}
                      value={day.end_time.substring(0, 5)}
                      onChange={(e) => e.target.value && updateDay(day.day_of_week, { end_time: withSeconds(e.target.value) })}
                      className={timeInput}
                    />
                  </div>
                )}
              </div>

              {day.is_working && (
                <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-subtle)] pt-2">
                  <span className="w-full text-[12px] font-medium text-[var(--text-muted)] sm:w-auto">{t.team.breakLabel}</span>
                  <div className="flex flex-1 items-center gap-2 sm:flex-none">
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.breakStart}`}
                      value={day.break_start ? day.break_start.substring(0, 5) : ""}
                      onChange={(e) => updateDay(day.day_of_week, { break_start: e.target.value ? withSeconds(e.target.value) : null })}
                      className={timeInput}
                    />
                    <span aria-hidden="true" className="text-[var(--text-muted)]">–</span>
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.breakEnd}`}
                      value={day.break_end ? day.break_end.substring(0, 5) : ""}
                      onChange={(e) => updateDay(day.day_of_week, { break_end: e.target.value ? withSeconds(e.target.value) : null })}
                      className={timeInput}
                    />
                  </div>
                  {(day.break_start || day.break_end) && (
                    <button
                      type="button"
                      onClick={() => updateDay(day.day_of_week, { break_start: null, break_end: null })}
                      className="focus-ring min-h-[44px] rounded px-2 text-[12px] font-medium text-[var(--text-muted)] underline transition-colors hover:text-[var(--accent-rose)]"
                      aria-label={`${label} — ${t.team.clearBreak}`}
                    >
                      {t.team.clearBreak}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      {error && <p role="alert" className="field-error">{error}</p>}

      <PanelActions onCancel={onCancel} onSave={handleSave} saving={saving} saveLabel={t.team.saveHours} />
    </div>
  );
}
