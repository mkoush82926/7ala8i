"use client";

import { useId, useMemo } from "react";
import { AlertCircle, ChevronDown, Coffee, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { FilterChip } from "@/components/ui/pill";
import { buttonClasses, errorTextClasses, labelClasses, selectClasses } from "@/components/ui/recipes";
import {
  HOURS_PRESETS,
  JUMUAH_BREAK,
  FRIDAY,
  MIDNIGHT_CLOSE,
  hoursPreset,
  timeOptions,
  type DayHours,
  type HoursPresetId,
} from "@/lib/templates/barbershop";
import type { StepProps } from "./step-shop";
import { StepHeader, Switch, cardClass } from "./ui";

const TIMES = timeOptions(30);
/** Closing times also offer "midnight" (stored as 23:59: weekly hours cannot cross midnight). */
const END_TIMES = [...TIMES, MIDNIGHT_CLOSE];

function samePreset(a: DayHours[], b: DayHours[]): boolean {
  return a.length === b.length && a.every((h, i) => JSON.stringify(h) === JSON.stringify(b[i]));
}

export function StepHours({ draft, update, errors }: StepProps) {
  const { t, intlLocale, formatTime } = useTranslation();
  const s = t.start;

  const dayName = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: "UTC" });
    // 2024-01-07 was a Sunday (day 0).
    return (d: number) => fmt.format(new Date(Date.UTC(2024, 0, 7 + d)));
  }, [intlLocale]);

  const activePreset = HOURS_PRESETS.find((id) => samePreset(hoursPreset(id), draft.hours)) ?? null;
  const hoursError = errors.hours ? s.errors[errors.hours as keyof typeof s.errors] : null;

  function setDay(day: number, patch: Partial<DayHours>) {
    update((d) => ({ ...d, hours: d.hours.map((h) => (h.day === day ? { ...h, ...patch } : h)) }));
  }

  function copyToAll(src: DayHours) {
    update((d) => ({
      ...d,
      hours: d.hours.map((h) => (h.day === src.day ? h : { ...h, open: src.open, start: src.start, end: src.end })),
    }));
  }

  const presetLabel: Record<HoursPresetId, string> = {
    standard: s.hours.presetStandard,
    jumuahBreak: s.hours.presetJumuah,
    fridayAfternoon: s.hours.presetFridayAfternoon,
    fridayOff: s.hours.presetFridayOff,
  };

  return (
    <div>
      <StepHeader title={s.hours.title} subtitle={s.hours.subtitle} />
      <fieldset className="mb-6">
        <legend className={labelClasses}>{s.hours.presetsLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {HOURS_PRESETS.map((id) => (
            <FilterChip
              key={id}
              pressed={activePreset === id}
              onClick={() => update((d) => ({ ...d, hours: hoursPreset(id) }))}
              className="h-10"
            >
              {presetLabel[id]}
            </FilterChip>
          ))}
        </div>
      </fieldset>
      {hoursError && (
        <p className={cn(errorTextClasses, "mb-3 mt-0")} role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{hoursError}</span>
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {draft.hours.map((h, i) => (
          <DayRow
            key={h.day}
            hours={h}
            name={dayName(h.day)}
            isFirst={i === 0}
            error={errors[`day.${h.day}`] ? s.hours.errors[errors[`day.${h.day}`] as keyof typeof s.hours.errors] : null}
            onChange={(p) => setDay(h.day, p)}
            onCopyToAll={() => copyToAll(h)}
            formatTime={formatTime}
          />
        ))}
      </ul>
    </div>
  );
}

function DayRow({
  hours: h,
  name,
  isFirst,
  error,
  onChange,
  onCopyToAll,
  formatTime,
}: {
  hours: DayHours;
  name: string;
  isFirst: boolean;
  error: string | null;
  onChange: (p: Partial<DayHours>) => void;
  onCopyToAll: () => void;
  formatTime: (v: string) => string;
}) {
  const { t } = useTranslation();
  const s = t.start;
  const uid = useId();
  const hasBreak = !!(h.breakStart && h.breakEnd);

  const timeSelect = (id: string, label: string, value: string, set: (v: string) => void, options: string[] = TIMES) => (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <select id={id} className={selectClasses({ className: "h-11 pe-9 ps-3 tabular-nums" })} value={value} onChange={(e) => set(e.target.value)}>
          {(options.includes(value) ? options : [...options, value].sort()).map((v) => (
            <option key={v} value={v}>
              {v === MIDNIGHT_CLOSE ? s.hours.midnight : formatTime(v)}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      </div>
    </div>
  );

  return (
    <li className={cn(cardClass, "p-4", error && "border-danger", !h.open && "bg-sunken/60")}>
      <Switch
        checked={h.open}
        onChange={(open) => onChange({ open })}
        label={name}
        description={h.open ? undefined : s.hours.closed}
      />
      {h.open && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {timeSelect(`${uid}-s`, `${name} ${s.hours.opens}`, h.start, (v) => onChange({ start: v }))}
            <span aria-hidden className="text-ink-muted">
              –
            </span>
            {timeSelect(`${uid}-e`, `${name} ${s.hours.closes}`, h.end, (v) => onChange({ end: v }), END_TIMES)}
          </div>
          {hasBreak ? (
            <div className="flex items-center gap-2">
              <Coffee size={16} aria-hidden className="shrink-0 text-ink-muted" />
              {timeSelect(`${uid}-bs`, `${name} ${s.hours.breakStarts}`, h.breakStart as string, (v) => onChange({ breakStart: v }))}
              <span aria-hidden className="text-ink-muted">
                –
              </span>
              {timeSelect(`${uid}-be`, `${name} ${s.hours.breakEnds}`, h.breakEnd as string, (v) => onChange({ breakEnd: v }))}
              <button
                type="button"
                onClick={() => onChange({ breakStart: null, breakEnd: null })}
                aria-label={`${s.hours.removeBreak} · ${name}`}
                className={buttonClasses({ variant: "ghost", size: "icon", className: "shrink-0" })}
              >
                <X aria-hidden />
              </button>
            </div>
          ) : (
            <div className="-ms-3.5 flex flex-wrap gap-x-1 gap-y-1">
              <button
                type="button"
                onClick={() =>
                  onChange(
                    h.day === FRIDAY
                      ? { breakStart: JUMUAH_BREAK.start, breakEnd: JUMUAH_BREAK.end }
                      : { breakStart: "14:00", breakEnd: "15:00" },
                  )
                }
                className={buttonClasses({ variant: "ghost", size: "sm", className: "text-brand-text" })}
              >
                <Coffee aria-hidden />
                {h.day === FRIDAY ? s.hours.addJumuahBreak : s.hours.addBreak}
              </button>
              {isFirst && (
                <button
                  type="button"
                  onClick={onCopyToAll}
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  <Copy aria-hidden />
                  {s.hours.copyToAll}
                </button>
              )}
            </div>
          )}
          {error && (
            <p className={cn(errorTextClasses, "mt-0")} role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}
