"use client";

// Consumer header for the marketplace home and search pages: wordmark,
// Explore, For business, language switch and an auth-aware action
// (Sign in · My bookings · Dashboard). Phones get a compact menu.

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type Viewer = { status: "loading" | "guest" | "signed-in"; role: string | null };

/** Session + authoritative role (profiles.role). Never throws. */
export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>({ status: "loading", role: null });
  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        const user = data?.user ?? null;
        if (!user) {
          if (alive) setViewer({ status: "guest", role: null });
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        const role =
          (profile as { role?: string } | null)?.role ?? (user.user_metadata as { role?: string } | undefined)?.role ?? null;
        if (alive) setViewer({ status: "signed-in", role });
      })
      .catch(() => alive && setViewer({ status: "guest", role: null }));
    return () => {
      alive = false;
    };
  }, []);
  return viewer;
}

export function SiteHeader({ sticky = true, className }: { sticky?: boolean; className?: string }) {
  const { t, locale, href, switchLocale } = useTranslation();
  const S = t.search;
  const pathname = usePathname() || `/${locale}/landing`;
  const router = useRouter();
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const other = locale === "ar" ? "en" : "ar";
  const languageHref = switchLocale(pathname, other);
  // Keep the current search (filters live in the query string) when switching language.
  const onLanguage = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const qs = typeof window !== "undefined" ? window.location.search : "";
    if (!qs) return;
    e.preventDefault();
    router.push(`${languageHref}${qs}`);
  };

  const signedIn = viewer.status === "signed-in";
  const action = signedIn
    ? viewer.role === "customer"
      ? { href: href("/customer"), label: t.explore.myBookings }
      : { href: href("/"), label: t.sidebar.dashboard }
    : { href: href("/customer/login"), label: t.explore.signIn };

  const links = [
    { href: href("/explore"), label: t.explore.navExplore },
    { href: href("/for-business"), label: S.forBusinessNav },
  ];

  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!panelRef.current?.contains(n) && !toggleRef.current?.contains(n)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  return (
    <header
      className={cn(
        "z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 backdrop-blur",
        sticky && "sticky top-0",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <nav aria-label={t.landing.navPrimary} className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4">
        <Link
          href={href("/landing")}
          aria-label={S.homeLink}
          dir="ltr"
          className="focus-ring rounded-md text-[19px] font-bold text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-bdo-grotesk), system-ui, sans-serif" }}
        >
          Halaqy<span className="text-[var(--accent-brass)]">.</span>
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                className="nav-link text-[15px] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--text-primary)]"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <Link
            href={languageHref}
            hrefLang={other}
            lang={other}
            onClick={onLanguage}
            aria-label={t.landing.switchLanguage}
            className="btn btn-ghost !min-h-[40px] !px-3 !text-[14px]"
          >
            {t.topbar.language}
          </Link>
          <Link
            href={action.href}
            aria-busy={viewer.status === "loading" || undefined}
            className="btn btn-secondary hidden !min-h-[40px] !rounded-full !px-5 !text-[14px] md:inline-flex"
          >
            {action.label}
          </Link>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t.landing.navMenuClose : t.landing.navMenuOpen}
            aria-expanded={open}
            aria-controls={panelId}
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] md:hidden"
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div id={panelId} ref={panelRef} hidden={!open} className="border-t border-[var(--border-subtle)] px-4 pb-4 md:hidden">
        <ul className="flex flex-col pt-2">
          {[...links, action].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => close()}
                className="block rounded-lg px-2 py-3 text-[16px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

export default SiteHeader;
