import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/landing",
  "/signup",
  "/join",
  "/auth",
  "/api/invite",
  "/api/booking",
  // Customer-facing browsing — guests can view but booking requires login
  "/explore",
  "/shop",
  "/book",
  "/customer/explore",
  "/customer/shops",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static/public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
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
    url.pathname = pathname === "/" ? "/landing" : "/auth/login";
    const nextPath = pathname + (request.nextUrl.search || "");
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
      if (!allowedPrefixes.some((p) => pathname.startsWith(p))) {
        // For root, redirect to customer portal
        return NextResponse.redirect(new URL("/customer", request.url));
      }
    }

    // Non-customers: block customer-only routes
    if (role !== "customer" && pathname.startsWith("/customer")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
