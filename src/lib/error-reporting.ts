// ═══════════════════════════════════════════════════════════════════════════
// Optional error reporting (Sentry-compatible, dependency-free).
//
// Enabled only when a DSN is configured:
//   SENTRY_DSN               server / edge (route handlers, server components)
//   NEXT_PUBLIC_SENTRY_DSN   browser (error boundaries)
//   SENTRY_ENVIRONMENT       optional, defaults to NODE_ENV
//   SENTRY_RELEASE           optional (e.g. the commit SHA)
// With no DSN every function here is a no-op, so local dev, CI and preview
// builds need nothing.
//
// Sends a minimal event to Sentry's envelope endpoint with fetch(), which works
// in Node, Edge and the browser. No request headers, cookies, query strings or
// user identifiers are sent (PDPL: no personal data leaves the app).
// ═══════════════════════════════════════════════════════════════════════════

export interface ParsedDsn {
  publicKey: string;
  host: string;
  protocol: string;
  projectId: string;
  /** Path prefix for self-hosted Sentry behind a sub-path. */
  pathPrefix: string;
}

export function parseDsn(dsn: string | null | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const parts = url.pathname.split("/").filter(Boolean);
    const projectId = parts.pop();
    if (!url.username || !projectId || !/^\d+$/.test(projectId)) return null;
    return {
      publicKey: url.username,
      host: url.host,
      protocol: url.protocol.replace(":", ""),
      projectId,
      pathPrefix: parts.length ? `/${parts.join("/")}` : "",
    };
  } catch {
    return null;
  }
}

export function envelopeUrl(dsn: ParsedDsn): string {
  return `${dsn.protocol}://${dsn.host}${dsn.pathPrefix}/api/${dsn.projectId}/envelope/?sentry_version=7&sentry_key=${dsn.publicKey}`;
}

function currentDsn(): string | undefined {
  if (typeof process === "undefined") return undefined;
  return typeof window === "undefined" ? process.env.SENTRY_DSN : process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export function isErrorReportingEnabled(dsn: string | undefined = currentDsn()): boolean {
  return parseDsn(dsn) !== null;
}

export interface ErrorContext {
  /** Short tags (route, routeType, digest, runtime …). Values are truncated. */
  tags?: Record<string, string | undefined>;
  level?: "error" | "warning" | "fatal";
}

function randomHex32(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Strips query strings / fragments (they may carry tokens) from any URL-ish string. */
export function scrubUrl(value: string): string {
  return value.replace(/([?#])[^\s"')]*/g, "$1…");
}

/** Builds the Sentry envelope body (exported for tests). */
export function buildEnvelope(error: unknown, ctx: ErrorContext = {}, now: Date = new Date()): string {
  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = randomHex32();
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx.tags ?? {})) {
    if (typeof v === "string" && v) tags[k.slice(0, 32)] = scrubUrl(v).slice(0, 200);
  }
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "javascript",
    level: ctx.level ?? "error",
    environment: (typeof process !== "undefined" && (process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV)) || "production",
    release: (typeof process !== "undefined" && process.env.SENTRY_RELEASE) || undefined,
    tags,
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: scrubUrl(err.message || "").slice(0, 1000),
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split("\n")
                  .slice(1, 30)
                  .reverse()
                  .map((line) => ({ function: scrubUrl(line.trim()).slice(0, 300) })),
              }
            : undefined,
        },
      ],
    },
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

/**
 * Reports an error when a DSN is configured; never throws and never blocks
 * for long (2s timeout). Returns true when an event was sent.
 */
export async function reportError(error: unknown, ctx: ErrorContext = {}, dsnValue: string | undefined = currentDsn()): Promise<boolean> {
  const dsn = parseDsn(dsnValue);
  if (!dsn || typeof fetch !== "function") return false;
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 2000) : null;
    const res = await fetch(envelopeUrl(dsn), {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: buildEnvelope(error, ctx),
      signal: controller?.signal,
      keepalive: true,
    });
    if (timer) clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
