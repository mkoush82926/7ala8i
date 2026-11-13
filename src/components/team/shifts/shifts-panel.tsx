"use client";

import React, { useId, useRef, useState } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { WeeklyHoursPanel } from "./weekly-hours-panel";
import { DateOverridesPanel } from "./date-overrides-panel";
import { TimeOffPanel } from "./time-off-panel";
import type { ShiftMember } from "./shared";

type ShiftTab = "weekly" | "dates" | "timeoff";

/**
 * The "Hours" tab of a team member: weekly schedule, per-date overrides
 * (multi-segment, day off) and time off. Mounted by the team page's member
 * settings dialog.
 */
export function ShiftsPanel({
  member,
  onBusy,
  onSaved,
  onCancel,
}: {
  member: ShiftMember;
  onBusy: (b: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t, isRTL } = useTranslation();
  const [tab, setTab] = useState<ShiftTab>("weekly");
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs: { id: ShiftTab; label: string }[] = [
    { id: "weekly", label: t.shifts.tabWeekly },
    { id: "dates", label: t.shifts.tabDates },
    { id: "timeoff", label: t.shifts.tabTimeOff },
  ];

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const fwd = isRTL ? "ArrowLeft" : "ArrowRight";
    const back = isRTL ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (e.key === fwd) next = (i + 1) % tabs.length;
    else if (e.key === back) next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t.shifts.title} className="inline-flex w-full gap-1 rounded-xl bg-[var(--bg-secondary)] p-1 sm:w-fit">
        {tabs.map((tb, i) => (
          <button
            key={tb.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${baseId}-${tb.id}`}
            role="tab"
            type="button"
            aria-selected={tab === tb.id}
            aria-controls={`${baseId}-${tb.id}-panel`}
            tabIndex={tab === tb.id ? 0 : -1}
            onClick={() => setTab(tb.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "focus-ring min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors sm:flex-none",
              tab === tb.id
                ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${baseId}-${tab}-panel`} aria-labelledby={`${baseId}-${tab}`}>
        {tab === "weekly" ? (
          <WeeklyHoursPanel member={member} onBusy={onBusy} onSaved={onSaved} onCancel={onCancel} />
        ) : tab === "dates" ? (
          <DateOverridesPanel member={member} onBusy={onBusy} />
        ) : (
          <TimeOffPanel member={member} onBusy={onBusy} />
        )}
      </div>
    </div>
  );
}
