import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

// ═══════════════════════════════════════════════════════
// API response helpers
//
// Every error body has the same shape and NEVER contains raw Postgres /
// PostgREST / Supabase error objects:
//   { success: false, error: string, code: ApiErrorCode, requestId?, fieldErrors?, retryAfter? }
// `error` is a short English fallback; UIs should render the localized text
// for `code` (t.error.codes[code]) and fall back to t.error.message.
// Internal details are logged server-side via logServerError() with the same
// requestId so support can correlate a user report with the log line.
// ═══════════════════════════════════════════════════════

/** Error codes raised by the database RPCs (RAISE EXCEPTION '<CODE>' USING ERRCODE='P0001'). */
export const DB_ERROR_CODES = [
  "INVALID_INPUT",
  "SHOP_NOT_FOUND",
  "SERVICE_INVALID",
  "BARBER_INVALID",
  "SLOT_IN_PAST",
  "TOO_FAR_AHEAD",
  "OUTSIDE_WORKING_HOURS",
  "SLOT_TAKEN",
  "NO_BARBER_AVAILABLE",
  "RATE_LIMITED",
  "NOT_AUTHENTICATED",
  "NOT_AUTHORIZED",
  "APPT_NOT_FOUND",
  "INVALID_STATUS",
  "INVALID_TRANSITION",
  "ALREADY_STARTED",
  "INSIDE_CANCELLATION_WINDOW",
  "REVIEW_NOT_ALLOWED",
  "ALREADY_REVIEWED",
  "INVITE_INVALID",
  "INVITE_USED",
  "INVITE_EXPIRED",
  "LAST_ADMIN",
] as const;
export type DbErrorCode = (typeof DB_ERROR_CODES)[number];

/** Codes produced by the API layer itself. */
export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NO_SHOP",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL",
] as const;
export type ApiErrorCode = DbErrorCode | (typeof API_ERROR_CODES)[number];

const ERROR_TABLE: Record<ApiErrorCode, { status: number; message: string }> = {
  // database
  INVALID_INPUT: { status: 400, message: "Some of the details are invalid. Please check and try again." },
  SHOP_NOT_FOUND: { status: 404, message: "This shop could not be found." },
  SERVICE_INVALID: { status: 422, message: "One of the selected services is no longer available." },
  BARBER_INVALID: { status: 422, message: "The selected barber is not available at this shop." },
  SLOT_IN_PAST: { status: 422, message: "This time has already passed. Please pick another time." },
  TOO_FAR_AHEAD: { status: 422, message: "Bookings can only be made up to 90 days ahead." },
  OUTSIDE_WORKING_HOURS: { status: 409, message: "The shop is closed at this time. Please pick another time." },
  SLOT_TAKEN: { status: 409, message: "This time was just booked. Please pick another time." },
  NO_BARBER_AVAILABLE: { status: 409, message: "No barber is free at this time. Please pick another time." },
  RATE_LIMITED: { status: 429, message: "Too many attempts. Please wait a moment and try again." },
  NOT_AUTHENTICATED: { status: 401, message: "Please sign in to continue." },
  NOT_AUTHORIZED: { status: 403, message: "You don't have permission to do that." },
  APPT_NOT_FOUND: { status: 404, message: "Appointment not found." },
  INVALID_STATUS: { status: 409, message: "This appointment can no longer be changed." },
  INVALID_TRANSITION: { status: 409, message: "This status change isn't allowed." },
  ALREADY_STARTED: { status: 409, message: "This appointment has already started." },
  INSIDE_CANCELLATION_WINDOW: { status: 409, message: "It's too late to cancel online. Please contact the shop." },
  REVIEW_NOT_ALLOWED: { status: 409, message: "You can review an appointment once it is completed." },
  ALREADY_REVIEWED: { status: 409, message: "You have already reviewed this appointment." },
  INVITE_INVALID: { status: 404, message: "This invite link is invalid." },
  INVITE_USED: { status: 409, message: "This invite has already been used." },
  INVITE_EXPIRED: { status: 410, message: "This invite has expired. Ask the shop for a new link." },
  LAST_ADMIN: { status: 409, message: "A shop must keep at least one admin." },
  // api
  VALIDATION_FAILED: { status: 400, message: "Some of the details are invalid. Please check and try again." },
  UNAUTHORIZED: { status: 401, message: "Please sign in to continue." },
  FORBIDDEN: { status: 403, message: "You don't have permission to do that." },
  NO_SHOP: { status: 403, message: "Your account is not linked to a shop." },
  NOT_FOUND: { status: 404, message: "Not found." },
  CONFLICT: { status: 409, message: "This conflicts with existing data." },
  INTERNAL: { status: 500, message: "Something went wrong. Please try again." },
};

