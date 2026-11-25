"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import type { CalendarAppointment } from "@/hooks/use-appointments";
import type { BlockedTimeRow } from "@/lib/queries/appointments";
import { initialsOf, packTracks } from "./calendar-utils";
import {
  fromIsoDay,
  isMovable,
  isResizable,
  isoDay,
  keyboardMove,
  minutesOfDay,
  moveBy,
  resizeBy,
  verticalPlacement,
  type KeyboardMoveState,
  type MoveTarget,
} from "./calendar-model";
import { StatusIcon } from "./status-pill";

export interface GridLane {
  key: string;
  barberId: string | null;
  name: string;
  avatar?: string | null;
  color: string;
}

export interface SlotRequest {
  day: string;
  barberId: string | null;
  minutes: number;
  clientX: number;
  clientY: number;
}

interface Column {
  index: number;
  day: string;
  lane: GridLane;
}

interface TimeGridProps {
  days: string[];
  lanes: GridLane[];
  appointments: CalendarAppointment[];
  blocks: BlockedTimeRow[];
  range: { startHour: number; endHour: number };
  workRangesFor: (barberId: string | null, day: string) => [number, number][];
  colorFor: (a: CalendarAppointment) => string;
  serviceLabel: (a: CalendarAppointment) => string;
  blockLabel: (b: BlockedTimeRow) => string;
  now: Date;
  pxPerMinute?: number;
  canEdit: (a: CalendarAppointment) => boolean;
  onSlot: (req: SlotRequest) => void;
  onOpen: (a: CalendarAppointment) => void;
  onBlockOpen: (b: BlockedTimeRow) => void;
  onMove: (a: CalendarAppointment, target: MoveTarget, kind: "move" | "resize") => void;
  /** Keyboard move mode for this appointment id (arrow keys, Enter, Escape). */
  moveModeId: string | null;
  onMoveModeChange: (id: string | null) => void;
  /** Narrow screens: hide the lane header avatars row when a single lane is shown. */
  compact?: boolean;
}

type DragState = {
  id: string;
  kind: "move" | "resize";
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  originCol: number;
  active: boolean;
  deltaMin: number;
  targetCol: number;
};

const DAY_MS = 86_400_000;
const LONG_PRESS_MS = 350;

const dayDiff = (from: string, to: string) => Math.round((fromIsoDay(to).getTime() - fromIsoDay(from).getTime()) / DAY_MS);

/**
 * Vertical time grid: one column per (day × lane). Pointer drag (mouse
 * immediately, touch after a long press) moves across time, lanes and days;
 * the bottom edge resizes; "M" or Move in the details starts an arrow-key move
 * mode. Lanes are found with elementFromPoint, so RTL drags follow the
 * mirrored layout naturally.
 */
