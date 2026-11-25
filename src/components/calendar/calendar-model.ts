// ═══════════════════════════════════════════════════════════════════════════
// Calendar v2 (WS-1E) — pure model: ranges, grid geometry, drag/resize/keyboard
// moves, team selection and ordering, schedules, colours and block series.
// Times are the browser's local time (staff devices run on shop time; the
// rest of the dashboard uses the same convention).
// ═══════════════════════════════════════════════════════════════════════════

import { expandRecurrence } from "@/lib/availability/recurrence";
import { APPOINTMENT_STATUS_TRANSITIONS, type AppointmentStatus } from "@/lib/types";
import { parseSegments, segmentRange, minutesOf } from "@/components/team/shifts/schedule-logic";

// ─── Ranges ────────────────────────────────────────────────────────────────

export const RANGE_MODES = ["day", "3day", "week", "month"] as const;
export type RangeMode = (typeof RANGE_MODES)[number];

/** Jordanian work weeks start on Saturday. */
export const WEEK_STARTS_ON = 6;
/** "+N weeks" jump chips. */
export const JUMP_WEEKS = [1, 2, 3, 4, 6, 8] as const;

const DAY_MS = 86_400_000;

export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "yyyy-MM-dd" → local midnight. */
export function fromIsoDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysLocal(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeekSat(date: Date): Date {
  const d = startOfLocalDay(date);
  const diff = (d.getDay() - WEEK_STARTS_ON + 7) % 7;
  return addDaysLocal(d, -diff);
}

export interface CalendarRange {
  mode: RangeMode;
  /** Every local day shown, in order. */
  days: string[];
  from: string;
  to: string;
}

export function rangeFor(mode: RangeMode, anchor: Date): CalendarRange {
  const base = startOfLocalDay(anchor);
  let start: Date;
  let count: number;
  if (mode === "day") {
    start = base;
    count = 1;
  } else if (mode === "3day") {
    start = base;
    count = 3;
  } else if (mode === "week") {
    start = startOfWeekSat(base);
    count = 7;
  } else {
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    start = startOfWeekSat(first);
    const end = addDaysLocal(startOfWeekSat(last), 6);
    count = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  }
  const days = Array.from({ length: count }, (_, i) => isoDay(addDaysLocal(start, i)));
  return { mode, days, from: days[0], to: days[days.length - 1] };
}

/** Previous / next page of the current range. */
export function shiftAnchor(mode: RangeMode, anchor: Date, direction: 1 | -1): Date {
  if (mode === "day") return addDaysLocal(anchor, direction);
  if (mode === "3day") return addDaysLocal(anchor, 3 * direction);
  if (mode === "week") return addDaysLocal(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

// ─── Grid geometry ─────────────────────────────────────────────────────────

export const SNAP_MINUTES = 5;
export const KEY_STEP_MINUTES = 15;
export const MIN_DURATION = 5;

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function snapMinutes(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

/** Vertical px offset inside a column → minutes since midnight (snapped). */
export function yToMinutes(y: number, startHour: number, pxPerMinute: number, step = SNAP_MINUTES): number {
  return startHour * 60 + snapMinutes(y / pxPerMinute, step);
}

/** Top/height (px) of an item inside a day column that shows [startHour, endHour). */
export function verticalPlacement(
  startIso: string,
  endIso: string,
  day: string,
  range: { startHour: number; endHour: number },
  pxPerMinute: number,
): { top: number; height: number } | null {
  const dayStart = fromIsoDay(day).getTime();
  const from = (new Date(startIso).getTime() - dayStart) / 60000;
  const to = (new Date(endIso).getTime() - dayStart) / 60000;
  const lo = range.startHour * 60;
  const hi = range.endHour * 60;
  const s = Math.max(lo, from);
  const e = Math.min(hi, to);
  if (!(e > s)) return null;
  return { top: (s - lo) * pxPerMinute, height: Math.max(12, (e - s) * pxPerMinute) };
}

export interface MoveTarget {
  startIso: string;
  endIso: string;
  barberId: string | null;
}

/** New start/end after a drag: same duration, `deltaMinutes` later, maybe another lane/day. */
export function moveBy(
  appt: { startTime: string; endTime: string; barberId: string | null },
  deltaMinutes: number,
  target: { barberId?: string | null; dayShift?: number } = {},
  step = SNAP_MINUTES,
): MoveTarget {
  const start = new Date(appt.startTime);
  const duration = new Date(appt.endTime).getTime() - start.getTime();
  const shifted = addDaysLocal(start, target.dayShift ?? 0);
  const snapped = snapMinutes(minutesOfDay(shifted) + deltaMinutes, step) - minutesOfDay(shifted);
  const next = new Date(shifted.getTime() + snapped * 60000);
  return {
    startIso: next.toISOString(),
    endIso: new Date(next.getTime() + duration).toISOString(),
    barberId: target.barberId === undefined ? appt.barberId : target.barberId,
  };
}

/** New end after dragging the bottom edge (≥ MIN_DURATION). */
export function resizeBy(appt: { startTime: string; endTime: string }, deltaMinutes: number, step = SNAP_MINUTES): string {
  const start = new Date(appt.startTime).getTime();
  const end = new Date(appt.endTime).getTime();
  const minutes = Math.max(MIN_DURATION, snapMinutes((end - start) / 60000 + deltaMinutes, step));
  return new Date(start + minutes * 60000).toISOString();
}

export interface KeyboardMoveState {
  deltaMinutes: number;
  laneIndex: number;
  dayShift: number;
}

/**
 * Arrow-key move mode. Up/Down move by 15 min (Shift: 60). Left/Right move to
 * the previous/next lane in *visual* order, so in RTL ArrowLeft goes to the
 * next lane (lanes run right-to-left). Returns null for keys it ignores.
 */
export function keyboardMove(
  state: KeyboardMoveState,
  key: string,
  opts: { isRTL: boolean; laneCount: number; shift?: boolean },
): KeyboardMoveState | null {
  const step = opts.shift ? 60 : KEY_STEP_MINUTES;
  switch (key) {
    case "ArrowUp":
      return { ...state, deltaMinutes: state.deltaMinutes - step };
    case "ArrowDown":
      return { ...state, deltaMinutes: state.deltaMinutes + step };
    case "ArrowLeft":
    case "ArrowRight": {
      const forward = (key === "ArrowRight") !== opts.isRTL;
      const next = Math.min(opts.laneCount - 1, Math.max(0, state.laneIndex + (forward ? 1 : -1)));
      return { ...state, laneIndex: next };
    }
    case "PageUp":
      return { ...state, dayShift: state.dayShift - 1 };
    case "PageDown":
      return { ...state, dayShift: state.dayShift + 1 };
    default:
      return null;
  }
}

/** Visible hours: 08–20 at least, widened by items and working ranges. */
export function hourRangeFor(
  items: { startTime: string; endTime: string }[],
  workMinutes: [number, number][] = [],
  defaults = { start: 8, end: 20 },
): { startHour: number; endHour: number } {
  let lo = defaults.start * 60;
  let hi = defaults.end * 60;
  for (const it of items) {
    const s = new Date(it.startTime);
    const e = new Date(it.endTime);
    if (Number.isNaN(s.getTime())) continue;
    lo = Math.min(lo, minutesOfDay(s));
    const endMin = isoDay(e) !== isoDay(s) ? 1440 : minutesOfDay(e);
    hi = Math.max(hi, endMin);
  }
  for (const [s, e] of workMinutes) {
    lo = Math.min(lo, s);
    hi = Math.max(hi, Math.min(1440, e));
  }
  const startHour = Math.max(0, Math.floor(lo / 60));
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(hi / 60)));
  return { startHour, endHour };
}

// ─── Statuses ──────────────────────────────────────────────────────────────

/** No-show only once the appointment has started (and only from a status that allows it). */
export function canMarkNoShow(appt: { status: AppointmentStatus; startTime: string }, now: Date): boolean {
  return APPOINTMENT_STATUS_TRANSITIONS[appt.status].includes("no_show") && new Date(appt.startTime).getTime() <= now.getTime();
}

/** Appointments that can be dragged (not finished, not cancelled). */
export function isMovable(status: AppointmentStatus): boolean {
  return status === "pending" || status === "confirmed" || status === "awaiting_deposit" || status === "arrived";
}

export function isResizable(status: AppointmentStatus): boolean {
  return isMovable(status) || status === "in_chair";
}

// ─── Team ─────────────────────────────────────────────────────────────────

export type TeamMode = "scheduled" | "all" | "custom";

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string | null;
  order?: number | null;
  color?: string | null;
}

/** Saved order first (calendar_order), then the original order. */
export function orderTeam<T extends TeamMember>(members: T[], localOrder?: string[] | null): T[] {
  const indexed = members.map((m, i) => ({ m, i }));
  const local = new Map((localOrder ?? []).map((id, i) => [id, i]));
  return indexed
    .sort((a, b) => {
      const la = local.get(a.m.id);
      const lb = local.get(b.m.id);
      if (la !== undefined || lb !== undefined) return (la ?? 1e6) - (lb ?? 1e6) || a.i - b.i;
      const oa = a.m.order ?? 1e6;
      const ob = b.m.order ?? 1e6;
      return oa - ob || a.i - b.i;
    })
    .map((x) => x.m);
}

/** Moves one item (reorder by drag or arrow buttons). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

export function selectTeam<T extends TeamMember>(
  mode: TeamMode,
  ordered: T[],
  scheduled: Set<string>,
  custom: string[],
): T[] {
  if (mode === "all") return ordered;
  if (mode === "custom") {
    const pick = new Set(custom);
    const chosen = ordered.filter((m) => pick.has(m.id));
    return chosen.length ? chosen : ordered;
  }
  const working = ordered.filter((m) => scheduled.has(m.id));
  return working.length ? working : ordered;
}

// ─── Schedules ────────────────────────────────────────────────────────────

export interface ScheduleInputs {
  workingHours: { barber_id: string; day_of_week: number; start_time: string | null; end_time: string | null; is_working: boolean | null; break_start?: string | null; break_end?: string | null }[];
  overrides: { barber_id: string; date: string; segments: unknown }[];
  timeOff: { barber_id: string; start_time: string; end_time: string; status: string }[];
  closures: { start_date: string; end_date: string }[];
  specialHours: { date: string; is_closed: boolean; segments: unknown }[];
}

export const EMPTY_SCHEDULE: ScheduleInputs = { workingHours: [], overrides: [], timeOff: [], closures: [], specialHours: [] };

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

/**
 * Working minutes [start, end) of a barber on a local day (end may exceed
 * 1440 for night shifts), mirroring the P0V precedence: closure → override →
 * special hours (for barbers working that weekday) → weekly hours minus the
 * break → 09:00–18:00 when the barber has no weekly rows. Approved time off
 * covering the whole range removes it.
 */
export function workRanges(barberId: string, day: string, s: ScheduleInputs): [number, number][] {
  if (s.closures.some((c) => c.start_date <= day && day <= c.end_date)) return [];
  const special = s.specialHours.find((h) => h.date === day);
  if (special?.is_closed) return [];

  let ranges: [number, number][];
  const override = s.overrides.find((o) => o.barber_id === barberId && o.date === day);
  const dow = fromIsoDay(day).getDay();
  const rows = s.workingHours.filter((w) => w.barber_id === barberId);
  const weekly = rows.find((w) => w.day_of_week === dow);
  const worksWeekday = rows.length === 0 || !!(weekly && weekly.is_working !== false);

  if (override) {
    ranges = parseSegments(override.segments).map(segmentRange);
  } else if (special && worksWeekday) {
    ranges = parseSegments(special.segments).map(segmentRange);
  } else if (rows.length === 0) {
    ranges = [[540, 1080]];
  } else if (!weekly || weekly.is_working === false) {
    ranges = [];
  } else {
    const start = minutesOf(hhmm(weekly.start_time) ?? "09:00");
    let end = minutesOf(hhmm(weekly.end_time) ?? "18:00");
    if (end <= start) end += 1440;
    const bs = weekly.break_start ? minutesOf(hhmm(weekly.break_start)!) : NaN;
    const be = weekly.break_end ? minutesOf(hhmm(weekly.break_end)!) : NaN;
    ranges = Number.isFinite(bs) && Number.isFinite(be) && bs > start && be > bs && be < end
      ? [[start, bs], [be, end]]
      : [[start, end]];
  }

  const dayStart = fromIsoDay(day).getTime();
  const offs = s.timeOff
    .filter((t) => t.barber_id === barberId && t.status === "approved")
    .map((t) => [(new Date(t.start_time).getTime() - dayStart) / 60000, (new Date(t.end_time).getTime() - dayStart) / 60000] as const);
  return ranges.filter(([a, b]) => !offs.some(([x, y]) => x <= a && y >= b));
}

export function scheduledIds(barberIds: string[], days: string[], s: ScheduleInputs): Set<string> {
  const out = new Set<string>();
  for (const id of barberIds) {
    if (days.some((d) => workRanges(id, d, s).length > 0)) out.add(id);
  }
  return out;
}

// ─── Colours ──────────────────────────────────────────────────────────────

export type ColorSource = "barber" | "category" | "status";
export const COLOR_SOURCES: readonly ColorSource[] = ["barber", "category", "status"];

/** Ink & Brass companion hues, readable with dark text at 18% tint and as a 3px rail. */
export const BARBER_PALETTE = ["#b08d57", "#4f6d7a", "#7a8f5b", "#a4574b", "#6b5b95", "#c98a3c", "#3f7f74", "#8a6f5a"] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  haircut: "#b08d57",
  fade: "#8a6f5a",
  beard: "#4f6d7a",
  shave: "#3f7f74",
  kids: "#c98a3c",
  styling: "#6b5b95",
  colour: "#a4574b",
  treatments: "#7a8f5b",
  facial: "#7a8f5b",
  packages: "#1c1611",
  "home-service": "#4f6d7a",
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: "#8c8478",
  confirmed: "#4f6d7a",
  awaiting_deposit: "#b08d57",
  arrived: "#c98a3c",
  in_chair: "#3f7f74",
  completed: "#7a8f5b",
  no_show: "#a4574b",
  cancelled: "#8c8478",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function barberColor(member: Pick<TeamMember, "color"> | undefined, index: number): string {
  if (member?.color && HEX_RE.test(member.color)) return member.color;
  return BARBER_PALETTE[((index % BARBER_PALETTE.length) + BARBER_PALETTE.length) % BARBER_PALETTE.length];
}

export function cardColor(
  source: ColorSource,
  appt: { status: AppointmentStatus; barberId: string | null; categorySlug?: string | null },
  barberColors: Map<string, string>,
): string {
  if (source === "status") return STATUS_COLORS[appt.status];
  if (source === "category") return (appt.categorySlug && CATEGORY_COLORS[appt.categorySlug]) || "#8c8478";
  return (appt.barberId && barberColors.get(appt.barberId)) || "#8c8478";
}

// ─── Month density / week matrix ──────────────────────────────────────────

export function countByDay(items: { startTime: string; status: AppointmentStatus }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (it.status === "cancelled") continue;
    const day = isoDay(new Date(it.startTime));
    out.set(day, (out.get(day) ?? 0) + 1);
  }
  return out;
}

