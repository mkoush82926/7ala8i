import { redirect } from "next/navigation";
import { normalizeAuthLocale, safeNextPath } from "../auth/safe-next";

// Permanently redirect /login → /auth/login (keeping a safe ?next=).
export default async function LoginRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  const safe = safeNextPath(Array.isArray(next) ? next[0] : next, "");
  redirect(`/${normalizeAuthLocale(locale)}/auth/login${safe ? `?next=${encodeURIComponent(safe)}` : ""}`);
}
