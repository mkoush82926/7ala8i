"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { formatHijri } from "@/lib/hijri";
import type { CalendarAppointment } from "@/hooks/use-appointments";
import { countByDay, densityLevel, fromIsoDay, isoDay } from "./calendar-model";

interface MonthViewProps {
  days: string[];
  month: number; // 0-11 of the anchor
  appointments: CalendarAppointment[];
  now: Date;
  showHijri: boolean;
  onOpenDay: (day: string) => void;
}

/** Density ramp in brand teal (bar fill), plus a faint wash on the busiest cells. */
const DENSITY = ["bg-transparent", "bg-brand/25", "bg-brand/45", "bg-brand/70", "bg-brand"] as const;
const CELL_WASH = ["", "", "", "bg-brand-soft/40", "bg-brand-soft/70"] as const;

/** Month density: booking count per day, shaded relative to the busiest day. */
export function MonthView({ days, month, appointments, now, showHijri, onOpenDay }: MonthViewProps) {
  const { t, locale, formatDate, formatNumber } = useTranslation();
  const counts = useMemo(() => countByDay(appointments), [appointments]);
  const max = Math.max(0, ...Array.from(counts.values()));
  const today = isoDay(now);
  const weekdays = days.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="grid grid-cols-7 border-b border-line bg-sunken/60" aria-hidden="true">
        {weekdays.map((d) => (
          <div key={d} className="px-1 py-2.5 text-center text-xs font-semibold text-ink-muted">
            {formatDate(fromIsoDay(d), { weekday: "short" })}
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-7" aria-label={t.calendar.monthDensity}>
        {days.map((day) => {
          const date = fromIsoDay(day);
          const count = counts.get(day) ?? 0;
          const level = densityLevel(count, max);
          const inMonth = date.getMonth() === month;
          const label = interpolate(t.calendar.dayBookings, {
            date: formatDate(date, "long"),
            count: formatNumber(count),
          });
          return (
            <li key={day} className="border-b border-s border-line first:border-s-0 [&:nth-child(7n+1)]:border-s-0 [&:nth-last-child(-n+7)]:border-b-0">
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                aria-label={label}
                className={cn(
                  "flex h-[76px] w-full flex-col items-start justify-between p-1.5 text-start transition-colors duration-150 hover:bg-sunken focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus motion-reduce:transition-none sm:h-28 sm:p-2.5",
                  CELL_WASH[level],
                  !inMonth && "bg-sunken/40 opacity-50",
                )}
              >
                <span className="flex w-full items-baseline justify-between gap-1">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                      day === today ? "bg-brand text-on-brand" : "text-ink",
                    )}
                  >
                    {formatNumber(date.getDate())}
                  </span>
                  {showHijri && (
                    <span className="hidden truncate text-[11px] text-ink-muted sm:inline">
                      {formatHijri(day, locale, { withYear: false })}
                    </span>
                  )}
                </span>
                {count > 0 && (
                  <span className="flex w-full items-center gap-1.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                      <span className={cn("block h-full rounded-full", DENSITY[level])} style={{ width: `${level * 25}%` }} />
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-ink-soft">{formatNumber(count)}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