export function TimeGrid({
  days,
  lanes,
  appointments,
  blocks,
  range,
  workRangesFor,
  colorFor,
  serviceLabel,
  blockLabel,
  now,
  pxPerMinute = 1.2,
  canEdit,
  onSlot,
  onOpen,
  onBlockOpen,
  onMove,
  moveModeId,
  onMoveModeChange,
  compact,
}: TimeGridProps) {
  const { t, isRTL, formatTime, formatDate } = useTranslation();
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const [kbd, setKbd] = useState<KeyboardMoveState | null>(null);

  const columns = useMemo<Column[]>(
    () => days.flatMap((day, d) => lanes.map((lane, l) => ({ index: d * lanes.length + l, day, lane }))),
    [days, lanes],
  );
  const colIndexOf = useCallback(
    (day: string, barberId: string | null) =>
      columns.findIndex((c) => c.day === day && c.lane.barberId === barberId),
    [columns],
  );

  const minutesSpan = (range.endHour - range.startHour) * 60;
  const height = minutesSpan * pxPerMinute;
  const today = isoDay(now);

  // Items per column (an unassigned appointment goes to the unassigned lane).
  const byColumn = useMemo(() => {
    const map = new Map<number, CalendarAppointment[]>();
    for (const a of appointments) {
      const idx = colIndexOf(isoDay(new Date(a.startTime)), a.barberId);
      if (idx < 0) continue;
      const list = map.get(idx);
      if (list) list.push(a);
      else map.set(idx, [a]);
    }
    return map;
  }, [appointments, colIndexOf]);

  const blocksByColumn = useMemo(() => {
    const map = new Map<number, BlockedTimeRow[]>();
    for (const b of blocks) {
      for (const c of columns) {
        if (b.barber_id !== null && b.barber_id !== c.lane.barberId) continue;
        if (b.barber_id === null && c.lane.barberId === null) continue; // not on the unassigned lane
        if (!verticalPlacement(b.start_time, b.end_time, c.day, range, pxPerMinute)) continue;
        const list = map.get(c.index);
        if (list) list.push(b);
        else map.set(c.index, [b]);
      }
    }
    return map;
  }, [blocks, columns, range, pxPerMinute]);

  const apptById = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);

  // ─── Pointer drag ───
  const finishDrag = useCallback(
    (commit: boolean) => {
      const d = dragRef.current;
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = null;
      dragRef.current = null;
      setDrag(null);
      if (!d || !d.active || !commit) return;
      suppressClick.current = true;
      const a = apptById.get(d.id);
      const target = columns[d.targetCol];
      const origin = columns[d.originCol];
      if (!a || !target || !origin) return;
      if (d.kind === "resize") {
        const endIso = resizeBy(a, d.deltaMin);
        if (endIso !== a.endTime) onMove(a, { startIso: a.startTime, endIso, barberId: a.barberId }, "resize");
        return;
      }
      const next = moveBy(a, d.deltaMin, { barberId: target.lane.barberId, dayShift: dayDiff(origin.day, target.day) });
      if (next.startIso !== a.startTime || next.barberId !== a.barberId) onMove(a, next, "move");
    },
    [apptById, columns, onMove],
  );

  useEffect(() => {
    if (!drag) return;
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.active) {
        if (d.pointerType === "mouse" && Math.hypot(dx, dy) > 4) d.active = true;
        else if (d.pointerType !== "mouse" && Math.hypot(dx, dy) > 8) {
          // Finger moved before the long press: it's a scroll, not a drag.
          finishDrag(false);
          return;
        } else return;
      }
      let targetCol = d.targetCol;
      if (d.kind === "move") {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-col]");
        if (el?.dataset.col) targetCol = Number(el.dataset.col);
      }
      const next = { ...d, deltaMin: dy / pxPerMinute, targetCol };
      dragRef.current = next;
      setDrag(next);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragRef.current && e.pointerId === dragRef.current.pointerId) finishDrag(e.type === "pointerup");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishDrag(false);
    };
    // Once a touch drag is active, stop the page from scrolling under the finger.
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouchMove);
    };
    // Re-bind only when a drag starts/stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, finishDrag, pxPerMinute]);

  const startDrag = (e: React.PointerEvent, a: CalendarAppointment, kind: "move" | "resize", colIndex: number) => {
    if (e.button !== 0 || !canEdit(a)) return;
    if (kind === "move" ? !isMovable(a.status) : !isResizable(a.status)) return;
    if (kind === "resize") e.stopPropagation();
    suppressClick.current = false;
    const state: DragState = {
      id: a.id,
      kind,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      originCol: colIndex,
      targetCol: colIndex,
      active: false,
      deltaMin: 0,
    };
    dragRef.current = state;
    setDrag(state);
    if (e.pointerType !== "mouse" || kind === "resize") {
      const activate = () => {
        if (!dragRef.current || dragRef.current.id !== a.id) return;
        dragRef.current = { ...dragRef.current, active: true };
        setDrag(dragRef.current);
        try {
          navigator.vibrate?.(15);
        } catch {
          /* not supported */
        }
      };
      if (kind === "resize" && e.pointerType === "mouse") activate();
      else pressTimer.current = setTimeout(activate, LONG_PRESS_MS);
    }
  };

  // ─── Keyboard move mode ───
  const moving = moveModeId ? apptById.get(moveModeId) ?? null : null;
  const movingCol = moving ? colIndexOf(isoDay(new Date(moving.startTime)), moving.barberId) : -1;
  const [kbdFor, setKbdFor] = useState<string | null>(null);
  if (moveModeId !== kbdFor) {
    setKbdFor(moveModeId);
    setKbd(moveModeId && movingCol >= 0 ? { deltaMinutes: 0, laneIndex: movingCol, dayShift: 0 } : null);
  }

  const kbdTarget = useMemo<MoveTarget | null>(() => {
    if (!moving || !kbd || movingCol < 0) return null;
    const col = columns[kbd.laneIndex] ?? columns[movingCol];
    return moveBy(moving, kbd.deltaMinutes, {
      barberId: col.lane.barberId,
      dayShift: dayDiff(columns[movingCol].day, col.day) + kbd.dayShift,
    });
  }, [moving, kbd, movingCol, columns]);

  useEffect(() => {
    if (!moving || !kbd) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onMoveModeChange(null);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (kbdTarget && (kbdTarget.startIso !== moving.startTime || kbdTarget.barberId !== moving.barberId)) {
          onMove(moving, kbdTarget, "move");
        }
        onMoveModeChange(null);
        return;
      }
      const next = keyboardMove(kbd, e.key, { isRTL, laneCount: columns.length, shift: e.shiftKey });
      if (next) {
        e.preventDefault();
        setKbd(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moving, kbd, kbdTarget, isRTL, columns.length, onMove, onMoveModeChange]);

  // ─── Render helpers ───
  const ticks = Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i);
  const nowMin = minutesOfDay(now) - range.startHour * 60;
  const colMinWidth = lanes.length * days.length <= 2 ? 160 : days.length > 1 ? 96 : 132;

  const laneNameOf = (barberId: string | null) =>
    lanes.find((l) => l.barberId === barberId)?.name ?? t.calendar.unassigned;

  const moveAnnouncement =
    moving && kbdTarget
      ? interpolate(t.calendar.moveAnnounce, {
          name: moving.clientName || t.calendar.walkIn,
          time: `${formatDate(kbdTarget.startIso, "weekdayDay")} ${formatTime(kbdTarget.startIso)}`,
          barber: laneNameOf(kbdTarget.barberId),
        })
      : "";

  const ghost = (() => {
    if (drag?.active) {
      const a = apptById.get(drag.id);
      const origin = columns[drag.originCol];
      const target = columns[drag.targetCol];
      if (!a || !origin || !target) return null;
      if (drag.kind === "resize") {
        return { col: drag.originCol, startIso: a.startTime, endIso: resizeBy(a, drag.deltaMin), color: colorFor(a) };
      }
      const m = moveBy(a, drag.deltaMin, { barberId: target.lane.barberId, dayShift: dayDiff(origin.day, target.day) });
      return { col: drag.targetCol, startIso: m.startIso, endIso: m.endIso, color: colorFor(a) };
    }
    if (moving && kbdTarget && kbd) {
      const col = colIndexOf(isoDay(new Date(kbdTarget.startIso)), kbdTarget.barberId);
      return { col, startIso: kbdTarget.startIso, endIso: kbdTarget.endIso, color: colorFor(moving) };
    }
    return null;
  })();

  return (
    <div className="relative">
      <p className="sr-only" aria-live="assertive">
        {moveAnnouncement}
      </p>
      {moving && (
        <div
          role="status"
          className="sticky top-0 z-40 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--accent-brass)] bg-[var(--accent-blue-muted)] px-3 py-2 text-[13px] text-[var(--accent-text)]"
        >
          <span>{t.calendar.moveModeHint}</span>
          <span className="flex gap-2">
            <button type="button" className="btn btn-ghost h-9 min-h-0 px-3" onClick={() => onMoveModeChange(null)}>
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="btn btn-primary h-9 min-h-0 px-3"
              onClick={() => {
                if (kbdTarget) onMove(moving, kbdTarget, "move");
                onMoveModeChange(null);
              }}
            >
              {t.calendar.moveHere}
            </button>
          </span>
        </div>
      )}

      <div className="overflow-x-auto overscroll-x-contain rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div style={{ minWidth: 56 + columns.length * colMinWidth }}>
          {/* Header */}
          <div className="sticky top-0 z-30 flex border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
            <div className="sticky start-0 z-10 w-14 shrink-0 bg-[var(--bg-primary)]" aria-hidden="true" />
            <div className="flex flex-1 flex-col">
              {days.length > 1 && (
                <div className="flex">
                  {days.map((day) => (
                    <div
                      key={day}
                      className={cn(
                        "flex-1 border-s border-[var(--border-subtle)] px-2 py-1.5 text-center text-[12px] font-medium",
                        day === today ? "text-[var(--accent-text)]" : "text-[var(--text-secondary)]",
                      )}
                    >
                      {formatDate(fromIsoDay(day), "weekdayDay")}
                    </div>
                  ))}
                </div>
              )}
              {!compact && (
                <div className="flex">
                  {columns.map((c) => (
                    <div
                      key={`${c.day}-${c.lane.key}`}
                      className="flex min-w-0 flex-1 items-center gap-1.5 border-s border-[var(--border-subtle)] px-2 py-2"
                      style={{ boxShadow: `inset 0 -3px 0 ${c.lane.color}` }}
                    >
                      <LaneAvatar lane={c.lane} />
                      <span className="truncate text-[12px] text-[var(--text-secondary)]">{c.lane.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="relative flex">
            <div className="sticky start-0 z-20 w-14 shrink-0 bg-[var(--bg-primary)]" aria-hidden="true">
              <div className="relative" style={{ height }}>
                {ticks.map((h) => (
                  <span
                    key={h}
                    className="absolute end-1.5 -translate-y-1/2 text-[11px] tabular-nums text-[var(--text-muted)]"
                    style={{ top: (h - range.startHour) * 60 * pxPerMinute }}
                  >
                    {h === range.startHour ? "" : formatTime(`${String(h % 24).padStart(2, "0")}:00`, { minute: undefined })}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-1">
              {columns.map((c) => {
                const items = byColumn.get(c.index) ?? [];
                const tracks = packTracks(items);
                const work = workRangesFor(c.lane.barberId, c.day);
                const colBlocks = blocksByColumn.get(c.index) ?? [];
                return (
                  <div
                    key={`${c.day}-${c.lane.key}`}
                    data-col={c.index}
                    role="group"
                    aria-label={`${c.lane.name}, ${formatDate(fromIsoDay(c.day), "weekdayDay")}`}
                    className={cn(
                      "relative min-w-0 flex-1 cursor-copy border-s border-[var(--border-subtle)]",
                      ghost?.col === c.index && "bg-[var(--accent-blue-muted)]/40",
                    )}
                    style={{
                      height,
                      backgroundImage: `repeating-linear-gradient(to bottom, var(--border-subtle) 0, var(--border-subtle) 1px, transparent 1px, transparent ${60 * pxPerMinute}px)`,
                    }}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.offhours) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const minutes = range.startHour * 60 + Math.floor((e.clientY - rect.top) / pxPerMinute / 15) * 15;
                      onSlot({ day: c.day, barberId: c.lane.barberId, minutes, clientX: e.clientX, clientY: e.clientY });
                    }}
                  >
                    {/* Off-hours shading */}
                    {c.lane.barberId !== null &&
                      offHours(work, range).map(([s, e]) => (
                        <div
                          key={`${s}-${e}`}
                          data-offhours="1"
                          aria-hidden="true"
                          className="absolute inset-x-0 bg-[var(--bg-secondary)]/70"
                          style={{ top: (s - range.startHour * 60) * pxPerMinute, height: (e - s) * pxPerMinute }}
                        />
                      ))}

                    {/* Blocked time */}
                    {colBlocks.map((b) => {
                      const p = verticalPlacement(b.start_time, b.end_time, c.day, range, pxPerMinute);
                      if (!p) return null;
                      const prayer = b.source === "prayer";
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBlockOpen(b);
                          }}
                          aria-label={`${blockLabel(b)}, ${formatTime(b.start_time)} – ${formatTime(b.end_time)}`}
                          className="absolute inset-x-0.5 z-[5] flex items-start gap-1 overflow-hidden rounded-[4px] border border-dashed border-[var(--border-primary)] px-1.5 py-0.5 text-start text-[11px] text-[var(--text-muted)] focus-visible:z-30"
                          style={{
                            top: p.top,
                            height: p.height,
                            backgroundImage:
                              "repeating-linear-gradient(135deg, var(--bg-secondary) 0 6px, transparent 6px 12px)",
                          }}
                        >
                          {prayer ? <Moon size={11} aria-hidden="true" className="mt-0.5 shrink-0" /> : <Lock size={11} aria-hidden="true" className="mt-0.5 shrink-0" />}
                          <span className="truncate">{blockLabel(b)}</span>
                        </button>
                      );
                    })}

                    {/* Appointments */}
                    {items.map((a) => {
                      const p = verticalPlacement(a.startTime, a.endTime, c.day, range, pxPerMinute);
                      if (!p) return null;
                      const { track, tracks: n } = tracks.get(a.id) ?? { track: 0, tracks: 1 };
                      const color = colorFor(a);
                      const dragging = drag?.active && drag.id === a.id;
                      const editable = canEdit(a);
                      const name = a.clientName || t.calendar.walkIn;
                      const services = serviceLabel(a);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "absolute z-[15] overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-[0_1px_2px_rgba(28,22,17,0.08)]",
                            a.status === "cancelled" && "opacity-50",
                            a.status === "no_show" && "opacity-70",
                            dragging && "opacity-40",
                            moveModeId === a.id && "ring-2 ring-[var(--accent-brass)]",
                          )}
                          style={{
                            top: p.top + 1,
                            height: Math.max(18, p.height - 2),
                            insetInlineStart: `calc(${(track / n) * 100}% + 2px)`,
                            width: `calc(${100 / n}% - 4px)`,
                            borderInlineStartColor: color,
                            borderInlineStartWidth: 4,
                            touchAction: drag?.active ? "none" : "pan-x pan-y",
                            backgroundImage: `linear-gradient(${color}1f, ${color}1f)`,
                          }}
                        >
                          <button
                            type="button"
                            onPointerDown={(e) => startDrag(e, a, "move", c.index)}
                            onClick={() => {
                              if (suppressClick.current) {
                                suppressClick.current = false;
                                return;
                              }
                              onOpen(a);
                            }}
                            onKeyDown={(e) => {
                              if ((e.key === "m" || e.key === "M") && editable && isMovable(a.status)) {
                                e.preventDefault();
                                onMoveModeChange(a.id);
                              }
                            }}
                            onContextMenu={(e) => {
                              if (drag) e.preventDefault();
                            }}
                            aria-haspopup="dialog"
                            aria-label={`${name}, ${formatTime(a.startTime)} – ${formatTime(a.endTime)}${services ? `, ${services}` : ""}`}
                            aria-describedby={editable && isMovable(a.status) ? "calendar-move-hint" : undefined}
                            className={cn(
                              "flex h-full w-full select-none flex-col items-stretch px-1.5 py-1 text-start focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-brass)]",
                              editable && isMovable(a.status) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-1">
                              <StatusIcon status={a.status} size={11} />
                              <span className={cn("truncate text-[12px] font-medium text-[var(--text-primary)]", a.status === "cancelled" && "line-through")}>
                                {name}
                              </span>
                            </span>
                            {p.height >= 34 && (
                              <span className="truncate text-[11px] tabular-nums text-[var(--text-muted)]">
                                {formatTime(a.startTime)}
                                {services ? ` · ${services}` : ""}
                              </span>
                            )}
                          </button>
                          {editable && isResizable(a.status) && p.height >= 24 && (
                            <span
                              aria-hidden="true"
                              onPointerDown={(e) => startDrag(e, a, "resize", c.index)}
                              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
                            >
                              <span className="mx-auto mt-0.5 block h-0.5 w-6 rounded bg-[var(--border-primary)]" />
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Drag / keyboard ghost */}
                    {ghost && ghost.col === c.index && (() => {
                      const p = verticalPlacement(ghost.startIso, ghost.endIso, c.day, range, pxPerMinute);
                      if (!p) return null;
                      return (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-1 z-[25] rounded-[6px] border-2 border-dashed px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-primary)]"
                          style={{ top: p.top, height: p.height, borderColor: ghost.color, background: `${ghost.color}26` }}
                        >
                          {formatTime(ghost.startIso)} – {formatTime(ghost.endIso)}
                        </div>
                      );
                    })()}

                    {/* Now line */}
                    {c.day === today && nowMin >= 0 && nowMin <= minutesSpan && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 z-20 h-px bg-[var(--accent-rose)]"
                        style={{ top: nowMin * pxPerMinute }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p id="calendar-move-hint" className="sr-only">
        {t.calendar.moveKeyHint}
      </p>
    </div>
  );
}

function offHours(work: [number, number][], range: { startHour: number; endHour: number }): [number, number][] {
  const lo = range.startHour * 60;
  const hi = range.endHour * 60;
  const sorted = work.map(([s, e]) => [Math.max(lo, s), Math.min(hi, e)] as [number, number]).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cursor = lo;
  for (const [s, e] of sorted) {
    if (s > cursor) out.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < hi) out.push([cursor, hi]);
  return out;
}

export function LaneAvatar({ lane, size = 24 }: { lane: GridLane; size?: number }) {
  return lane.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={lane.avatar}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${lane.color}` }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[var(--text-primary)]"
      style={{ width: size, height: size, background: `${lane.color}33`, boxShadow: `0 0 0 2px ${lane.color}` }}
    >
      {lane.barberId === null ? "—" : initialsOf(lane.name)}
    </span>
  );
}
