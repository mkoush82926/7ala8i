"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { useModalBehavior } from "@/components/ui/dialog";
import { toast, clearToasts } from "@/components/ui/toast";
import {
  RAIL_GROUPS,
  isNavActive,
  navLabel,
  stripLocale,
  toShellRole,
  visibleNavItems,
  type NavItem,
  type ShellRole,
} from "@/components/layout/nav-config";

/**
 * Role known to the shell. Until the workspace store has hydrated we do not
 * know the role (the store defaults to "shop_admin"), so only the pages every
 * staff role can open are shown — admin-only entries appear once confirmed.
 */
export function useShellRole(): ShellRole | null {
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const role = useWorkspaceStore((s) => s.role);
  return hydrated ? toShellRole(role) : null;
}

/** Sign out with feedback; shared by the rail, the drawer and the topbar menu. */
export function useSignOut(onDone?: () => void) {
  const router = useRouter();
  const { t, href } = useTranslation();
  const [busy, setBusy] = React.useState(false);

  const signOut = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      onDone?.();
      clearToasts();
      toast.success(t.sidebar.signedOut);
      router.replace(href("/auth/login"));
      router.refresh();
    } catch {
      toast.error(t.sidebar.signOutFailed);
    } finally {
      setBusy(false);
    }
  }, [busy, href, onDone, router, t]);

  return { signOut, busy };
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  const { t, isRTL, FFD } = useTranslation();
  if (compact) {
    return (
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-[10px] bg-[var(--brand-primary)] text-[16px] font-extrabold text-[var(--brand-on-primary)]"
        style={{ fontFamily: FFD }}
      >
        {t.sidebar.brand.charAt(0)}
      </span>
    );
  }
  return (
    <div>
      <p
        className="m-0 text-[22px] font-extrabold leading-none text-[var(--text-primary)]"
        style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.012em") }}
      >
        {t.sidebar.brand}
      </p>
      <p
        className={cn(
          "m-0 mt-2 text-[11px] font-bold text-[var(--text-muted)]",
          !isRTL && "uppercase tracking-[0.18em]",
        )}
      >
        {t.sidebar.tagline}
      </p>
    </div>
  );
}

/* ─── Mobile / tablet drawer content: the full labelled list ─── */
function DrawerContent({ onClose, titleId }: { onClose: () => void; titleId: string }) {
  const { t, href, isRTL } = useTranslation();
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const role = useShellRole();
  const { signOut, busy } = useSignOut(onClose);
  const items = visibleNavItems(role);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 px-6 pb-6 pt-8">
        <div id={titleId}>
          <Wordmark />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="-me-2 grid size-11 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] lg:hidden"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label={t.sidebar.mainNav} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4">
        {items.map((item) => {
          const active = isNavActive(item.href, path);
          return (
            <Link
              key={item.id}
              href={href(item.href)}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-[14px] font-semibold no-underline transition-colors",
                active
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
              )}
              style={{ letterSpacing: headingTracking(isRTL, "0.01em") }}
            >
              <item.icon size={18} className="shrink-0" aria-hidden="true" />
              <span>{navLabel(t, item.id)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-5 pb-8 pt-6">
        <div className="mb-5 h-px bg-[var(--border-subtle)]" />
        <Link
          href={href("/calendar")}
          onClick={onClose}
          className="btn btn-primary mb-3 w-full justify-center"
        >
          <CalendarPlus size={16} aria-hidden="true" />
          {t.sidebar.bookAppointment}
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          aria-busy={busy || undefined}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-rose)] hover:bg-[var(--accent-rose-muted)] hover:text-[var(--accent-rose)] disabled:opacity-60"
        >
          <LogOut size={14} aria-hidden="true" />
          {t.sidebar.signOut}
        </button>
      </div>
    </div>
  );
}

/* ─── Desktop icon rail (lg+) — related pages grouped behind a flyout ─── */
const railButton =
  "grid size-12 place-items-center rounded-[10px] transition-colors duration-150";

