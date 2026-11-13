// ═══════════════════════════════════════════════════════
// Validated environment — the ONLY place that reads process.env for app
// configuration. Safe to import from the browser, Edge middleware and Node.
//
// • NEXT_PUBLIC_* values are referenced explicitly so Next.js inlines them
//   into client bundles.
// • Production (NODE_ENV === "production") fails fast on the server when the
//   Supabase URL/anon key are missing or malformed, unless
//   SKIP_ENV_VALIDATION=1 (e.g. a CI build without secrets).
// • Mock preview mode is refused in production unless
//   NEXT_PUBLIC_ALLOW_MOCK_IN_PROD === "true" is set explicitly. Note this
//   also means a local `next build && next start` runs against real Supabase
//   even if .env.local turns mock mode on — by design.
// ═══════════════════════════════════════════════════════
import { z } from "zod";

export type MockAuthRole = "shop_admin" | "barber" | "customer";

export interface EnvSource {
  NODE_ENV?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_USE_MOCK_DATA?: string;
  NEXT_PUBLIC_MOCK_AUTH_ROLE?: string;
  NEXT_PUBLIC_ALLOW_MOCK_IN_PROD?: string;
}

export interface ResolvedEnv {
  isProduction: boolean;
  /** Mock preview may be used at all in this runtime. */
  mockAllowed: boolean;
  /** Mock preview is active (allowed AND NEXT_PUBLIC_USE_MOCK_DATA=true). */
  mockMode: boolean;
  /** Fake signed-in role for mock mode; always null outside mock mode. */
  mockAuthRole: MockAuthRole | null;
  /** The mock flag was set but refused because this is production. */
  mockRefused: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string | null;
  /** Human-readable problems; empty when valid. */
  errors: string[];
}

const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

const MOCK_ROLES: readonly MockAuthRole[] = ["shop_admin", "barber", "customer"];

/** Pure resolver — exported for tests. Never throws. */
export function resolveEnv(source: EnvSource): ResolvedEnv {
  const isProduction = source.NODE_ENV === "production";
  const mockFlag = source.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const mockAllowed = !isProduction || source.NEXT_PUBLIC_ALLOW_MOCK_IN_PROD === "true";
  const mockMode = mockAllowed && mockFlag;
  const roleRaw = source.NEXT_PUBLIC_MOCK_AUTH_ROLE ?? "";
  const mockAuthRole =
    mockMode && (MOCK_ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as MockAuthRole) : null;

  const errors: string[] = [];
  if (mockFlag && !mockAllowed) {
    errors.push(
      "NEXT_PUBLIC_USE_MOCK_DATA=true is ignored in production (set NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=true to force it).",
    );
  }

  const supa = supabaseSchema.safeParse(source);
  if (!supa.success && !mockMode) {
    for (const issue of supa.error.issues) {
      const field = issue.path.map(String).join(".");
      errors.push(issue.message.startsWith(field) ? issue.message : `${field}: ${issue.message}`);
    }
  }

  const site = optionalUrl.safeParse(source.NEXT_PUBLIC_SITE_URL);
  if (!site.success) errors.push("NEXT_PUBLIC_SITE_URL must be a valid URL when set");

  return {
    isProduction,
    mockAllowed,
    mockMode,
    mockAuthRole,
    mockRefused: mockFlag && !mockAllowed,
    supabaseUrl: supa.success ? supa.data.NEXT_PUBLIC_SUPABASE_URL : (source.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    supabaseAnonKey: supa.success ? supa.data.NEXT_PUBLIC_SUPABASE_ANON_KEY : (source.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
    siteUrl: site.success ? (site.data ?? null) : null,
    errors,
  };
}

const resolved = resolveEnv({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
  NEXT_PUBLIC_MOCK_AUTH_ROLE: process.env.NEXT_PUBLIC_MOCK_AUTH_ROLE,
  NEXT_PUBLIC_ALLOW_MOCK_IN_PROD: process.env.NEXT_PUBLIC_ALLOW_MOCK_IN_PROD,
});

const IS_SERVER = typeof window === "undefined";

if (resolved.errors.length > 0) {
  const message = `[env] Invalid environment:\n  - ${resolved.errors.join("\n  - ")}`;
  const fatal =
    resolved.isProduction &&
    IS_SERVER &&
    process.env.SKIP_ENV_VALIDATION !== "1" &&
    process.env.SKIP_ENV_VALIDATION !== "true" &&
    // A refused mock flag alone is not fatal: the app simply runs for real.
    resolved.errors.some((e) => !e.startsWith("NEXT_PUBLIC_USE_MOCK_DATA"));
  if (fatal) throw new Error(message);
  console.warn(message);
}

export const IS_PRODUCTION = resolved.isProduction;
export const MOCK_ALLOWED = resolved.mockAllowed;
export const MOCK_MODE = resolved.mockMode;
export const MOCK_AUTH_ROLE: MockAuthRole | null = resolved.mockAuthRole;

export const publicEnv = {
  supabaseUrl: resolved.supabaseUrl,
  supabaseAnonKey: resolved.supabaseAnonKey,
  siteUrl: resolved.siteUrl,
} as const;

/**
 * Server-only secrets. Throws if called from browser code so a secret can
 * never be bundled by accident. Returns null for unset values.
 */
export function getServerEnv(): { serviceRoleKey: string | null } {
  if (!IS_SERVER) {
    throw new Error("[env] getServerEnv() must only be called on the server");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return { serviceRoleKey: key ? key : null };
}
