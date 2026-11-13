// ═══════════════════════════════════════════════════════
// Best-effort idempotency for POST /api/booking.
//
// The booking form sends an `Idempotency-Key` header that stays the same
// across retries of one confirm attempt. If a request with the same key is
// already running, the retry waits for it; if it already succeeded, the
// stored result is replayed instead of creating a second booking.
//
// This store is per server instance (in memory). It covers the common cases:
// a double click and a client retry after a timeout that hit the same
// instance. The database is the real guard: an explicit barber cannot be
// double-booked (overlap check + exclusion constraint), and each client is
// capped at 5 upcoming bookings per shop.
// ═══════════════════════════════════════════════════════

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

interface Entry<T> {
  expires: number;
  promise: Promise<T>;
  settled: boolean;
}

const store = new Map<string, Entry<unknown>>();

/** Accepts UUIDs and similar opaque tokens only. */
export function parseIdempotencyKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim();
  return /^[A-Za-z0-9_-]{16,100}$/.test(key) ? key : null;
}

function prune(now: number) {
  for (const [key, entry] of store) {
    if (entry.settled && entry.expires <= now) store.delete(key);
  }
  // Hard cap: drop the oldest settled entries first.
  if (store.size > MAX_ENTRIES) {
    for (const [key, entry] of store) {
      if (store.size <= MAX_ENTRIES) break;
      if (entry.settled) store.delete(key);
    }
  }
}

/**
 * Runs `fn` once per key. Concurrent callers share the in-flight promise.
 * Only results for which `shouldKeep(result)` is true are remembered, so a
 * failed attempt (slot taken, validation error, network) can be retried.
 * Returns `{ result, replayed }`.
 */
export async function runIdempotent<T>(
  key: string,
  fn: () => Promise<T>,
  shouldKeep: (result: T) => boolean,
): Promise<{ result: T; replayed: boolean }> {
  const now = Date.now();
  prune(now);

  const existing = store.get(key) as Entry<T> | undefined;
  if (existing && (!existing.settled || existing.expires > now)) {
    return { result: await existing.promise, replayed: true };
  }

  const entry: Entry<T> = { expires: now + TTL_MS, promise: Promise.resolve() as Promise<T>, settled: false };
  entry.promise = (async () => {
    try {
      const result = await fn();
      if (shouldKeep(result)) {
        entry.settled = true;
        entry.expires = Date.now() + TTL_MS;
      } else {
        store.delete(key);
      }
      return result;
    } catch (err) {
      store.delete(key);
      throw err;
    }
  })();
  store.set(key, entry as Entry<unknown>);

  return { result: await entry.promise, replayed: false };
}

/** Test helper. */
export function __resetIdempotencyStore() {
  store.clear();
}
