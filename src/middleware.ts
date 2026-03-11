import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/landing", "/book", "/join", "/auth/login", "/auth/signup", "/auth/callback", "/auth/reset-password", "/api/booking", "/api/invite"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  if (!user && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    // Root and landing: show marketing. Other protected routes: require login.
    url.pathname = pathname === "/" ? "/landing" : "/auth/login";
    const nextPath = pathname + (request.nextUrl.search || "");
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  if (user) {
    const role = user.user_metadata?.role;

    if (role === "customer" && !pathname.startsWith("/customer")) {
      const url = request.nextUrl.clone();
      url.pathname = "/customer";
      return NextResponse.redirect(url);
    }

    if (role !== "customer" && pathname.startsWith("/customer")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
