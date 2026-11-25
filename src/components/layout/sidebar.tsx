"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { create } from "zustand";
import {
  CalendarPlus,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  X,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useThemeStore } from "@/store/theme-store";
import { useTranslation } from "@/hooks/use-translation";
import { useModalBehavior } from "@/components/ui/dialog";
import { toast, clearToasts } from "@/components/ui/toast";
import { ButtonLink } from "@/components/ui/button";
import { focusRing } from "@/components/ui/recipes";
import {
  MOBILE_TAB_IDS,
  NAV_ITEMS,
  NAV_SECTIONS,
  homePathFor,
  isNavActive,
  navLabel,
  stripLocale,
  toShellRole,
  visibleNavItems,
  type NavItem,
  type NavSectionLabel,
  type ShellRole,
} from "@/components/layout/nav-config";
import type { TranslationKeys } from "@/i18n/en";

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

/** Sign out with feedback; shared by the sidebar, the "More" sheet and the topbar menu. */
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

/* ─── Collapsed preference (lg+), persisted per browser ─── */

const COLLAPSE_KEY = "halaqy.sidebar.collapsed";

interface SidebarPrefs {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const useSidebarPrefs = create<SidebarPrefs>()((set) => ({
  collapsed: false,
  setCollapsed: (collapsed) => {
    set({ collapsed });
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage blocked: keep the in-memory value */
    }
  },
}));

/** Read the stored preference after mount (never during SSR, so no hydration mismatch). */
function useHydrateSidebarPrefs() {
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") useSidebarPrefs.setState({ collapsed: true });
    } catch {
      /* ignore */
    }
  }, []);
}

/** Sidebar width for the shell (`--sidebar-width`): 240px labelled, 72px collapsed. */
export function useSidebarWidth(): string {
  const collapsed = useSidebarPrefs((s) => s.collapsed);
  return collapsed ? "72px" : "240px";
}

/* ─── Shared bits ─── */

function sectionLabel(t: TranslationKeys, label: NavSectionLabel): string {
  return label === "schedule" ? t.sidebar.groupSchedule : t.sidebar.groupBusiness;
}

/** Shop initials tile (avatar 32, rounded-lg). */
function ShopTile({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[13px] font-bold text-on-brand",
        className,
      )}
    >
      {getInitials(name) || "H"}
    </span>
  );
}

function useShopIdentity() {
  const { t } = useTranslation();
  const shopName = useWorkspaceStore((s) => s.shopName);
  const role = useShellRole();
  const name = shopName || t.topbar.myShop;
  const roleLabel = role === "barber" ? t.topbar.roleBarber : role === "shop_admin" ? t.topbar.roleAdmin : t.sidebar.brand;
  return { name, roleLabel, role };
}

/** Nav sections filtered to what this role may see. */
function useVisibleSections() {
  const role = useShellRole();
  const allowed = new Set(visibleNavItems(role).map((i) => i.id));
  const byId = new Map(NAV_ITEMS.map((i) => [i.id, i]));
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((id) => allowed.has(id)).map((id) => byId.get(id)!) as NavItem[],
  })).filter((section) => section.items.length > 0);
}

const sideItem = cn(
  "group relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-soft no-underline",
  "transition-colors duration-150 ease-standard motion-reduce:transition-none",
  "hover:bg-sunken hover:text-ink [&_svg]:size-5 [&_svg]:shrink-0",
  "aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-pressed",
  "disabled:pointer-events-none disabled:opacity-45",
  focusRing,
);

/** Label that becomes a hover/focus tooltip when the sidebar is collapsed. */
function ItemLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (!collapsed) return <span className="min-w-0 truncate">{children}</span>;
  return (
    <>
      <span className="sr-only">{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-sm bg-inverse px-2 py-1 text-xs font-medium text-on-inverse opacity-0 shadow-raised transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {children}
      </span>
    </>
  );
}

/* ─── Desktop sidebar (lg+): 240px labelled, collapsible to 72px ─── */

