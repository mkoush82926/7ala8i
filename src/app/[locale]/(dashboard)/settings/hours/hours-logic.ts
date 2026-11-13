// Pure helpers for the shop-wide hours page (WS-1F): closures, special hours
// and Hijri presets. Dates are shop-local "YYYY-MM-DD".

import { addDaysIso, daysBetweenInclusive, resolveHijriPreset, type HijriPresetId } from "@/lib/hijri";
import { parseSegments, type Segment } from "@/components/team/shifts/schedule-logic";

export type ExceptionKind = "closed" | "special";

/** Special hours are one row per date; this caps a single save. */
export const MAX_SPECIAL_DAYS = 62;
/** closed_periods_max_span: end - start <= 366. */
export const MAX_CLOSURE_DAYS = 367;

export type RangeIssue = "MISSING" | "ORDER" | "PAST" | "TOO_LONG";

export function validateRange(start: string, end: string, kind: ExceptionKind, today: string): RangeIssue | null {
  if (!start || !end) return "MISSING";
  if (end < start) return "ORDER";
  if (end < today) return "PAST";
  const days = daysBetweenInclusive(start, end);
  if (days > (kind === "special" ? MAX_SPECIAL_DAYS : MAX_CLOSURE_DAYS)) return "TOO_LONG";
  return null;
}

/** What a preset usually means, with sensible default hours. */
export function presetDefaults(id: HijriPresetId): { kind: ExceptionKind; segments: Segment[] } {
  switch (id) {
    case "ramadan":
      // Day shift, then the busy night after taraweeh (crosses midnight).
      return { kind: "special", segments: [{ start: "11:00", end: "16:00" }, { start: "20:30", end: "01:30" }] };
    case "arafah":
      return { kind: "special", segments: [{ start: "09:00", end: "15:00" }] };
    default:
      return { kind: "closed", segments: [] };
  }
}

/** Preset resolved for a Hijri year, with its default kind and hours. */
export function resolvePreset(id: HijriPresetId, hijriYear: number) {
  const range = resolveHijriPreset(id, hijriYear);
  return range ? { ...range, ...presetDefaults(id) } : null;
}

export interface SpecialRow {
  id: string;
  date: string;
  is_closed: boolean;
  segments: unknown;
  note_en: string | null;
  note_ar: string | null;
}

export interface SpecialGroup {
  ids: string[];
  start: string;
  end: string;
  isClosed: boolean;
  segments: Segment[];
  noteEn: string | null;
  noteAr: string | null;
}

/** Consecutive dates with the same hours and notes → one range. */
export function groupSpecialRows(rows: SpecialRow[]): SpecialGroup[] {
  const out: SpecialGroup[] = [];
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const segments = parseSegments(r.segments);
    const isClosed = r.is_closed || segments.length === 0;
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.isClosed === isClosed &&
      prev.noteEn === (r.note_en ?? null) &&
      prev.noteAr === (r.note_ar ?? null) &&
      addDaysIso(prev.end, 1) === r.date &&
      JSON.stringify(prev.segments) === JSON.stringify(segments)
    ) {
      prev.end = r.date;
      prev.ids.push(r.id);
    } else {
      out.push({ ids: [r.id], start: r.date, end: r.date, isClosed, segments, noteEn: r.note_en ?? null, noteAr: r.note_ar ?? null });
    }
  }
  return out;
}

/** "11:00–16:00 · 20:30–01:30" */
export function segmentsLabel(segments: Segment[]): string {
  return segments.map((s) => `${s.start}–${s.end === "24:00" ? "00:00" : s.end}`).join(" · ");
}
