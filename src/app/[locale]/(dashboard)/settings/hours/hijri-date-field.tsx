"use client";

import React, { useId, useMemo, useState } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { formatHijri, fromHijri, hijriMonthNames, isHijriSupported, toHijri } from "@/lib/hijri";
import { cn } from "@/lib/utils";

const selectCls =
  "h-11 min-w-0 rounded-lg border border-line-strong bg-card px-2 text-sm text-ink outline-none focus-visible:border-brand";

/**
 * A date the owner can enter on the Gregorian or the Hijri (Umm al-Qura)
 * calendar. The value is always Gregorian "YYYY-MM-DD"; the other calendar is
 * shown underneath so both are visible before saving.
 */
export function HijriDateField({
  label,
  value,
  onChange,
  min,
  calendar,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  calendar: "gregorian" | "hijri";
  invalid?: boolean;
}) {
  const { t, locale, formatDate } = useTranslation();
  const id = useId();
  const months = useMemo(() => hijriMonthNames(locale), [locale]);
  const supported = useMemo(() => isHijriSupported(), []);
  const h = useMemo(() => (value ? toHijri(value) : null), [value]);
  const [missing, setMissing] = useState(false);

  const setHijri = (patch: Partial<{ year: number; month: number; day: number }>) => {
    const base = h ?? toHijri(min ?? new Date().toISOString().slice(0, 10));
    const next = { ...base, ...patch };
    let iso = fromHijri(next.year, next.month, next.day);
    // Day 30 of a 29-day month: clamp to the 29th.
    if (!iso && next.day === 30) iso = fromHijri(next.year, next.month, 29);
    setMissing(!iso);
    if (iso) onChange(iso);
  };

  const useHijri = calendar === "hijri" && supported;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span id={`${id}-l`} className="field-label">
        {label}
      </span>
      {useHijri ? (
        <div role="group" aria-labelledby={`${id}-l`} className="grid grid-cols-[4.5rem_1fr_5.5rem] gap-2">
          <select
            aria-label={t.shifts.hijriDay}
            value={h?.day ?? ""}
            onChange={(e) => setHijri({ day: Number(e.target.value) })}
            className={selectCls}
          >
            {Array.from({ length: 30 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <select
            aria-label={t.shifts.hijriMonth}
            value={h?.month ?? ""}
            onChange={(e) => setHijri({ month: Number(e.target.value) })}
            className={selectCls}
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={1440}
            max={1500}
            aria-label={t.shifts.hijriYear}
            value={h?.year ?? ""}
            onChange={(e) => {
              const y = Number(e.target.value);
              if (Number.isInteger(y) && y >= 1440 && y <= 1500) setHijri({ year: y });
            }}
            className={cn(selectCls, "tabular-nums")}
            dir="ltr"
          />
        </div>
      ) : (
        <input
          id={`${id}-g`}
          aria-labelledby={`${id}-l`}
          type="date"
          min={min}
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="field-input"
        />
      )}
      {value && (
        <span className="text-[12px] text-ink-muted">
          {useHijri
            ? formatDate(`${value}T12:00:00Z`, { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
            : formatHijri(value, locale)}
        </span>
      )}
      {missing && (
        <span role="alert" className="text-[12px] text-danger-text">
          {t.shifts.hijriInvalid}
        </span>
      )}
    </div>
  );
}
