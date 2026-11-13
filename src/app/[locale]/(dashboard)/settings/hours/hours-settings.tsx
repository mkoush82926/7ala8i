"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, CalendarX2, Clock, Loader2, Moon, Trash2 } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { HIJRI_PRESETS, eachDateInRange, formatHijri, upcomingHijriYear, type HijriPresetId } from "@/lib/hijri";
import {
  AffectedAppointments,
  ClosureBanner,
  SegmentsEditor,
  dbErrorMessage,
  normalizeSegments,
  segmentIssueMessage,
  todayIn,
  validateSegments,
  type ScheduleChange,
  type Segment,
} from "@/components/team/shifts";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { HijriDateField } from "./hijri-date-field";
import {
  groupSpecialRows,
  resolvePreset,
  segmentsLabel,
  validateRange,
  type ExceptionKind,
  type SpecialGroup,
  type SpecialRow,
} from "./hours-logic";

interface ClosedRow {
  id: string;
  start_date: string;
  end_date: string;
  note_en: string | null;
  note_ar: string | null;
}

type ListEntry =
  | { type: "closed"; key: string; ids: string[]; start: string; end: string; noteEn: string | null; noteAr: string | null }
  | { type: "special"; key: string; group: SpecialGroup };

const card = "flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 sm:p-5";
const h2 = "m-0 text-base font-bold text-[var(--text-primary)]";

/**
 * Shop-wide hours exceptions: closures (Eid, holidays) and special hours
 * (Ramadan), entered on the Gregorian or Hijri calendar or from a Hijri
 * preset, with the bookings each change affects and a bulk notify.
 */
