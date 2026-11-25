// ═══════════════════════════════════════════════════════════════════════════
// Walk-in queue (WS-1E) — live wait estimates.
//
// A greedy simulation: every waiting client, in check-in order, takes the
// earliest gap long enough for their services with an eligible barber (their
// preferred barber, or anyone working). Gaps are found around the barbers'
// remaining appointments today (booked clients keep their slots) and after
// the client already in the chair. Pure and deterministic, so the TV display,
// the front desk and the tests agree.
// ═══════════════════════════════════════════════════════════════════════════

export const QUEUE_STATUSES = ["waiting", "serving", "done", "left"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/** Used when a walk-in has no services selected. */
export const DEFAULT_WALK_IN_MINUTES = 30;

export interface QueueEntry {
  id: string;
  ticketNo: number;
  clientName: string | null;
  phone: string | null;
  serviceIds: string[];
  preferredBarberId: string | null;
  assignedBarberId: string | null;
  appointmentId: string | null;
  status: QueueStatus;
  note: string | null;
  checkedInAt: string;
  startedAt: string | null;
}

export function toQueueEntry(row: Record<string, unknown>): QueueEntry {
  const status = String(row.status ?? "waiting");
  return {
    id: String(row.id),
    ticketNo: Number(row.ticket_no) || 0,
    clientName: (row.client_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    serviceIds: Array.isArray(row.service_ids) ? (row.service_ids as string[]) : [],
    preferredBarberId: (row.preferred_barber_id as string | null) ?? null,
    assignedBarberId: (row.assigned_barber_id as string | null) ?? null,
    appointmentId: (row.appointment_id as string | null) ?? null,
    status: (QUEUE_STATUSES as readonly string[]).includes(status) ? (status as QueueStatus) : "waiting",
    note: (row.note as string | null) ?? null,
    checkedInAt: String(row.checked_in_at ?? new Date().toISOString()),
    startedAt: (row.started_at as string | null) ?? null,
  };
}

export interface QueueBarber {
  id: string;
  /** Working ranges for today as absolute ms [start, end). Empty = not working. */
  shifts: [number, number][];
}

export interface BusyInterval {
  barberId: string;
  start: number; // ms
  end: number; // ms
}

export interface WaitEstimate {
  /** Minutes from `now` until the client is expected to sit down. */
  waitMinutes: number;
  barberId: string | null;
  startsAt: number | null;
  /** Position among waiting clients (1-based). */
  position: number;
}

function earliestGap(from: number, duration: number, busy: BusyInterval[], shifts: [number, number][]): number | null {
  const sorted = busy.slice().sort((a, b) => a.start - b.start);
  const windows = shifts.length ? shifts : [[from, from + 24 * 3600_000] as [number, number]];
  for (const [ws, we] of windows.slice().sort((a, b) => a[0] - b[0])) {
    let t = Math.max(from, ws);
    for (const b of sorted) {
      if (b.end <= t) continue;
      if (b.start >= t + duration) break;
      t = Math.max(t, b.end);
    }
    if (t + duration <= we) return t;
  }
  return null;
}

/**
 * Wait estimates for every waiting entry, keyed by entry id.
 * `durationOf` maps an entry to its minutes (services, else default).
 */
export function estimateWaits(input: {
  now: number;
  entries: QueueEntry[];
  barbers: QueueBarber[];
  /** Today's remaining active appointments (including walk-ins in the chair). */
  busy: BusyInterval[];
  durationOf: (entry: QueueEntry) => number;
}): Map<string, WaitEstimate> {
  const { now } = input;
  const busy = input.busy.filter((b) => b.end > now).map((b) => ({ ...b }));
  const waiting = input.entries
    .filter((e) => e.status === "waiting")
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt) || a.ticketNo - b.ticketNo);
  const working = input.barbers.filter((b) => b.shifts.some(([, e]) => e > now));
  const out = new Map<string, WaitEstimate>();

  waiting.forEach((entry, i) => {
    const duration = Math.max(5, input.durationOf(entry)) * 60_000;
    const candidates = entry.preferredBarberId
      ? input.barbers.filter((b) => b.id === entry.preferredBarberId)
      : working;
    let best: { barberId: string; start: number } | null = null;
    for (const barber of candidates) {
      const start = earliestGap(
        now,
        duration,
        busy.filter((b) => b.barberId === barber.id),
        barber.shifts,
      );
      if (start !== null && (!best || start < best.start)) best = { barberId: barber.id, start };
    }
    if (best) {
      busy.push({ barberId: best.barberId, start: best.start, end: best.start + duration });
      out.set(entry.id, {
        waitMinutes: Math.max(0, Math.round((best.start - now) / 60_000)),
        barberId: best.barberId,
        startsAt: best.start,
        position: i + 1,
      });
    } else {
      out.set(entry.id, { waitMinutes: -1, barberId: null, startsAt: null, position: i + 1 });
    }
  });
  return out;
}

/** Rounds a wait for display: 0 → "now", then to 5 minutes. */
export function roundWait(minutes: number): number {
  if (minutes <= 2) return 0;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

/** "Ahmad K." style for the TV display (no full names or phones on a public screen). */
export function displayName(name: string | null, ticketNo: number): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return `#${ticketNo}`;
  const first = parts[0];
  const initial = parts[1] ? ` ${Array.from(parts[1])[0]}.` : "";
  return `${first}${initial}`;
}
