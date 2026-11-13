import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { MOCK_DATA_ENABLED, MOCK_AUTH_ROLE } from "@/lib/mock-data";

// NOTE: Next 16 deprecates the `middleware` file convention in favour of
// `proxy`. This file is intentionally kept as middleware.ts (Edge runtime) —
// it still works and the rename would change the runtime to Node.js.

export const LOCALES = ["en", "ar"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";
const LOCALE_COOKIE_OPTIONS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

/**
 * Pages that never require a session. Matched on whole path segments (see
 * matchesRoute), so "/shop" covers "/shop/123" but NOT "/shops" or
 * "/shop-settings" — a new route is protected unless it is listed here.
 */
export const PUBLIC_ROUTES = [
  "/landing",
  "/login",
  "/signup",
  "/join",
  "/auth",
  "/explore",
  "/shop",
  "/book",
  "/customer/explore",
  "/customer/shops",
  "/terms",
  "/privacy",
  "/policy",
] as const;

/** Where a signed-in customer may go (everything else sends them to /customer). */
export const CUSTOMER_ROUTES = ["/customer", "/explore", "/book", "/shop", "/auth", "/join"] as const;

/** Staff pages only a shop_admin may open; barbers are sent to their day view. */
// Keep in sync with the ADMIN entries in src/components/layout/nav-config.ts.
// RLS remains the real boundary; this only spares barbers dead-end pages.
export const ADMIN_ONLY_ROUTES = ["/settings", "/services", "/team", "/analytics", "/leads"] as const;

type AppRole = "shop_admin" | "barber" | "customer";

/** True when `path` is `route` itself or lies below it ("/shop" ↔ "/shop/1"). */
export function matchesRoute(path: string, route: string): boolean {
  return path === route || path.startsWith(route + "/");
}

export function isPublicPath(path: string): boolean {
  return PUBLIC_ROUTES.some((r) => matchesRoute(path, r));
}

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

function normalizeRole(value: unknown): AppRole | null {
  return value === "shop_admin" || value === "barber" || value === "customer" ? value : null;
}

/**
 * Pure routing decision for a signed-in user. Returns the locale-less path
 * to redirect to, or null to let the request through.
 */
export function roleRedirect(path: string, role: AppRole | null): string | null {
  if (role === "customer") {
    return CUSTOMER_ROUTES.some((r) => matchesRoute(path, r)) ? null : "/customer";
  }
  // Staff (or an unknown role) never see the customer portal.
  if (matchesRoute(path, "/customer")) return "/";
  if (role !== "shop_admin" && ADMIN_ONLY_ROUTES.some((r) => matchesRoute(path, r))) return "/my-day";
  return null;
}

function withLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
  return response;
}

function redirectTo(request: NextRequest, locale: Locale, path: string) {
  const target = new URL(`/${locale}${path === "/" ? "" : path}`, request.url);
  return withLocaleCookie(NextResponse.redirect(target), locale);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and API routes. API handlers authorize themselves
  // (withAuth / RLS / SECURITY DEFINER RPCs) — including the public
  // /api/booking, /api/invite/accept and /api/health endpoints.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 1. Locale prefix
  const segment = pathname.split("/")[1] ?? "";
  if (!isLocale(segment)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const localeToUse: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
    const url = request.nextUrl.clone();
    url.pathname = `/${localeToUse}${pathname === "/" ? "" : pathname}`;
    return withLocaleCookie(NextResponse.redirect(url), localeToUse);
  }
  const currentLocale: Locale = segment;
  const path = pathname.slice(currentLocale.length + 1) || "/";

  // 2. Public pages
  if (isPublicPath(path)) {
    return withLocaleCookie(NextResponse.next(), currentLocale);
  }

  // 3. Local design-preview escape hatch. MOCK_DATA_ENABLED / MOCK_AUTH_ROLE
  //    come from src/lib/env.ts, which refuses mock mode whenever
  //    NODE_ENV === "production" (unless NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=true),
  //    so a stray env var can never ship an unauthenticated dashboard.
  if (MOCK_DATA_ENABLED && MOCK_AUTH_ROLE) {
    const target = roleRedirect(path, MOCK_AUTH_ROLE);
    if (target) return redirectTo(request, currentLocale, target);
    return withLocaleCookie(NextResponse.next({ request }), currentLocale);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
    global: {
      // Never let a stalled Supabase call hang past the middleware's hard
      // execution limit — bail out well before that.
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
    },
  });

  let user: { id: string; user_metadata?: Record<string, unknown> } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Timed out or failed — treat as signed out rather than hanging.
  }

  // 4. Signed out → landing (for "/") or login with a return path
  if (!user) {
    const url = request.nextUrl.clone();
    url.search = "";
    if (path === "/") {
      url.pathname = `/${currentLocale}/landing`;
    } else {
      url.pathname = `/${currentLocale}/auth/login`;
      url.searchParams.set("next", path + (request.nextUrl.search || ""));
    }
    return withLocaleCookie(NextResponse.redirect(url), currentLocale);
  }

  // 5. Role-based routing. The role comes from public.profiles (which users
  //    cannot change), never from user_metadata (which they can). If the
  //    lookup fails, metadata may only ever *narrow* access (route a
  //    self-declared customer to the portal); it never grants a staff role.
  //    Data access is still enforced by RLS.
  let role: AppRole | null = null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = normalizeRole((profile as { role?: unknown } | null)?.role);
  } catch {
    // fall through
  }
  if (!role && normalizeRole(user.user_metadata?.role) === "customer") role = "customer";

  const target = roleRedirect(path, role);
  if (target) {
    const redirect = redirectTo(request, currentLocale, target);
    // Keep any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return withLocaleCookie(response, currentLocale);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