/** 0 (none) … 4 (busiest day of the month). */
export function densityLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}

export const UNASSIGNED_KEY = "__unassigned__";

/** Buckets items by `${barberId|unassigned}|${day}` in one pass (week view). */
export function bucketByLaneDay<T extends { startTime: string; barberId: string | null }>(items: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const key = `${it.barberId ?? UNASSIGNED_KEY}|${isoDay(new Date(it.startTime))}`;
    const list = out.get(key);
    if (list) list.push(it);
    else out.set(key, [it]);
  }
  for (const list of out.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return out;
}

// ─── Blocked time series ──────────────────────────────────────────────────

export type BlockRepeat = "none" | "daily" | "weekdays" | "weekly";
export const BLOCK_REPEATS: readonly BlockRepeat[] = ["none", "daily", "weekdays", "weekly"];

export interface BlockDraft {
  barberIds: (string | null)[]; // null = whole shop
  day: string;
  time: string; // HH:mm
  minutes: number;
  repeat: BlockRepeat;
  until: string | null;
  typeId: string | null;
  title: string | null;
  allowOnline: boolean;
}

export interface BlockRow {
  shop_id: string;
  barber_id: string | null;
  start_time: string;
  end_time: string;
  type_id: string | null;
  title: string | null;
  rrule: string | null;
  series_id: string | null;
  source: "manual";
  allow_online: boolean;
}

