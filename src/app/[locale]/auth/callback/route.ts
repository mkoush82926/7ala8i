import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthLocale, resolveNext } from "../safe-next";

// Landing point for Supabase email links (signup confirmation, magic links).
// `next` is only followed when it is a same-origin relative path — see
// safe-next.ts — so a crafted link can never bounce a freshly signed-in user
// to another site.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { searchParams, origin } = request.nextUrl;
  const { locale: rawLocale } = await params;
  const locale = normalizeAuthLocale(rawLocale);
  const code = searchParams.get("code");
  const target = resolveNext(searchParams.get("next"), locale);

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const url = new URL(target, origin);
        if (url.origin === origin) return NextResponse.redirect(url);
      }
    } catch {
      // fall through to the error redirect
    }
  }

  const errorUrl = new URL(`/${locale}/auth/login`, origin);
  errorUrl.searchParams.set("error", "auth_callback_error");
  return NextResponse.redirect(errorUrl);
}
