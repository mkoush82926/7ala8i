"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  STATUS_COLORS,
  tint,
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
  // §6.13: barber columns ≥180px on the day view; denser for multi-day.
  const colMinWidth = lanes.length * days.length <= 2 ? 160 : days.length > 1 ? 112 : 180;

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
          className="sticky top-[4.5rem] z-40 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-soft-line bg-brand-soft px-4 py-3 text-sm font-medium text-brand-pressed shadow-raised"
        >
          <span className="min-w-0 flex-1">{t.calendar.moveModeHint}</span>
          <span className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onMoveModeChange(null)}>
              {t.common.cancel}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (kbdTarget) onMove(moving, kbdTarget, "move");
                onMoveModeChange(null);
              }}
            >
              {t.calendar.moveHere}
            </Button>
          </span>
        </div>
      )}

      <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-line bg-card">
        <div style={{ minWidth: 64 + columns.length * colMinWidth }}>
          {/* Header */}
          <div className="sticky top-0 z-30 flex border-b border-line bg-card">
            <div className="sticky start-0 z-10 w-16 shrink-0 bg-card" aria-hidden="true" />
            <div className="flex flex-1 flex-col">
              {days.length > 1 && (
                <div className="flex">
                  {days.map((day) => (
                    <div
                      key={day}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 border-s border-line px-2 py-2 text-center text-xs font-semibold tabular-nums",
                        day === today ? "text-brand-text" : "text-ink-soft",
                      )}
                    >
                      {day === today && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />}
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
                      className="flex min-w-0 flex-1 items-center gap-2 border-s border-line px-2.5 py-2.5"
                      style={{ boxShadow: `inset 0 -2px 0 ${c.lane.color}` }}
                    >
                      <LaneAvatar lane={c.lane} size={28} />
                      <span className="truncate text-[13px] font-semibold text-ink">{c.lane.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="relative flex">
            <div className="sticky start-0 z-20 w-16 shrink-0 border-e border-line bg-card" aria-hidden="true">
              <div className="relative" style={{ height }}>
                {ticks.map((h) => (
                  <span
                    key={h}
                    className="absolute end-2 -translate-y-1/2 text-xs font-medium tabular-nums text-ink-muted"
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
                      "relative min-w-0 flex-1 cursor-copy border-s border-line transition-colors duration-150 first:border-s-0 motion-reduce:transition-none",
                      ghost?.col === c.index && "bg-brand-soft/60",
                    )}
                    style={{
                      height,
                      // Hour lines solid, half-hour lines faint (§5.12).
                      backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px ${30 * pxPerMinute}px, ${tint("var(--color-line)", 55)} ${30 * pxPerMinute}px ${30 * pxPerMinute + 1}px, transparent ${30 * pxPerMinute + 1}px ${60 * pxPerMinute}px)`,
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
                          className="absolute inset-x-0 bg-sunken/70"
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
                          className="absolute inset-x-0.5 z-[5] flex items-start gap-1.5 overflow-hidden rounded-xs border-s-[3px] border-line-strong px-2 py-1 text-start text-[11px] font-medium leading-4 text-ink-muted transition-colors hover:text-ink focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
                          style={{
                            top: p.top,
                            height: p.height,
                            backgroundImage:
                              "repeating-linear-gradient(135deg, var(--color-sunken) 0 6px, var(--color-sunken-2) 6px 12px)",
                          }}
                        >
                          {prayer ? <Moon size={12} aria-hidden="true" className="shrink-0" /> : <Lock size={12} aria-hidden="true" className="shrink-0" />}
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
                      const cancelled = a.status === "cancelled";
                      // §5.12: pending / awaiting deposit read as tentative (dashed outline).
                      const tentative = a.status === "pending" || a.status === "awaiting_deposit";
                      const live = a.status === "arrived" || a.status === "in_chair";
                      return (
                        <div
                          key={a.id}
                          data-status={a.status}
                          className={cn(
                            "group/chip absolute z-[15] overflow-hidden rounded-xs text-ink shadow-xs transition-[box-shadow,opacity] duration-150 hover:z-[16] hover:shadow-card motion-reduce:transition-none",
                            tentative ? "border border-dashed" : "border-0",
                            cancelled && "bg-sunken text-ink-muted shadow-none",
                            a.status === "no_show" && "opacity-80",
                            dragging && "opacity-40",
                            moveModeId === a.id && "z-[16] shadow-float ring-2 ring-brand",
                          )}
                          style={{
                            top: p.top + 1,
                            height: Math.max(18, p.height - 2),
                            insetInlineStart: `calc(${(track / n) * 100}% + 2px)`,
                            width: `calc(${100 / n}% - 4px)`,
                            borderColor: cancelled ? "var(--color-line-strong)" : color,
                            borderInlineStartWidth: 3,
                            borderInlineStartStyle: "solid",
                            touchAction: drag?.active ? "none" : "pan-x pan-y",
                            // Body = status fill (§5.12); the barber/category colour stays on the 3px rail.
                            background: cancelled ? undefined : tint(STATUS_COLORS[a.status] ?? color, live ? 24 : 12, "var(--color-card)"),
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
                              "flex h-full w-full select-none flex-col items-stretch gap-0.5 px-2 py-1 text-start text-xs leading-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
                              editable && isMovable(a.status) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-1">
                              <StatusIcon status={a.status} size={12} />
                              <bdi className={cn("min-w-0 truncate font-semibold", cancelled && "line-through")}>{name}</bdi>
                              {/* Short chips (< 44px) can't fit two 16px lines: start time rides on the name line. */}
                              {p.height < 44 && (
                                <span className="shrink-0 tabular-nums opacity-80">· {formatTime(a.startTime)}</span>
                              )}
                            </span>
                            {p.height >= 44 && (
                              <span className="truncate text-[11px] tabular-nums opacity-80">
                                {formatTime(a.startTime)}–{formatTime(a.endTime)}
                                {services && p.height < 60 ? <> · <bdi>{services}</bdi></> : null}
                              </span>
                            )}
                            {services && p.height >= 60 && <bdi className="truncate text-[11px] opacity-80">{services}</bdi>}
                          </button>
                          {editable && isResizable(a.status) && p.height >= 24 && (
                            <span
                              aria-hidden="true"
                              onPointerDown={(e) => startDrag(e, a, "resize", c.index)}
                              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
                            >
                              <span className="mx-auto mt-0.5 block h-0.5 w-6 rounded-full bg-line-strong opacity-0 transition-opacity group-hover/chip:opacity-100 [@media(hover:none)]:opacity-100" />
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
                          className="pointer-events-none absolute inset-x-1 z-[25] rounded-xs border-2 border-dashed px-2 py-1 text-[11px] font-semibold tabular-nums text-ink opacity-95 shadow-float"
                          style={{ top: p.top, height: p.height, borderColor: ghost.color, background: tint(ghost.color, 20, "var(--color-card)") }}
                        >
                          {formatTime(ghost.startIso)} – {formatTime(ghost.endIso)}
                        </div>
                      );
                    })()}

                    {/* Now line */}
                    {c.day === today && nowMin >= 0 && nowMin <= minutesSpan && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 z-20 h-0.5 -translate-y-1/2 bg-danger"
                        style={{ top: nowMin * pxPerMinute }}
                      >
                        <span className="absolute -start-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-danger" />
                      </div>
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
      className="shrink-0 rounded-full bg-sunken object-cover"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px var(--color-card), 0 0 0 3.5px ${lane.color}` }}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold text-ink", size >= 28 ? "text-[11px]" : "text-[10px]")}
      style={{ width: size, height: size, background: tint(lane.color, 18, "var(--color-card)"), boxShadow: `0 0 0 2px var(--color-card), 0 0 0 3.5px ${lane.color}` }}
    >
      {lane.barberId === null ? "—" : initialsOf(lane.name)}
    </span>
  );
}
