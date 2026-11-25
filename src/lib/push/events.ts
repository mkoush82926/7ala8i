// ═══════════════════════════════════════════════════════════════════════════
// Staff notification events and preferences (WS-1K). Safe for browser + server.
// Mirrors the CHECK constraints in supabase/migrations/20250101003000_staff_push.sql.
// ═══════════════════════════════════════════════════════════════════════════

export const STAFF_PUSH_EVENTS = [
  "booking_new",
  "booking_cancelled",
  "booking_rescheduled",
  "walk_in_assigned",
  "waitlist_filled",
] as const;
export type StaffPushEvent = (typeof STAFF_PUSH_EVENTS)[number];

/** Outbox events: the five staff events plus the self-test. */
export type StaffOutboxEvent = StaffPushEvent | "test";

export const PUSH_CHANNELS = ["push", "whatsapp"] as const;
export type PushChannel = (typeof PUSH_CHANNELS)[number];

export function isStaffPushEvent(value: unknown): value is StaffPushEvent {
  return typeof value === "string" && (STAFF_PUSH_EVENTS as readonly string[]).includes(value);
}

export function isPushChannel(value: unknown): value is PushChannel {
  return typeof value === "string" && (PUSH_CHANNELS as readonly string[]).includes(value);
}

/** Default when no row exists: push on, WhatsApp off (WhatsApp messages cost money). */
export function defaultPref(channel: PushChannel): boolean {
  return channel === "push";
}

export interface NotificationPrefRow {
  event: string;
  channel: string;
  enabled: boolean;
}

export type PrefMatrix = Record<StaffPushEvent, Record<PushChannel, boolean>>;

/** Builds the full event × channel matrix from stored rows (unknown rows ignored). */
export function resolvePrefs(rows: ReadonlyArray<NotificationPrefRow> | null | undefined): PrefMatrix {
  const out = {} as PrefMatrix;
  for (const e of STAFF_PUSH_EVENTS) {
    out[e] = { push: defaultPref("push"), whatsapp: defaultPref("whatsapp") };
  }
  for (const r of rows ?? []) {
    if (isStaffPushEvent(r.event) && isPushChannel(r.channel)) out[r.event][r.channel] = !!r.enabled;
  }
  return out;
}

/** Returns a new matrix with one cell changed (immutable, for optimistic UI). */
export function setPref(matrix: PrefMatrix, event: StaffPushEvent, channel: PushChannel, enabled: boolean): PrefMatrix {
  return { ...matrix, [event]: { ...matrix[event], [channel]: enabled } };
}

/** Sets a channel for every event at once. */
export function setChannelForAll(matrix: PrefMatrix, channel: PushChannel, enabled: boolean): PrefMatrix {
  let next = matrix;
  for (const e of STAFF_PUSH_EVENTS) next = setPref(next, e, channel, enabled);
  return next;
}

/** Rows to upsert so the database matches `matrix` for `profileId`. */
export function prefRows(profileId: string, matrix: PrefMatrix) {
  return STAFF_PUSH_EVENTS.flatMap((event) =>
    PUSH_CHANNELS.map((channel) => ({ profile_id: profileId, event, channel, enabled: matrix[event][channel] })),
  );
}

/** Whether a recipient wants anything at all for this event. */
export function wantsEvent(matrix: PrefMatrix, event: StaffPushEvent): boolean {
  return matrix[event].push || matrix[event].whatsapp;
}
