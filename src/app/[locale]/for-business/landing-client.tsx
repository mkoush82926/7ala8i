"use client";

// Interactive islands for the server-rendered for-business page (§6.10):
//   • LandingShell    — page wrapper with reveal-on-scroll (normal document scrolling)
//   • LandingNav      — sticky marketing nav (inline links ≥768px, menu below), auth-aware CTA
//   • BackgroundVideo — lazy, poster-first ambient video
// Everything else on the page is static HTML rendered on the server.

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buttonClasses, focusRing } from "@/components/ui/recipes";
import { Wordmark } from "@/components/search/site-footer";

// ─── Scroll container ────────────────────────────────────────────────────────

export function LandingShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Reveal-on-scroll for every `.reveal` block (CSS in globals.css; reduced
  // motion shows them immediately).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (typeof IntersectionObserver === "undefined") {
      nodes.forEach((n) => n.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative min-h-dvh overflow-x-clip bg-page text-ink">
      {children}
    </div>
  );
}

// ─── Auth-aware navigation ───────────────────────────────────────────────────

type Viewer = { status: "loading" | "guest" | "signed-in"; role: string | null };

function useViewer(): Viewer {
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
        // The authoritative role lives in profiles (invited staff keep a
        // "customer" signup role in their user metadata).
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

export function LandingNav() {
  const { t, locale, href, switchLocale } = useTranslation();
  const pathname = usePathname();
  const viewer = useViewer();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const otherLocale = locale === "ar" ? "en" : "ar";
  const signedIn = viewer.status === "signed-in";
  const isCustomer = signedIn && viewer.role === "customer";

  const cta = signedIn
    ? isCustomer
      ? { href: href("/customer"), label: t.explore.navBookings }
      : { href: href("/"), label: t.sidebar.dashboard }
    : { href: href("/auth/signup"), label: t.landing.getStarted };

  const links = [
    { href: href("/explore"), label: t.landing.navFindBarber },
    { href: "#features", label: t.landing.navFeatures },
    { href: "#pricing", label: t.landing.navPricing },
  ];

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // Escape closes; clicking outside closes; first link gets focus on open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu(true);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !toggleRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen, closeMenu]);

  const languageLink = (className: string) => (
    <Link
      href={switchLocale(pathname || `/${locale}/for-business`, otherLocale)}
      hrefLang={otherLocale}
      lang={otherLocale}
      aria-label={t.landing.switchLanguage}
      className={className}
      onClick={() => setMenuOpen(false)}
    >
      {t.topbar.language}
    </Link>
  );

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <nav aria-label={t.landing.navPrimary} className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={href("/landing")} aria-label={t.landing.homeLink} className={cn("shrink-0 rounded-lg", focusRing)}>
          <Wordmark />
        </Link>

        {/* Inline links — tablets and up */}
        <ul className="ms-4 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={buttonClasses({ variant: "ghost", size: "sm", className: "text-[15px]" })}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          {languageLink(buttonClasses({ variant: "ghost", size: "sm", className: "h-10 px-3" }))}
          {viewer.status === "guest" && (
            <Link
              href={href("/auth/login")}
              className={buttonClasses({ variant: "ghost", size: "sm", className: "hidden h-10 px-3 md:inline-flex" })}
            >
              {t.landing.navLogin}
            </Link>
          )}
          <Link
            href={cta.href}
            className={buttonClasses({ variant: "primary", size: "sm", className: "hidden h-10 px-5 md:inline-flex" })}
            aria-busy={viewer.status === "loading" || undefined}
          >
            {cta.label}
          </Link>

          {/* Phones: menu toggle */}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? t.landing.navMenuClose : t.landing.navMenuOpen}
            aria-expanded={menuOpen}
            aria-controls={panelId}
            className={buttonClasses({ variant: "ghost", size: "icon", className: "text-ink md:hidden" })}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {/* Menu panel — phones only */}
      <div id={panelId} ref={panelRef} hidden={!menuOpen} className="px-4 pb-4 md:hidden">
        <div className="fade-slide-up flex flex-col rounded-2xl border border-line bg-card p-2 shadow-float">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => closeMenu()}
                  className={cn("flex h-12 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-sunken", focusRing)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            {viewer.status === "guest" && (
              <li>
                <Link
                  href={href("/auth/login")}
                  onClick={() => closeMenu()}
                  className={cn("flex h-12 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-sunken", focusRing)}
                >
                  {t.landing.navLogin}
                </Link>
              </li>
            )}
          </ul>
          <div className="mx-3 my-2 h-px bg-line" />
          <Link href={cta.href} onClick={() => closeMenu()} className={buttonClasses({ variant: "primary", size: "lg", fullWidth: true })}>
            {cta.label}
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Ambient background video ────────────────────────────────────────────────

function shouldStream(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
  return true;
}

/**
 * Blurred, dimmed footage behind a section. Ships only a small poster up
 * front (`preload="none"`); the MP4 is attached once the section is near the
 * viewport, and never for reduced-motion / Save-Data / 2G visitors (they keep
 * the poster). Pauses while off-screen.
 */
export function BackgroundVideo({ src, poster, overlay }: { src: string; poster: string; overlay: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeSrc, setActiveSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !shouldStream() || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveSrc(src);
          el.play().catch(() => {});
        } else if (!el.paused) {
          el.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  // The `autoPlay` attribute isn't reliable once React owns the element, so
  // start playback explicitly after the source is attached.
  useEffect(() => {
    if (activeSrc) videoRef.current?.play().catch(() => {});
  }, [activeSrc]);

  return (
    <>
      <video
        ref={videoRef}
        src={activeSrc}
        poster={poster}
        preload="none"
        loop
        muted
        playsInline
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
          filter: "blur(4px) saturate(0.8)",
          transform: "scale(1.08)",
          pointerEvents: "none",
        }}
      />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: overlay, zIndex: 0 }} />
    </>
  );
}