/** Hard cap for one save (rows = barbers × occurrences). */
export const MAX_BLOCK_ROWS = 400;

export function blockRrule(repeat: BlockRepeat, until: string | null): string | null {
  if (repeat === "none") return null;
  const end = until ? `;UNTIL=${until.replace(/-/g, "")}` : ";COUNT=90";
  if (repeat === "daily") return `FREQ=DAILY${end}`;
  // Jordan: Friday is the weekend.
  if (repeat === "weekdays") return `FREQ=WEEKLY;BYDAY=SA,SU,MO,TU,WE,TH${end}`;
  return `FREQ=WEEKLY${end}`;
}

/** One row per barber × occurrence (the engine reads occurrences, not rules). */
export function buildBlockRows(shopId: string, draft: BlockDraft, newId: () => string): BlockRow[] {
  const rrule = blockRrule(draft.repeat, draft.until);
  const days = rrule ? expandRecurrence(rrule, draft.day) : [draft.day];
  const minutes = Math.max(MIN_DURATION, Math.min(24 * 60, Math.round(draft.minutes)));
  const [hh, mm] = draft.time.split(":").map(Number);
  const rows: BlockRow[] = [];
  for (const barberId of draft.barberIds.length ? draft.barberIds : [null]) {
    const seriesId = rrule ? newId() : null;
    for (const day of days) {
      const start = fromIsoDay(day);
      start.setHours(hh || 0, mm || 0, 0, 0);
      rows.push({
        shop_id: shopId,
        barber_id: barberId,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + minutes * 60000).toISOString(),
        type_id: draft.typeId,
        title: draft.title?.trim() || null,
        rrule,
        series_id: seriesId,
        source: "manual",
        allow_online: draft.allowOnline,
      });
      if (rows.length >= MAX_BLOCK_ROWS) return rows;
    }
  }
  return rows;
}

// ─── Conflicts (UX pre-check; the DB exclusion constraint is authoritative) ─

export interface Interval {
  id: string;
  startTime: string;
  endTime: string;
  barberId: string | null;
}

export function overlapping<T extends Interval>(
  target: { startIso: string; endIso: string; barberId: string | null; ignoreId?: string },
  items: T[],
  opts: { nullIsShopWide?: boolean } = {},
): T[] {
  const s = new Date(target.startIso).getTime();
  const e = new Date(target.endIso).getTime();
  return items.filter((it) => {
    if (it.id === target.ignoreId) return false;
    // Shop-wide blocks (barberId null) hit every lane; appointments only their own.
    const shopWide = opts.nullIsShopWide && it.barberId === null;
    if (!shopWide && it.barberId !== target.barberId) return false;
    return s < new Date(it.endTime).getTime() && new Date(it.startTime).getTime() < e;
  });
}