export function errorInfo(code: ApiErrorCode): { status: number; message: string } {
  return ERROR_TABLE[code];
}

function defaultCodeForStatus(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL";
  return "VALIDATION_FAILED";
}

// ─── Standard API Response Shape ───
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: ApiErrorCode;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
  retryAfter?: number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiErrorOptions {
  code?: ApiErrorCode;
  /** Validation messages per field (never echo submitted values). */
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
  /** Seconds; also sets the Retry-After header. */
  retryAfter?: number;
  headers?: Record<string, string>;
}

export function apiResponse<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json({ success: true, data } satisfies ApiSuccessResponse<T>, { status, headers });
}

function isZodFlatten(value: unknown): value is { fieldErrors: Record<string, string[] | undefined> } {
  return (
    !!value &&
    typeof value === "object" &&
    "fieldErrors" in value &&
    !("code" in value) &&
    typeof (value as { fieldErrors: unknown }).fieldErrors === "object"
  );
}

function cleanFieldErrors(input: Record<string, unknown>): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(input)) {
    if (Array.isArray(val)) {
      const msgs = val.filter((m): m is string => typeof m === "string").slice(0, 5);
      if (msgs.length) out[key] = msgs;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Client-safe error response.
 * Third argument: ApiErrorOptions, or (legacy) a zod `error.flatten()` result,
 * whose fieldErrors are kept. Any other value is ignored — raw DB errors are
 * never serialized.
 */
export function apiError(message: string, status = 400, options?: ApiErrorOptions | unknown) {
  let opts: ApiErrorOptions = {};
  if (isZodFlatten(options)) {
    opts = { fieldErrors: cleanFieldErrors(options.fieldErrors) };
  } else if (options && typeof options === "object") {
    const o = options as ApiErrorOptions;
    opts = {
      code: typeof o.code === "string" && o.code in ERROR_TABLE ? o.code : undefined,
      fieldErrors: o.fieldErrors ? cleanFieldErrors(o.fieldErrors) : undefined,
      requestId: typeof o.requestId === "string" ? o.requestId : undefined,
      retryAfter: typeof o.retryAfter === "number" ? o.retryAfter : undefined,
      headers: o.headers,
    };
  }

  const body: ApiErrorResponse = {
    success: false,
    error: message,
    code: opts.code ?? defaultCodeForStatus(status),
  };
  if (opts.requestId) body.requestId = opts.requestId;
  if (opts.fieldErrors) body.fieldErrors = opts.fieldErrors;
  if (opts.retryAfter !== undefined) body.retryAfter = Math.max(0, Math.ceil(opts.retryAfter));

  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (body.retryAfter !== undefined) headers["Retry-After"] = String(body.retryAfter);

  return NextResponse.json(body, { status, headers });
}

/** Error response for a known code, using the standard status + English fallback. */
export function apiErrorCode(code: ApiErrorCode, options: Omit<ApiErrorOptions, "code"> = {}) {
  const info = ERROR_TABLE[code];
  return apiError(info.message, info.status, { ...options, code });
}

/** 400 with field errors from a zod error (messages only). */
export function apiValidationError(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = error.issues[0]?.message ?? ERROR_TABLE.VALIDATION_FAILED.message;
  return apiError(first, 400, { code: "VALIDATION_FAILED", fieldErrors });
}

// ─── Server-side logging ───

export function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 6).join("\n") };
  }
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return { code: e.code, message: e.message, details: e.details, hint: e.hint };
  }
  return { message: String(err) };
}

/**
 * Logs an error with context as one structured line and returns a requestId
 * to hand back to the client. Never put secrets or full request bodies in `extra`.
 */
export function logServerError(context: string, err: unknown, extra?: Record<string, unknown>): string {
  const requestId = (extra?.requestId as string | undefined) ?? newRequestId();
  console.error(
    JSON.stringify({ level: "error", context, requestId, error: describeError(err), ...(extra ?? {}), at: new Date().toISOString() }),
  );
  return requestId;
}

/** Logs `err` and returns a generic 500 (never leaks internals). */
export function serverError(context: string, err: unknown, extra?: Record<string, unknown>) {
  const requestId = logServerError(context, err, extra);
  return apiError(ERROR_TABLE.INTERNAL.message, 500, { code: "INTERNAL", requestId });
}

