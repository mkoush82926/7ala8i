// ═══════════════════════════════════════════════════════
// Simple in-memory rate limiter (per IP, per window)
// ═══════════════════════════════════════════════════════

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute

export function rateLimit(
  identifier: string,
  maxRequests = 10,
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { success: true, remaining: maxRequests - 1 };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: maxRequests - entry.count };
}