function DesktopSidebar() {
  const { t, href } = useTranslation();
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const collapsed = useSidebarPrefs((s) => s.collapsed);
  const setCollapsed = useSidebarPrefs((s) => s.setCollapsed);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { signOut, busy } = useSignOut();
  const { name, roleLabel, role } = useShopIdentity();
  const sections = useVisibleSections();
  const isDark = theme === "dark";
  const themeLabel = isDark ? t.topbar.switchToLight : t.topbar.switchToDark;
  const collapseLabel = collapsed ? t.sidebar.expand : t.sidebar.collapse;

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className="fixed inset-y-0 start-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-e border-line bg-card transition-[width] duration-200 ease-standard motion-reduce:transition-none lg:flex"
    >
      {/* Header: shop identity */}
      <div className={cn("flex h-16 shrink-0 items-center border-b border-line", collapsed ? "justify-center px-2" : "px-4")}>
        <Link
          href={href(homePathFor(role))}
          className={cn("group relative flex min-w-0 items-center gap-3 rounded-md p-1 no-underline", focusRing)}
        >
          <ShopTile name={name} />
          {collapsed ? (
            <ItemLabel collapsed>{name}</ItemLabel>
          ) : (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{name}</span>
              <span className="block truncate text-xs text-ink-muted">{roleLabel}</span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav
        aria-label={t.sidebar.mainNav}
        className={cn("flex-1 px-3 py-3", collapsed ? "overflow-visible" : "overflow-y-auto overscroll-contain")}
      >
        {sections.map((section, si) => (
          <div key={section.id} className={cn(si > 0 && (collapsed ? "mt-3 border-t border-line pt-3" : "mt-1"))}>
            {section.label && !collapsed && (
              <p className="m-0 px-3 pb-1.5 pt-4 text-xs font-semibold text-ink-muted">{sectionLabel(t, section.label)}</p>
            )}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {section.items.map((item) => {
                const active = isNavActive(item.href, path);
                return (
                  <li key={item.id}>
                    <Link
                      href={href(item.href)}
                      aria-current={active ? "page" : undefined}
                      className={cn(sideItem, collapsed && "justify-center px-0")}
                    >
                      <item.icon aria-hidden="true" className="text-ink-muted group-hover:text-ink group-aria-[current=page]:text-brand-text" />
                      <ItemLabel collapsed={collapsed}>{navLabel(t, item.id)}</ItemLabel>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: theme, sign out, collapse */}
      <div className="flex shrink-0 flex-col gap-0.5 border-t border-line p-3">
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={isDark}
          className={cn(sideItem, collapsed && "justify-center px-0")}
        >
          {isDark ? <Sun aria-hidden="true" className="text-ink-muted" /> : <Moon aria-hidden="true" className="text-ink-muted" />}
          <ItemLabel collapsed={collapsed}>{themeLabel}</ItemLabel>
        </button>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          aria-busy={busy || undefined}
          className={cn(sideItem, "hover:bg-danger-soft hover:text-danger-text", collapsed && "justify-center px-0")}
        >
          <LogOut aria-hidden="true" className="text-ink-muted group-hover:text-danger-text rtl:-scale-x-100" />
          <ItemLabel collapsed={collapsed}>{t.sidebar.signOut}</ItemLabel>
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className={cn(sideItem, collapsed && "justify-center px-0")}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="text-ink-muted rtl:-scale-x-100" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="text-ink-muted rtl:-scale-x-100" />
          )}
          <ItemLabel collapsed={collapsed}>{collapseLabel}</ItemLabel>
        </button>
      </div>
    </aside>
  );
}

/* ─── Mobile bottom tab bar (< lg): Today · Calendar · Queue · Clients · More ─── */

function MobileTabBar({ moreOpen, onMore }: { moreOpen: boolean; onMore: () => void }) {
  const { t, href } = useTranslation();
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const role = useShellRole();
  const allowed = new Set(visibleNavItems(role).map((i) => i.id));
  const home = homePathFor(role);

  const tabs: { key: string; href: string; label: string; icon: NavItem["icon"]; active: boolean }[] = [];
  const homeItem = NAV_ITEMS.find((i) => i.href === home);
  if (homeItem) {
    tabs.push({ key: "home", href: home, label: t.common.today, icon: homeItem.icon, active: isNavActive(home, path) });
  }
  for (const id of MOBILE_TAB_IDS) {
    const item = NAV_ITEMS.find((i) => i.id === id);
    if (!item || !allowed.has(id) || item.href === home) continue;
    tabs.push({
      key: id,
      href: item.href,
      label: id === "queue" ? t.sidebar.queueShort : navLabel(t, id),
      icon: item.icon,
      active: isNavActive(item.href, path),
    });
  }
  const moreActive = !tabs.some((tab) => tab.active);

  const tabCls = cn(
    "group flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold leading-none text-ink-muted no-underline",
    "transition-colors duration-150 motion-reduce:transition-none hover:text-ink",
    focusRing,
    "focus-visible:-outline-offset-2",
  );
  const pillCls =
    "grid h-7 w-12 place-items-center rounded-full transition-colors duration-150 motion-reduce:transition-none [&_svg]:size-[22px]";

  return (
    <nav
      aria-label={t.sidebar.mainNav}
      data-sticky-bar=""
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden"
    >
      <ul className="m-0 grid h-16 list-none p-0" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <li key={tab.key} className="flex">
            <Link
              href={href(tab.href)}
              aria-current={tab.active ? "page" : undefined}
              className={cn(tabCls, "flex-1 aria-[current=page]:text-brand-text")}
            >
              <span className={cn(pillCls, "group-aria-[current=page]:bg-brand-soft")}>
                <tab.icon aria-hidden="true" />
              </span>
              <span className="max-w-full truncate">{tab.label}</span>
            </Link>
          </li>
        ))}
        <li className="flex">
          <button
            type="button"
            onClick={onMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            data-active={moreActive || moreOpen || undefined}
            className={cn(tabCls, "flex-1 data-[active]:text-brand-text")}
          >
            <span className={cn(pillCls, "group-data-[active]:bg-brand-soft")}>
              <Menu aria-hidden="true" />
            </span>
            <span className="max-w-full truncate">{t.sidebar.more}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/* ─── "More" bottom sheet (< lg): every page, plus book / sign out ─── */

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, href } = useTranslation();
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const panelRef = React.useRef<HTMLElement>(null);
  const titleId = React.useId();
  const reduceMotion = useReducedMotion();
  const { signOut, busy } = useSignOut(onClose);
  const { name, roleLabel } = useShopIdentity();
  const sections = useVisibleSections();
  useModalBehavior({ open, onClose, containerRef: panelRef });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="more-backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
            className="fixed inset-0 z-40 bg-overlay lg:hidden"
            onClick={onClose}
          />
          <motion.aside
            key="more-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={reduceMotion ? { duration: 0.12 } : { type: "tween", duration: 0.28, ease: [0.05, 0.7, 0.1, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border-t border-line bg-card pb-[max(16px,env(safe-area-inset-bottom))] shadow-float lg:hidden"
          >
            <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong/60" />

            <div className="flex items-center gap-3 px-5 pb-3 pt-3">
              <ShopTile name={name} className="size-10 rounded-xl text-sm" />
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="m-0 truncate text-base font-semibold text-ink">
                  {name}
                </h2>
                <p className="m-0 truncate text-[13px] text-ink-muted">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.common.close}
                className={cn(
                  "-me-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-sunken hover:text-ink",
                  focusRing,
                )}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={t.sidebar.mainNav} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-3 pb-2">
              {sections.map((section) => (
                <div key={section.id}>
                  {section.label && (
                    <p className="m-0 px-3 pb-1.5 pt-4 text-xs font-semibold text-ink-muted">{sectionLabel(t, section.label)}</p>
                  )}
                  <ul className={cn("m-0 flex list-none flex-col gap-0.5 p-0", !section.label && "pt-3")}>
                    {section.items.map((item) => {
                      const active = isNavActive(item.href, path);
                      return (
                        <li key={item.id}>
                          <Link
                            href={href(item.href)}
                            onClick={onClose}
                            aria-current={active ? "page" : undefined}
                            className={cn(sideItem, "h-12 text-[15px]")}
                          >
                            <item.icon aria-hidden="true" className="text-ink-muted group-aria-[current=page]:text-brand-text" />
                            <span className="min-w-0 truncate">{navLabel(t, item.id)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="grid shrink-0 grid-cols-[1fr_auto] gap-2 border-t border-line px-5 pt-4">
              <ButtonLink
                href={href("/calendar")}
                onClick={onClose}
                variant="primary"
                size="lg"
                icon={<CalendarPlus aria-hidden="true" />}
              >
                {t.sidebar.bookAppointment}
              </ButtonLink>
              <button
                type="button"
                onClick={signOut}
                disabled={busy}
                aria-busy={busy || undefined}
                aria-label={t.sidebar.signOut}
                className={cn(
                  "grid size-12 place-items-center rounded-full border border-line-strong bg-card text-ink-soft transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger-text disabled:opacity-45",
                  focusRing,
                )}
              >
                <LogOut size={20} aria-hidden="true" className="rtl:-scale-x-100" />
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Sidebar() {
  const isMobileSidebarOpen = useWorkspaceStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const toggleMobileSidebar = useWorkspaceStore((s) => s.toggleMobileSidebar);
  const pathname = usePathname();
  const close = React.useCallback(() => setMobileSidebarOpen(false), [setMobileSidebarOpen]);
  useHydrateSidebarPrefs();

  // Navigating (links, back/forward, search results) always closes the sheet.
  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  // Growing past the lg breakpoint while open would leave a locked body scroll
  // behind an invisible sheet — close it.
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
      <DesktopSidebar />
      <MobileTabBar moreOpen={isMobileSidebarOpen} onMore={toggleMobileSidebar} />
      <MoreSheet open={isMobileSidebarOpen} onClose={close} />
    </>
  );
}