function DesktopIconRail() {
  const { t, href, isRTL } = useTranslation();
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const role = useShellRole();
  const { signOut, busy } = useSignOut();
  const [openFlyout, setOpenFlyout] = React.useState<string | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const flyoutRef = React.useRef<HTMLDivElement>(null);
  const triggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  // Close the flyout when the route changes (derived during render instead of
  // an effect, so there is no extra commit).
  const [prevPath, setPrevPath] = React.useState(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setOpenFlyout(null);
  }

  const allowed = new Set(visibleNavItems(role).map((i) => i.id));
  const groups = RAIL_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => allowed.has(i.id)),
  })).filter((g) => g.items.length > 0);

  React.useEffect(() => {
    if (!openFlyout) return;
    function handlePointer(e: MouseEvent) {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setOpenFlyout(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const id = openFlyout;
        setOpenFlyout(null);
        if (id) triggerRefs.current[id]?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    // Move focus into the panel so keyboard users land on its first link.
    const raf = requestAnimationFrame(() => {
      flyoutRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    });
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      cancelAnimationFrame(raf);
    };
  }, [openFlyout]);

  const openGroup = groups.find((g) => g.id === openFlyout && g.items.length > 1);

  return (
    <div ref={railRef} className="relative flex h-full flex-col">
      <div className="flex justify-center pb-5 pt-6">
        <Link href={href(role === "barber" ? "/my-day" : "/")} aria-label={t.sidebar.brand} className="rounded-[10px]">
          <Wordmark compact />
        </Link>
      </div>

      <nav aria-label={t.sidebar.mainNav} className="flex flex-1 flex-col items-center gap-1.5 px-3 py-2">
        {groups.map((group) => {
          const label = navLabel(t, group.items.length === 1 ? group.items[0].id : group.labelId);
          const current = group.items.some((i) => isNavActive(i.href, path));
          const expanded = openFlyout === group.id;
          const highlighted = current || expanded;
          const cls = cn(
            railButton,
            highlighted
              ? "bg-[var(--brand-primary)] text-[var(--brand-on-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
          );

          if (group.items.length === 1) {
            const item = group.items[0];
            return (
              <Link
                key={group.id}
                href={href(item.href)}
                aria-label={label}
                title={label}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpenFlyout(null)}
                className={cls}
              >
                <group.icon size={20} aria-hidden="true" />
              </Link>
            );
          }

          return (
            <button
              key={group.id}
              type="button"
              ref={(el) => {
                triggerRefs.current[group.id] = el;
              }}
              onClick={() => setOpenFlyout(expanded ? null : group.id)}
              aria-label={label}
              title={label}
              aria-expanded={expanded}
              aria-controls={`rail-flyout-${group.id}`}
              aria-current={current ? "true" : undefined}
              className={cls}
            >
              <group.icon size={20} aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1.5 p-3">
        <div className="mb-2.5 mt-1 h-px w-8 bg-[var(--border-subtle)]" />
        <Link
          href={href("/calendar")}
          aria-label={t.sidebar.bookAppointment}
          title={t.sidebar.bookAppointment}
          className={cn(railButton, "bg-[var(--accent-mint)] text-[var(--on-accent)] hover:opacity-90")}
        >
          <CalendarPlus size={19} aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          aria-busy={busy || undefined}
          aria-label={t.sidebar.signOut}
          title={t.sidebar.signOut}
          className={cn(
            railButton,
            "text-[var(--text-secondary)] hover:bg-[var(--accent-rose-muted)] hover:text-[var(--accent-rose)] disabled:opacity-60",
          )}
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Flyout — floats over content, does not push the layout */}
      <AnimatePresence>
        {openGroup && (
          <motion.div
            key={openGroup.id}
            ref={flyoutRef}
            id={`rail-flyout-${openGroup.id}`}
            role="region"
            aria-label={navLabel(t, openGroup.labelId)}
            initial={{ opacity: 0, x: isRTL ? 12 : -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-y-0 z-[45] w-[220px] border-e border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-7 shadow-[8px_0_24px_-12px_rgba(28,22,17,0.15)]"
            style={{ insetInlineStart: "var(--sidebar-width)" }}
          >
            <p
              className={cn(
                "m-0 mb-4 px-3 text-[11px] font-bold text-[var(--text-muted)]",
                !isRTL && "uppercase tracking-[0.1em]",
              )}
            >
              {navLabel(t, openGroup.labelId)}
            </p>
            {openGroup.items.map((item: NavItem) => {
              const active = isNavActive(item.href, path);
              return (
                <Link
                  key={item.id}
                  href={href(item.href)}
                  onClick={() => setOpenFlyout(null)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mb-0.5 flex min-h-11 items-center rounded-lg px-3 text-[14px] font-semibold no-underline transition-colors",
                    active
                      ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {navLabel(t, item.id)}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Drawer panel (below lg): dialog semantics, focus trap, Escape ─── */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isRTL } = useTranslation();
  const panelRef = React.useRef<HTMLElement>(null);
  const titleId = React.useId();
  useModalBehavior({ open, onClose, containerRef: panelRef });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sidebar-backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[var(--overlay)] lg:hidden"
            onClick={onClose}
          />
          <motion.aside
            key="sidebar-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ x: isRTL ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRTL ? "100%" : "-100%" }}
            transition={{ type: "tween", duration: 0.22, ease: [0.25, 1, 0.4, 1] }}
            className="fixed inset-y-0 start-0 z-50 flex w-[min(18rem,85vw)] flex-col border-e border-[var(--border-subtle)] bg-[var(--bg-primary)] pb-[env(safe-area-inset-bottom)] lg:hidden"
          >
            <DrawerContent onClose={onClose} titleId={titleId} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Sidebar() {
  const isMobileSidebarOpen = useWorkspaceStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const pathname = usePathname();
  const close = React.useCallback(() => setMobileSidebarOpen(false), [setMobileSidebarOpen]);

  // Navigating (links, back/forward, search results) always closes the drawer.
  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  // Growing past the lg breakpoint while open would leave a locked body scroll
  // behind an invisible drawer — close it.
  React.useEffect(() => {
    if (!isMobileSidebarOpen || typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) close();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [isMobileSidebarOpen, close]);

  return (
    <>
      <aside
        className="fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-[var(--border-subtle)] bg-[var(--bg-primary)] lg:flex"
        style={{ width: "var(--sidebar-width)" }}
      >
        <DesktopIconRail />
      </aside>

      <MobileDrawer open={isMobileSidebarOpen} onClose={close} />
    </>
  );
}
