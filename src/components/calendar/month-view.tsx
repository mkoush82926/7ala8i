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

const DENSITY = [
  "bg-transparent",
  "bg-[var(--accent-brass)]/15",
  "bg-[var(--accent-brass)]/30",
  "bg-[var(--accent-brass)]/50",
  "bg-[var(--accent-brass)]/75",
] as const;

/** Month density: booking count per day, shaded relative to the busiest day. */
export function MonthView({ days, month, appointments, now, showHijri, onOpenDay }: MonthViewProps) {
  const { t, locale, formatDate, formatNumber } = useTranslation();
  const counts = useMemo(() => countByDay(appointments), [appointments]);
  const max = Math.max(0, ...Array.from(counts.values()));
  const today = isoDay(now);
  const weekdays = days.slice(0, 7);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]" aria-hidden="true">
        {weekdays.map((d) => (
          <div key={d} className="px-1 py-2 text-center text-[11px] font-medium text-[var(--text-muted)]">
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
            <li key={day} className="border-b border-s border-[var(--border-subtle)] first:border-s-0 [&:nth-child(7n+1)]:border-s-0">
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                aria-label={label}
                className={cn(
                  "flex h-[72px] w-full flex-col items-start justify-between p-1.5 text-start transition-colors hover:bg-[var(--bg-secondary)] sm:h-[92px] sm:p-2",
                  !inMonth && "opacity-45",
                )}
              >
                <span className="flex w-full items-baseline justify-between gap-1">
                  <span
                    className={cn(
                      "text-[13px] tabular-nums",
                      day === today
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)]"
                        : "text-[var(--text-primary)]",
                    )}
                  >
                    {formatNumber(date.getDate())}
                  </span>
                  {showHijri && (
                    <span className="hidden truncate text-[10px] text-[var(--text-muted)] sm:inline">
                      {formatHijri(day, locale, { withYear: false })}
                    </span>
                  )}
                </span>
                {count > 0 && (
                  <span className="flex w-full items-center gap-1.5">
                    <span className={cn("h-1.5 flex-1 rounded-full", DENSITY[level])} aria-hidden="true" />
                    <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">{formatNumber(count)}</span>
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