// ─── Database / RPC error mapping ───

export interface MappedDbError {
  status: number;
  code: ApiErrorCode;
  message: string;
  /** True when the error is unexpected and should be logged as a 500. */
  internal: boolean;
}

// Legacy free-text messages from the pre-hardening RPCs.
const LEGACY_MESSAGES: Array<[RegExp, DbErrorCode]> = [
  [/not authenticated/i, "NOT_AUTHENTICATED"],
  [/not authorized/i, "NOT_AUTHORIZED"],
  [/appointment not found/i, "APPT_NOT_FOUND"],
  [/cannot cancel/i, "INVALID_STATUS"],
  [/already been used/i, "INVITE_USED"],
  [/invite has expired/i, "INVITE_EXPIRED"],
  [/invalid or expired invite/i, "INVITE_INVALID"],
];

/** Maps a Supabase/PostgREST error to a client-safe code + status. */
export function mapDbError(err: unknown): MappedDbError {
  const e = (err && typeof err === "object" ? err : {}) as { code?: unknown; message?: unknown };
  const pgCode = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message.trim() : "";

  const known = (DB_ERROR_CODES as readonly string[]).includes(message) ? (message as DbErrorCode) : null;
  let code: ApiErrorCode | null = known;

  if (!code) {
    if (pgCode === "23P01") code = "SLOT_TAKEN"; // exclusion_violation (overlap)
    else if (pgCode === "23505") code = "CONFLICT"; // unique_violation
    else if (pgCode === "23503" || pgCode === "23514" || pgCode === "22P02" || pgCode === "22023") code = "INVALID_INPUT";
    else if (pgCode === "42501") code = "FORBIDDEN"; // insufficient_privilege / RLS
    else if (pgCode === "PGRST116") code = "NOT_FOUND"; // .single() with 0 rows
    else if (pgCode === "PGRST301" || pgCode === "PGRST302") code = "UNAUTHORIZED"; // JWT problems
    else {
      for (const [re, c] of LEGACY_MESSAGES) {
        if (re.test(message)) {
          code = c;
          break;
        }
      }
    }
  }

  if (!code) {
    return { status: 500, code: "INTERNAL", message: ERROR_TABLE.INTERNAL.message, internal: true };
  }
  const info = ERROR_TABLE[code];
  return { status: info.status, code, message: info.message, internal: false };
}

/** Maps a DB/RPC error to a response; unexpected ones are logged and become a generic 500. */
export function dbErrorResponse(context: string, err: unknown, extra?: Record<string, unknown>) {
  const mapped = mapDbError(err);
  if (mapped.internal) return serverError(context, err, extra);
  return apiError(mapped.message, mapped.status, { code: mapped.code });
}

// ─── Auth wrapper for protected API routes ───

export interface AuthContext {
  user: { id: string; email?: string };
  /** The caller's shop. Always a string when requireShop is true (the default). */
  shopId: string;
  role: UserRole;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  requestId: string;
}

type AuthenticatedHandler = (req: Request, context: AuthContext) => Promise<NextResponse>;

export interface WithAuthOptions {
  /** Allowed roles. Default: staff only (shop_admin, barber). */
  roles?: readonly UserRole[];
  /** Require profile.shop_id (403 NO_SHOP when missing). Default true. */
  requireShop?: boolean;
}

export function withAuth(handler: AuthenticatedHandler, options: WithAuthOptions = {}) {
  const roles: readonly UserRole[] = options.roles ?? ["shop_admin", "barber"];
  const requireShop = options.requireShop ?? true;

  return async (req: Request) => {
    const requestId = newRequestId();
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return apiErrorCode("UNAUTHORIZED", { requestId });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
        .select("shop_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return apiErrorCode("FORBIDDEN", { requestId });
      }

      const role = profile.role as UserRole;
      if (!roles.includes(role)) {
        return apiErrorCode("FORBIDDEN", { requestId });
      }
      if (requireShop && !profile.shop_id) {
        return apiErrorCode("NO_SHOP", { requestId });
      }

      return await handler(req, {
        user: { id: user.id, email: user.email },
        shopId: profile.shop_id ?? "",
        role,
        supabase,
        requestId,
      });
    } catch (err) {
      return serverError("withAuth", err, { requestId, path: safePath(req.url) });
    }
  };
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}
