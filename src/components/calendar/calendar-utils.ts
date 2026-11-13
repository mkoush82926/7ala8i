import type { AppointmentStatus } from "@/lib/types";

/** Visual tokens per canonical status (keys mirror APPOINTMENT_STATUSES). */
export const STATUS_STYLES: Record<AppointmentStatus, { bg: string; border: string; text: string; dot: string }> = {
  pending: {
    bg: "bg-[var(--bg-secondary)]",
    border: "border-[var(--border-primary)]",
    text: "text-[var(--text-secondary)]",
    dot: "bg-[var(--text-muted)]",
  },
  confirmed: {
    bg: "bg-[var(--accent-blue-muted)]",
    border: "border-[var(--accent-blue)]/40",
    text: "text-[var(--accent-blue)]",
    dot: "bg-[var(--accent-blue)]",
  },
  completed: {
    bg: "bg-[var(--accent-mint-muted)]",
    border: "border-[var(--accent-mint)]/40",
    text: "text-[var(--accent-mint)]",
    dot: "bg-[var(--accent-mint)]",
  },
  no_show: {
    bg: "bg-[var(--accent-rose-muted)]",
    border: "border-[var(--accent-rose)]/40",
    text: "text-[var(--accent-rose)]",
    dot: "bg-[var(--accent-rose)]",
  },
  cancelled: {
    bg: "bg-[var(--bg-secondary)]/60",
    border: "border-dashed border-[var(--border-subtle)]",
    text: "text-[var(--text-muted)] line-through",
    dot: "bg-[var(--border-primary)]",
  },
};

export const DEFAULT_DAY_START = 8;
export const DEFAULT_DAY_END = 20;

const hoursOf = (d: Date) => d.getHours() + d.getMinutes() / 60;

/**
 * Visible hour range: at least 08:00–20:00, widened to include every
 * appointment of the day (so a 07:30 or 21:00 booking is never clipped).
 */
export function computeHourRange(
  items: { startTime: string; endTime: string }[],
  defaults: { start: number; end: number } = { start: DEFAULT_DAY_START, end: DEFAULT_DAY_END },
): { startHour: number; endHour: number } {
  let startHour = defaults.start;
  let endHour = defaults.end;
  for (const item of items) {
    const s = new Date(item.startTime);
    const e = new Date(item.endTime);
    if (Number.isNaN(s.getTime())) continue;
    startHour = Math.min(startHour, Math.floor(hoursOf(s)));
    const endH = Number.isNaN(e.getTime()) ? hoursOf(s) + 0.5 : hoursOf(e);
    // An end past midnight (next day) clamps to 24.
    const endsNextDay = !Number.isNaN(e.getTime()) && e.getDate() !== s.getDate();
    endHour = Math.max(endHour, endsNextDay ? 24 : Math.ceil(endH));
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, Math.max(endHour, startHour + 1)) };
}

/** Inline-start offset and width (in %) of a block, clamped to the visible range. */
export function blockPlacement(
  startTime: string,
  endTime: string,
  range: { startHour: number; endHour: number },
): { startPct: number; widthPct: number } {
  const span = range.endHour - range.startHour;
  const s = new Date(startTime);
  const e = new Date(endTime);
  const sh = hoursOf(s);
  let eh = Number.isNaN(e.getTime()) ? sh + 0.5 : hoursOf(e);
  if (!Number.isNaN(e.getTime()) && e.getDate() !== s.getDate()) eh = 24;
  const from = Math.max(range.startHour, Math.min(range.endHour, sh));
  const to = Math.max(from, Math.min(range.endHour, eh));
  const startPct = ((from - range.startHour) / span) * 100;
  // Very short blocks stay clickable.
  const widthPct = Math.max(((to - from) / span) * 100, Math.min(100 - startPct, 100 / (span * 4)));
  return { startPct, widthPct };
}

/** Position (in %) of "now" inside the range, or null when outside it. */
export function nowPosition(now: Date, range: { startHour: number; endHour: number }): number | null {
  const h = hoursOf(now);
  if (h < range.startHour || h >= range.endHour) return null;
  return ((h - range.startHour) / (range.endHour - range.startHour)) * 100;
}

/**
 * Packs overlapping blocks of one lane into stacked tracks so they never
 * hide each other. Returns id → { track, tracks } (tracks = height divisor).
 */
export function packTracks<T extends { id: string; startTime: string; endTime: string }>(
  items: T[],
): Map<string, { track: number; tracks: number }> {
  const sorted = [...items].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const result = new Map<string, { track: number; tracks: number }>();
  let cluster: { id: string; track: number }[] = [];
  let clusterEnd = -Infinity;
  let trackEnds: number[] = [];

  const flush = () => {
    const tracks = Math.max(1, trackEnds.length);
    for (const c of cluster) result.set(c.id, { track: c.track, tracks });
    cluster = [];
    trackEnds = [];
  };

  for (const item of sorted) {
    const s = new Date(item.startTime).getTime();
    const e = Math.max(s + 1, new Date(item.endTime).getTime() || s + 1);
    if (s >= clusterEnd && cluster.length) flush();
    let track = trackEnds.findIndex((end) => end <= s);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(e);
    } else {
      trackEnds[track] = e;
    }
    cluster.push({ id: item.id, track });
    clusterEnd = Math.max(clusterEnd === -Infinity ? e : clusterEnd, e);
  }
  if (cluster.length) flush();
  return result;
}

/** Hour labels for the header, e.g. [8, 9, …, 19] for 08:00–20:00. */
export function hourTicks(range: { startHour: number; endHour: number }): number[] {
  return Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i);
}

/** Combine a "yyyy-MM-dd" day and "HH:mm" time (local) into a Date. */
export function combineDayAndTime(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

/** Initials that never crash on empty / double-spaced names. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0])
    .join("")
    .toUpperCase();
}
