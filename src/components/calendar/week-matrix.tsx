"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import type { CalendarAppointment } from "@/hooks/use-appointments";
import type { BlockedTimeRow } from "@/lib/queries/appointments";
import { UNASSIGNED_KEY, bucketByLaneDay, fromIsoDay, isMovable, isoDay, moveBy, type MoveTarget } from "./calendar-model";
import { LaneAvatar, type GridLane, type SlotRequest } from "./time-grid";
import { StatusIcon } from "./status-pill";

interface WeekMatrixProps {
  days: string[];
  lanes: GridLane[];
  appointments: CalendarAppointment[];
  blocks: BlockedTimeRow[];
  colorFor: (a: CalendarAppointment) => string;
  now: Date;
  canEdit: (a: CalendarAppointment) => boolean;
  isWorking: (barberId: string | null, day: string) => boolean;
  onOpen: (a: CalendarAppointment) => void;
  onSlot: (req: SlotRequest) => void;
  onMove: (a: CalendarAppointment, target: MoveTarget, kind: "move") => void;
  onOpenDay: (day: string) => void;
}

const MAX_CHIPS = 4;
const DAY_MS = 86_400_000;

/**
 * Week as a staff × days grid. One bucketing pass (O(n)) and plain DOM keep
 * 6 barbers × 7 days well under 200 ms. Chips can be dragged to another
 * barber/day (time of day is kept); the time grid handles exact times.
 */
export function WeekMatrix({
  days,
  lanes,
  appointments,
  blocks,
  colorFor,
  now,
  canEdit,
  isWorking,
  onOpen,
  onSlot,
  onMove,
  onOpenDay,
}: WeekMatrixProps) {
  const { t, formatDate, formatTime, formatNumber } = useTranslation();
  const buckets = useMemo(() => bucketByLaneDay(appointments), [appointments]);
  const blockCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of blocks) {
      const day = isoDay(new Date(b.start_time));
      const key = `${b.barber_id ?? "*"}|${day}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [blocks]);
  const today = isoDay(now);

  // Pointer drag of a chip to another cell.
  const [drag, setDrag] = useState<{ id: string; pointerId: number; x: number; y: number; active: boolean; cell: string | null } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppress = useRef(false);
  const byId = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (!d.active) {
        if (e.pointerType === "mouse" && dist > 4) d.active = true;
        else if (e.pointerType !== "mouse" && dist > 8) {
          if (timer.current) clearTimeout(timer.current);
          setDrag(null);
          return;
        } else return;
      }
      const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]")?.dataset.cell ?? null;
      setDrag({ ...d, cell });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (timer.current) clearTimeout(timer.current);
      setDrag(null);
      if (!d || d.pointerId !== e.pointerId || !d.active || !d.cell || e.type !== "pointerup") return;
      suppress.current = true;
      const a = byId.get(d.id);
      if (!a) return;
      const [laneKey, day] = d.cell.split("|");
      const barberId = laneKey === UNASSIGNED_KEY ? null : laneKey;
      const shift = Math.round((fromIsoDay(day).getTime() - fromIsoDay(isoDay(new Date(a.startTime))).getTime()) / DAY_MS);
      if (shift === 0 && barberId === a.barberId) return;
      onMove(a, moveBy(a, 0, { barberId, dayShift: shift }), "move");
    };
    const touch = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", touch, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", touch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, byId, onMove]);

  const laneKeyOf = (lane: GridLane) => lane.barberId ?? UNASSIGNED_KEY;

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <table className="w-full min-w-[840px] table-fixed border-collapse">
        <caption className="sr-only">{t.calendar.weekGridCaption}</caption>
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th scope="col" className="sticky start-0 z-10 w-36 bg-[var(--bg-primary)] p-2 text-start text-[12px] font-medium text-[var(--text-muted)]">
              {t.calendar.barber}
            </th>
            {days.map((day) => (
              <th key={day} scope="col" className="border-s border-[var(--border-subtle)] p-0">
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className={cn(
                    "w-full px-2 py-2 text-center text-[12px] font-medium hover:bg-[var(--bg-secondary)]",
                    day === today ? "text-[var(--accent-text)]" : "text-[var(--text-secondary)]",
                  )}
                >
                  {formatDate(fromIsoDay(day), "weekdayDay")}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => (
            <tr key={lane.key} className="border-b border-[var(--border-subtle)] last:border-b-0">
              <th scope="row" className="sticky start-0 z-10 bg-[var(--bg-primary)] p-2 text-start align-top">
                <span className="flex items-center gap-2">
                  <LaneAvatar lane={lane} size={26} />
                  <span className="truncate text-[13px] font-normal text-[var(--text-secondary)]">{lane.name}</span>
                </span>
              </th>
              {days.map((day) => {
                const key = `${laneKeyOf(lane)}|${day}`;
                const items = buckets.get(key) ?? [];
                const working = isWorking(lane.barberId, day);
                const blocked = (blockCount.get(`${lane.barberId}|${day}`) ?? 0) + (lane.barberId ? blockCount.get(`*|${day}`) ?? 0 : 0);
                const isTarget = drag?.active && drag.cell === key;
                return (
                  <td
                    key={day}
                    data-cell={key}
                    className={cn(
                      "h-[112px] border-s border-[var(--border-subtle)] p-1 align-top",
                      !working && "bg-[var(--bg-secondary)]/70",
                      isTarget && "bg-[var(--accent-blue-muted)] outline outline-2 -outline-offset-2 outline-[var(--accent-brass)]",
                    )}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      onSlot({ day, barberId: lane.barberId, minutes: Math.max(minutesNow(now, day), 10 * 60), clientX: e.clientX, clientY: e.clientY });
                    }}
                  >
                    <ul className="space-y-1">
                      {items.slice(0, MAX_CHIPS).map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onPointerDown={(e) => {
                              if (e.button !== 0 || !canEdit(a) || !isMovable(a.status)) return;
                              suppress.current = false;
                              const state = { id: a.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false, cell: key };
                              setDrag(state);
                              if (e.pointerType !== "mouse") {
                                timer.current = setTimeout(() => {
                                  if (dragRef.current?.id === a.id) setDrag({ ...dragRef.current, active: true });
                                }, 350);
                              }
                            }}
                            onClick={() => {
                              if (suppress.current) {
                                suppress.current = false;
                                return;
                              }
                              onOpen(a);
                            }}
                            aria-haspopup="dialog"
                            className={cn(
                              "flex w-full min-w-0 select-none items-center gap-1 rounded-[4px] px-1.5 py-1 text-start text-[11px] leading-tight",
                              a.status === "cancelled" && "line-through opacity-60",
                              drag?.active && drag.id === a.id && "opacity-40",
                            )}
                            style={{ background: `${colorFor(a)}24`, borderInlineStart: `3px solid ${colorFor(a)}` }}
                          >
                            <StatusIcon status={a.status} size={10} />
                            <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{formatTime(a.startTime)}</span>
                            <span className="truncate text-[var(--text-primary)]">{a.clientName || t.calendar.walkIn}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {(items.length > MAX_CHIPS || blocked > 0) && (
                      <button
                        type="button"
                        onClick={() => onOpenDay(day)}
                        className="mt-1 w-full rounded px-1 text-start text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        {items.length > MAX_CHIPS
                          ? interpolate(t.calendar.moreCount, { count: formatNumber(items.length - MAX_CHIPS) })
                          : interpolate(t.calendar.blockedCount, { count: formatNumber(blocked) })}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function minutesNow(now: Date, day: string): number {
  if (isoDay(now) !== day) return 10 * 60;
  return Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
}
