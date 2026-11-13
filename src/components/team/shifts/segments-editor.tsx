"use client";

import React from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { MAX_SEGMENTS, segmentRange, type Segment } from "./schedule-logic";

export const timeInputClass =
  "h-11 w-full min-w-0 rounded-[var(--radius-inputs)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 text-center text-sm text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent-brass)] sm:w-28 disabled:opacity-50";

export const sectionCard = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 sm:p-5";
export const sectionTitleClass = "m-0 text-base font-bold text-[var(--text-primary)]";

/**
 * Edits a list of working segments ("09:00–13:00", "16:00–22:00"). An empty
 * list means "off". A segment whose end is before its start runs past
 * midnight (Ramadan nights), and is labelled as such.
 */
export function SegmentsEditor({
  value,
  onChange,
  disabled,
  label,
  emptyLabel,
}: {
  value: Segment[];
  onChange: (next: Segment[]) => void;
  disabled?: boolean;
  /** Accessible group label, e.g. the date. */
  label: string;
  /** Shown when there are no segments (e.g. "Day off" / "Closed"). */
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  const update = (i: number, patch: Partial<Segment>) => onChange(value.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const add = () => {
    const last = value[value.length - 1];
    const startMin = last ? Math.min(segmentRange(last)[1] % 1440 + 60, 22 * 60) : 9 * 60;
    const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    onChange([...value, { start: hh(startMin), end: hh(Math.min(startMin + 180, 23 * 60 + 59)) }]);
  };

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {value.length === 0 && <p className="m-0 text-sm text-[var(--text-muted)]">{emptyLabel}</p>}
      {value.map((seg, i) => {
        const overnight = segmentRange(seg)[1] > 1440;
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              value={seg.start}
              aria-label={`${label} — ${t.shifts.segmentStart} ${i + 1}`}
              onChange={(e) => e.target.value && update(i, { start: e.target.value })}
              className={timeInputClass}
            />
            <span aria-hidden="true" className="text-[var(--text-muted)]">–</span>
            <input
              type="time"
              value={seg.end === "24:00" ? "00:00" : seg.end}
              aria-label={`${label} — ${t.shifts.segmentEnd} ${i + 1}`}
              onChange={(e) => e.target.value && update(i, { end: e.target.value })}
              className={timeInputClass}
            />
            {overnight && (
              <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]">
                {t.shifts.overnight}
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, n) => n !== i))}
              aria-label={`${t.shifts.removeSegment} ${i + 1}`}
              className="focus-ring inline-flex size-11 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-rose)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {value.length < MAX_SEGMENTS && (
        <button
          type="button"
          onClick={add}
          className={cn(
            "focus-ring inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]",
          )}
        >
          <Plus size={16} aria-hidden="true" />
          {t.shifts.addSegment}
        </button>
      )}
    </fieldset>
  );
}

/** Localised message for a SegmentIssue. */
export function segmentIssueMessage(t: ReturnType<typeof useTranslation>["t"], issue: string): string {
  if (issue === "OVERLAP") return t.shifts.segmentsOverlap;
  if (issue === "TOO_MANY") return t.shifts.segmentsTooMany;
  return t.shifts.segmentsInvalid;
}
