"use client";

// Interactive islands for the server-rendered landing page:
//   • LandingShell    — the scroll-snap container, reveal-on-scroll, keyboard scrolling
//   • LandingNav      — floating pill nav (inline links ≥768px, menu below), auth-aware CTA
//   • BackgroundVideo — lazy, poster-first ambient video
// Everything else on the page is static HTML rendered on the server.

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";

// ─── Scroll container ────────────────────────────────────────────────────────

export function LandingShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Desktop only: the snap container is the scroller, so stop the document
  // itself from rubber-banding behind it. Phones keep normal behaviour.
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Native keyboard scrolling (Space, PageDown, arrows) acts on the focused
  // scroller — give the container focus unless something else already has it.
  useEffect(() => {
    const el = ref.current;
    if (el && (document.activeElement === document.body || document.activeElement === null)) {
      el.focus({ preventScroll: true });
    }
  }, []);

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
    <div
      ref={ref}
      tabIndex={-1}
      className="landing-snap-container"
      style={{ outline: "none", position: "relative", overflowX: "hidden", background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
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
        const role =
          (profile as { role?: string } | null)?.role ??
          (user.user_metadata as { role?: string } | undefined)?.role ??
          null;
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
      href={switchLocale(pathname || `/${locale}/landing`, otherLocale)}
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
    <div className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:pt-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <nav
        aria-label={t.landing.navPrimary}
        className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 py-2.5 ps-5 pe-2.5 backdrop-blur"
        style={{ boxShadow: "0 0 24px 0 rgba(166,124,61,0.15)" }}
      >
        <Link
          href={href("/landing")}
          aria-label={t.landing.homeLink}
          dir="ltr"
          className="rounded-md text-[18px] font-bold text-[var(--text-primary)] no-underline"
          style={{ fontFamily: "var(--font-bdo-grotesk), system-ui, sans-serif", letterSpacing: "0.008em" }}
        >
          Halaqy<span className="text-[var(--accent-brass)]">.</span>
        </Link>

        {/* Inline links — tablets and up */}
        <ul className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="nav-link text-[15px]">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {languageLink("btn btn-ghost hidden md:inline-flex !min-h-[40px] !px-3 !text-[14px]")}
          {viewer.status === "guest" && (
            <Link href={href("/auth/login")} className="btn btn-ghost hidden md:inline-flex !min-h-[40px] !px-3 !text-[14px]">
              {t.landing.navLogin}
            </Link>
          )}
          <Link
            href={cta.href}
            className="btn btn-primary hidden md:inline-flex !min-h-[44px] !rounded-full !px-6 !text-[14px] !font-bold"
            aria-busy={viewer.status === "loading" || undefined}
          >
            {cta.label}
          </Link>

          {/* Phones: language + menu toggle */}
          {languageLink("btn btn-ghost md:hidden !min-h-[44px] !px-3 !text-[14px]")}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? t.landing.navMenuClose : t.landing.navMenuOpen}
            aria-expanded={menuOpen}
            aria-controls={panelId}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] md:hidden"
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {/* Menu panel — phones only */}
      <div
        id={panelId}
        ref={panelRef}
        hidden={!menuOpen}
        className="mx-auto mt-3 max-w-[1100px] md:hidden"
      >
        <div className="fade-slide-up flex flex-col gap-1 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 shadow-[0_24px_60px_-20px_rgba(28,22,17,0.22)]">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => closeMenu()}
                  className="block rounded-lg px-2 py-3 text-[16px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
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
                  className="block rounded-lg px-2 py-3 text-[16px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                  {t.landing.navLogin}
                </Link>
              </li>
            )}
          </ul>
          <div className="my-2 h-px bg-[var(--border-subtle)]" />
          <Link
            href={cta.href}
            onClick={() => closeMenu()}
            className="btn btn-primary w-full !min-h-[48px] !rounded-full !text-[15px] !font-bold"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
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