export function HoursSettings() {
  const { t, locale, formatDate } = useTranslation();
  const ts = t.shifts;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const tz = useWorkspaceStore((s) => s.timezone) || "Asia/Amman";
  const today = todayIn(tz);

  // ── Form ──
  const [calendar, setCalendar] = useState<"gregorian" | "hijri">("gregorian");
  const [kind, setKind] = useState<ExceptionKind>("closed");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [segments, setSegments] = useState<Segment[]>([{ start: "10:00", end: "16:00" }]);
  const [noteEn, setNoteEn] = useState("");
  const [noteAr, setNoteAr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<ScheduleChange | null>(null);

  // ── Presets ──
  const [presetId, setPresetId] = useState<HijriPresetId>("ramadan");
  const [presetYear, setPresetYear] = useState(() => upcomingHijriYear("ramadan", today));
  const preset = useMemo(() => resolvePreset(presetId, presetYear), [presetId, presetYear]);
  const presetName = (id: HijriPresetId, loc: "en" | "ar" = locale) =>
    ((loc === "ar" ? ar : en).shifts.presets as Record<string, string>)[id] ?? id;

  function applyPreset() {
    if (!preset) return;
    setKind(preset.kind);
    setStart(preset.start < today ? today : preset.start);
    setEnd(preset.end);
    if (preset.kind === "special") setSegments(preset.segments);
    const label = (loc: "en" | "ar") => `${presetName(presetId, loc)} ${presetYear}`;
    setNoteEn(label("en"));
    setNoteAr(label("ar"));
    setError(null);
    document.getElementById("hours-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Upcoming exceptions ──
  const list = useSupabaseQuery<ListEntry[]>(
    async () => {
      const [c, sh] = await Promise.all([
        supabase
          .from("closed_periods")
          .select("id, start_date, end_date, note_en, note_ar")
          .eq("shop_id", shopId)
          .gte("end_date", today)
          .order("start_date")
          .limit(100),
        supabase
          .from("special_hours")
          .select("id, date, is_closed, segments, note_en, note_ar")
          .eq("shop_id", shopId)
          .gte("date", today)
          .order("date")
          .limit(400),
      ]);
      const err = c.error ?? sh.error;
      if (err) return { data: null, error: { message: err.message } };
      const entries: ListEntry[] = [
        ...((c.data ?? []) as ClosedRow[]).map(
          (r): ListEntry => ({ type: "closed", key: `c-${r.id}`, ids: [r.id], start: r.start_date, end: r.end_date, noteEn: r.note_en, noteAr: r.note_ar }),
        ),
        ...groupSpecialRows((sh.data ?? []) as SpecialRow[]).map((g): ListEntry => ({ type: "special", key: `s-${g.ids[0]}`, group: g })),
      ];
      entries.sort((a, b) => (a.type === "closed" ? a.start : a.group.start).localeCompare(b.type === "closed" ? b.start : b.group.start));
      return { data: entries, error: null };
    },
    [supabase, shopId, today],
    { enabled: !!shopId, retryCount: 0 },
  );
  const [toDelete, setToDelete] = useState<ListEntry | null>(null);

  async function save() {
    if (saving) return;
    const issue = validateRange(start, end, kind, today);
    if (issue) {
      setError(
        issue === "ORDER" ? ts.rangeOrder : issue === "PAST" ? ts.rangePast : issue === "TOO_LONG" ? (kind === "special" ? ts.rangeTooLongSpecial : ts.rangeTooLong) : ts.dateRequired,
      );
      return;
    }
    const segs = normalizeSegments(segments);
    if (kind === "special") {
      if (!segs.length) return setError(ts.specialNeedsHours);
      const segIssue = validateSegments(segs);
      if (segIssue) return setError(segmentIssueMessage(t, segIssue));
    }
    setSaving(true);
    setError(null);
    try {
      const notes = { note_en: noteEn.trim() || null, note_ar: noteAr.trim() || null };
      if (kind === "closed") {
        const { error: e } = await supabase.from("closed_periods").insert({ shop_id: shopId, start_date: start, end_date: end, ...notes });
        if (e) throw e;
        setLastChange({ type: "closure", start, end });
        toast.success(ts.closureSaved);
      } else {
        const dates = eachDateInRange(start, end);
        const rows = dates.map((date) => ({ shop_id: shopId, date, is_closed: false, segments: segs, ...notes }));
        const { error: e } = await supabase.from("special_hours").upsert(rows, { onConflict: "shop_id,date" });
        if (e) throw e;
        setLastChange({ type: "special_hours", dates, segments: segs });
        toast.success(interpolate(ts.specialSaved, { count: dates.length }));
      }
      list.refetch();
    } catch (err) {
      setError(dbErrorMessage(t, err, ts.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    const res =
      toDelete.type === "closed"
        ? await supabase.from("closed_periods").delete().in("id", toDelete.ids)
        : await supabase.from("special_hours").delete().in("id", toDelete.group.ids);
    if (res.error) throw new Error(dbErrorMessage(t, res.error, ts.deleteFailed));
    toast.success(ts.exceptionDeleted);
    list.refetch();
  }

  const day = (d: string) => formatDate(`${d}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const range = (a: string, b: string) => (a === b ? day(a) : `${day(a)} – ${day(b)}`);
  const hijriRangeLabel = (a: string, b: string) =>
    a === b ? formatHijri(a, locale) : `${formatHijri(a, locale, { withYear: false })} – ${formatHijri(b, locale)}`;
  const note = (en_: string | null, ar_: string | null) => (locale === "ar" ? ar_ || en_ : en_ || ar_);
  const entryLabel = (e: ListEntry) => (e.type === "closed" ? range(e.start, e.end) : range(e.group.start, e.group.end));

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hijri presets ── */}
      <section aria-labelledby="hp-title" className={card}>
        <div className="flex items-start gap-3">
          <Moon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
          <div>
            <h2 id="hp-title" className={h2}>
              {ts.presetsTitle}
            </h2>
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">{ts.presetsHelp}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div className="flex flex-col gap-1">
            <label htmlFor="hp-preset" className="field-label">
              {ts.preset}
            </label>
            <select
              id="hp-preset"
              value={presetId}
              onChange={(e) => {
                const id = e.target.value as HijriPresetId;
                setPresetId(id);
                setPresetYear(upcomingHijriYear(id, today));
              }}
              className="field-input"
            >
              {HIJRI_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {presetName(p.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hp-year" className="field-label">
              {ts.hijriYear}
            </label>
            <input
              id="hp-year"
              type="number"
              inputMode="numeric"
              min={1440}
              max={1500}
              value={presetYear}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (Number.isInteger(y) && y >= 1440 && y <= 1500) setPresetYear(y);
              }}
              className="field-input tabular-nums"
              dir="ltr"
            />
          </div>
        </div>
        {preset ? (
          <div className="flex flex-col gap-3 rounded-xl bg-[var(--bg-secondary)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">
                {range(preset.start, preset.end)} · {interpolate(ts.daysCount, { count: preset.days })}
              </p>
              <p className="m-0 text-[12px] text-[var(--text-muted)]">{hijriRangeLabel(preset.start, preset.end)}</p>
              <p className="m-0 mt-1 text-[12px] text-[var(--text-secondary)]">
                {preset.kind === "closed" ? ts.presetClosed : `${ts.presetSpecial} `}
                {preset.kind === "special" && <span dir="ltr">{segmentsLabel(preset.segments)}</span>}
              </p>
            </div>
            <button type="button" className="btn btn-secondary min-h-11 shrink-0" onClick={applyPreset}>
              {ts.usePreset}
            </button>
          </div>
        ) : (
          <p role="alert" className="field-error m-0">
            {ts.hijriInvalid}
          </p>
        )}
        <p className="m-0 text-[12px] text-[var(--text-muted)]">{ts.moonSightingNote}</p>
      </section>

      {/* ── New exception ── */}
      <section id="hours-form" aria-labelledby="hf-title" className={card}>
        <h2 id="hf-title" className={h2}>
          {ts.newException}
        </h2>

        <div role="radiogroup" aria-label={ts.exceptionType} className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "closed", label: ts.typeClosed, icon: CalendarX2 },
              { id: "special", label: ts.typeSpecial, icon: Clock },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={kind === o.id}
              onClick={() => setKind(o.id)}
              disabled={saving}
              className={cn(
                "focus-ring flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                kind === o.id
                  ? "border-[var(--text-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-primary)]",
              )}
            >
              <o.icon size={16} aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span id="hf-cal" className="text-[13px] font-semibold text-[var(--text-secondary)]">
            {ts.calendar}
          </span>
          <div role="radiogroup" aria-labelledby="hf-cal" className="inline-flex rounded-lg bg-[var(--bg-secondary)] p-1">
            {(["gregorian", "hijri"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={calendar === c}
                onClick={() => setCalendar(c)}
                className={cn(
                  "focus-ring min-h-9 rounded-md px-3 text-sm font-medium",
                  calendar === c ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)]",
                )}
              >
                {c === "gregorian" ? ts.calendarGregorian : ts.calendarHijri}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2" disabled={saving}>
          <legend className="sr-only">{ts.dates}</legend>
          <HijriDateField
            label={ts.startDate}
            value={start}
            min={today}
            calendar={calendar}
            onChange={(v) => {
              setStart(v);
              if (end < v) setEnd(v);
            }}
          />
          <HijriDateField label={ts.endDate} value={end} min={start || today} calendar={calendar} onChange={setEnd} invalid={!!end && end < start} />
        </fieldset>

        {kind === "special" && (
          <div className="flex flex-col gap-2">
            <span className="field-label">{ts.specialHoursLabel}</span>
            <SegmentsEditor value={segments} onChange={setSegments} label={ts.specialHoursLabel} emptyLabel={ts.specialNeedsHours} disabled={saving} />
          </div>
        )}

        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2" disabled={saving}>
          <legend className="sr-only">{ts.notes}</legend>
          <div className="flex flex-col gap-1">
            <label htmlFor="hf-note-ar" className="field-label">
              {ts.noteAr}
            </label>
            <input id="hf-note-ar" dir="rtl" lang="ar" value={noteAr} maxLength={200} onChange={(e) => setNoteAr(e.target.value)} className="field-input" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hf-note-en" className="field-label">
              {ts.noteEn}
            </label>
            <input id="hf-note-en" dir="ltr" lang="en" value={noteEn} maxLength={200} onChange={(e) => setNoteEn(e.target.value)} className="field-input" />
          </div>
        </fieldset>
        <p className="m-0 text-[12px] text-[var(--text-muted)]">{ts.notesHelp}</p>

        {error && (
          <p role="alert" className="field-error m-0">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary w-full sm:w-fit" onClick={() => void save()} disabled={saving} aria-busy={saving || undefined}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {saving ? t.common.processing : kind === "closed" ? ts.saveClosure : ts.saveSpecial}
        </button>
      </section>

      {lastChange && <AffectedAppointments change={lastChange} />}

      {/* ── Upcoming ── */}
      <section aria-labelledby="hu-title" className={card}>
        <h2 id="hu-title" className={h2}>
          {ts.upcomingExceptions}
        </h2>
        {list.initialLoading ? (
          <ListSkeleton rows={3} />
        ) : list.error ? (
          <EmptyState size="sm" tone="error" icon={AlertCircle} title={ts.loadFailed} action={{ label: t.common.retry, onClick: list.refetch }} />
        ) : !list.data?.length ? (
          <EmptyState size="sm" icon={CalendarDays} title={ts.noExceptions} description={ts.noExceptionsHint} />
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
            {list.data.map((e) => {
              const closed = e.type === "closed" || e.group.isClosed;
              const a = e.type === "closed" ? e.start : e.group.start;
              const b = e.type === "closed" ? e.end : e.group.end;
              const n = e.type === "closed" ? note(e.noteEn, e.noteAr) : note(e.group.noteEn, e.group.noteAr);
              return (
                <li key={e.key} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{range(a, b)}</span>
                      <Pill tone={closed ? "danger" : "neutral"} size="sm" icon={closed ? <CalendarX2 size={12} aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />}>
                        {closed ? ts.typeClosed : ts.typeSpecial}
                      </Pill>
                    </div>
                    <span className="block text-[12px] text-[var(--text-muted)]">{hijriRangeLabel(a, b)}</span>
                    {e.type === "special" && !e.group.isClosed && (
                      <span className="block text-[12px] text-[var(--text-secondary)]" dir="ltr">
                        {segmentsLabel(e.group.segments)}
                      </span>
                    )}
                    {n && <span className="block truncate text-[12px] text-[var(--text-secondary)]">{n}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setToDelete(e)}
                    aria-label={interpolate(ts.deleteExceptionFor, { range: entryLabel(e) })}
                    className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-rose)]"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── What clients see ── */}
      {shopId && (
        <section aria-labelledby="hb-title" className={card}>
          <h2 id="hb-title" className={h2}>
            {ts.bannerPreview}
          </h2>
          <p className="m-0 text-sm text-[var(--text-secondary)]">{ts.bannerPreviewHelp}</p>
          <ClosureBanner key={list.data?.length ?? 0} shopId={shopId} timezone={tz} />
        </section>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title={ts.deleteExceptionTitle}
        description={toDelete ? `${entryLabel(toDelete)} · ${ts.deleteExceptionHint}` : undefined}
        confirmLabel={t.common.delete}
        destructive
      />
    </div>
  );
}
