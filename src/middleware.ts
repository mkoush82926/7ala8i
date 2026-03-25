import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const LOCALES = ["en", "ar"];
const DEFAULT_LOCALE = "en";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/landing",
  "/signup",
  "/join",
  "/auth",
  "/api/invite",
  "/api/booking",
  "/explore",
  "/shop",
  "/book",
  "/customer/explore",
  "/customer/shops",
];


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets and API
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/favicon.ico') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 1. Determine if the pathname has a locale
  const pathnameHasLocale = LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  let currentLocale = null;
  if (pathnameHasLocale) {
    currentLocale = pathname.split('/')[1];
  }

  // 2. If no locale, redirect to the default locale
  if (!pathnameHasLocale) {
    const localeToUse = request.cookies.get('NEXT_LOCALE')?.value || DEFAULT_LOCALE;
    request.nextUrl.pathname = `/${localeToUse}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // 3. Remove locale prefix from pathname for routing logic
  const pathnameWithoutLocale = pathname.replace(`/${currentLocale}`, '') || '/';

  // Always allow static/public routes
  if (PUBLIC_ROUTES.some((r) => pathnameWithoutLocale.startsWith(r))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in — redirect to login for protected routes
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = pathnameWithoutLocale === "/" ? `/${currentLocale}/landing` : `/${currentLocale}/auth/login`;
    const nextPath = pathnameWithoutLocale + (request.nextUrl.search || "");
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  // Logged in — role-based routing
  if (user) {
    const role = user.user_metadata?.role;

    // Customers: allow all customer/* and browsing routes
    if (role === "customer") {
      const allowedPrefixes = [
        "/customer",
        "/explore",
        "/book",
        "/shop",
        "/api/booking",
        "/auth",
      ];
      if (!allowedPrefixes.some((p) => pathnameWithoutLocale.startsWith(p))) {
        // For root, redirect to customer portal
        return NextResponse.redirect(new URL(`/${currentLocale}/customer`, request.url));
      }
    }

    // Non-customers: block customer-only routes
    if (role !== "customer" && pathnameWithoutLocale.startsWith("/customer")) {
      return NextResponse.redirect(new URL(`/${currentLocale}`, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
