"use client";

// Consumer header for the marketplace home and search pages (§5.9): wordmark,
// Explore, For business, language switch and an auth-aware action
// (Sign in · My bookings · Dashboard). Phones get a compact menu panel.
//
// `transparentAtTop` lets the home hero show through until the page scrolls
// 8px; the bar then gains its card background and hairline.

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe, Menu, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buttonClasses, focusRing } from "@/components/ui/recipes";
import { Wordmark } from "./site-footer";

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
        const role = (profile as { role?: string } | null)?.role ?? (user.user_metadata as { role?: string } | undefined)?.role ?? null;
        if (alive) setViewer({ status: "signed-in", role });
      })
      .catch(() => alive && setViewer({ status: "guest", role: null }));
    return () => {
      alive = false;
    };
  }, []);
  return viewer;
}

function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

export function SiteHeader({
  sticky = true,
  transparentAtTop = false,
  className,
}: {
  sticky?: boolean;
  /** Home hero: no background until the page scrolls. */
  transparentAtTop?: boolean;
  className?: string;
}) {
  const { t, locale, href, switchLocale } = useTranslation();
  const S = t.search;
  const pathname = usePathname() || `/${locale}/landing`;
  const router = useRouter();
  const viewer = useViewer();
  const scrolled = useScrolled();
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

  const solid = !transparentAtTop || scrolled || open;

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        "z-40 border-b transition-[background-color,border-color,box-shadow] duration-200 ease-standard motion-reduce:transition-none",
        solid ? "border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75" : "border-transparent bg-transparent",
        sticky && "sticky top-0",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <nav aria-label={t.landing.navPrimary} className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={href("/landing")} aria-label={S.homeLink} className={cn("shrink-0 rounded-lg", focusRing)}>
          <Wordmark />
        </Link>

        <ul className="ms-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                className={buttonClasses({
                  variant: "ghost",
                  size: "sm",
                  className: "text-[15px] aria-[current=page]:bg-sunken aria-[current=page]:text-ink",
                })}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ms-auto flex items-center gap-1.5">
          <Link
            href={languageHref}
            hrefLang={other}
            lang={other}
            onClick={onLanguage}
            aria-label={t.landing.switchLanguage}
            className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10 px-3" })}
          >
            <Globe aria-hidden="true" />
            {t.topbar.language}
          </Link>
          <Link
            href={action.href}
            aria-busy={viewer.status === "loading" || undefined}
            className={buttonClasses({ variant: "secondary", size: "sm", className: "hidden h-10 px-4 md:inline-flex" })}
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
            className={buttonClasses({ variant: "ghost", size: "icon", className: "text-ink md:hidden" })}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div id={panelId} ref={panelRef} hidden={!open} className="px-4 pb-4 md:hidden">
        <div className="fade-slide-up rounded-2xl border border-line bg-card p-2 shadow-float">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => close()}
                  aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-sunken aria-[current=page]:font-semibold",
                    focusRing,
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mx-3 my-2 h-px bg-line" />
          <Link
            href={action.href}
            onClick={() => close()}
            aria-busy={viewer.status === "loading" || undefined}
            className={buttonClasses({ variant: "primary", size: "lg", fullWidth: true })}
          >
            {action.label}
          </Link>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
