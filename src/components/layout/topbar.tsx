"use client";

import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Globe, ChevronDown, Users, Sun, Moon, Settings, LogOut, Search, Loader2, Check, Bell, Compass, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn, getInitials } from "@/lib/utils";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { searchWorkspace, type WorkspaceSearchResult } from "@/lib/queries/search";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useShellRole, useSignOut } from "@/components/layout/sidebar";
import { findNavItem, navLabel, stripLocale } from "@/components/layout/nav-config";
import { ButtonLink } from "@/components/ui/button";
import { focusRing } from "@/components/ui/recipes";

const EMPTY_SEARCH_RESULT: WorkspaceSearchResult = { clients: [], leads: [], appointments: [] };

const iconBtn = cn(
  "relative grid size-11 shrink-0 place-items-center rounded-full text-ink-soft transition-colors duration-150 motion-reduce:transition-none hover:bg-sunken hover:text-ink [&_svg]:size-5",
  focusRing,
);

const menuPanel =
  "absolute top-[calc(100%+8px)] z-50 min-w-[220px] rounded-2xl border border-line bg-card p-2 shadow-float";

const menuItem = cn(
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm font-medium text-ink-soft no-underline transition-colors duration-150 motion-reduce:transition-none hover:bg-sunken hover:text-ink [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-ink-muted",
  focusRing,
  "focus-visible:-outline-offset-2",
);

/** Close a popover on Escape (returning focus to its trigger) and on outside clicks. */
function useDismiss(
  open: boolean,
  close: () => void,
  rootRef: React.RefObject<HTMLElement | null>,
  triggerRef?: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef?.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, close, rootRef, triggerRef]);
}

/* ── Search shortcut hint: platform-specific, client only (null on the server) ── */
const noopSubscribe = () => () => {};
const shortcutLabel = () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K");
function useShortcutLabel(): string | null {
  return useSyncExternalStore(noopSubscribe, shortcutLabel, () => null);
}

/* ── Workspace search (combobox + grouped listbox) ── */
interface SearchOption {
  id: string;
  group: "clients" | "leads" | "appointments";
  primary: string;
  secondary?: string;
  path: string;
}

function SearchBox({ variant }: { variant: "inline" | "icon" }) {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const isAdmin = useWorkspaceStore((s) => s.role) === "shop_admin";
  const { t, href, formatDate, formatTime } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcut = useShortcutLabel();
  const [inputValue, setInputValue] = useState("");
  const [term, setTerm] = useState("");
  const [rawResults, setRawResults] = useState<WorkspaceSearchResult>(EMPTY_SEARCH_RESULT);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const searchLabel = isAdmin ? t.topbar.searchLabel : t.topbar.searchLabelStaff;

  useEffect(() => {
    const handle = setTimeout(() => setTerm(inputValue.trim()), 300);
    return () => clearTimeout(handle);
  }, [inputValue]);

  useEffect(() => {
    if (!shopId || !term) return;
    let cancelled = false;
    searchWorkspace(createClient(), shopId, term, { includeLeads: isAdmin })
      .then((res) => {
        if (cancelled) return;
        setRawResults(res);
        setFetchedFor(term);
        setFailedFor(null);
      })
      .catch(() => {
        if (!cancelled) setFailedFor(term);
      });
    return () => {
      cancelled = true;
    };
  }, [shopId, term, isAdmin]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  useDismiss(open, close, rootRef, variant === "icon" ? triggerRef : undefined);

  // ⌘K / Ctrl K focuses the inline search (md+).
  useEffect(() => {
    if (variant !== "inline") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const el = inputRef.current;
        if (!el || el.offsetParent === null) return; // hidden below md
        e.preventDefault();
        el.focus();
        el.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [variant]);

  const results = shopId && term && fetchedFor === term ? rawResults : EMPTY_SEARCH_RESULT;
  const options: SearchOption[] = [
    ...results.clients.map((c) => ({
      id: c.id,
      group: "clients" as const,
      primary: c.name,
      secondary: c.phone ?? undefined,
      path: `/clients?id=${encodeURIComponent(c.id)}`,
    })),
    ...results.leads.map((l) => ({
      id: l.id,
      group: "leads" as const,
      primary: l.name,
      secondary: l.contact ?? undefined,
      path: `/leads?lead=${encodeURIComponent(l.id)}`,
    })),
    ...results.appointments.map((a) => ({
      id: a.id,
      group: "appointments" as const,
      primary: a.client_name,
      secondary: `${formatDate(a.start_time, "dayMonth")} · ${formatTime(a.start_time)}`,
      path: `/calendar?date=${format(new Date(a.start_time), "yyyy-MM-dd")}&appt=${encodeURIComponent(a.id)}`,
    })),
  ];

  function goTo(opt: SearchOption) {
    close();
    setInputValue("");
    router.push(href(opt.path));
  }

  const query = inputValue.trim();
  const showResults = open && query.length > 0;
  const isBusy = query !== term || (term.length > 0 && fetchedFor !== term && failedFor !== term);
  const optionId = (i: number) => `${listId}-opt-${i}`;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && options[active]) {
      e.preventDefault();
      goTo(options[active]);
    }
  }

  const groupTitle = { clients: t.sidebar.clients, leads: t.sidebar.leads, appointments: t.topbar.appointments };

  const resultsBody = isBusy ? (
    <div className="flex justify-center py-6" role="status" aria-label={t.common.loading}>
      <Loader2 size={18} className="animate-spin text-ink-muted motion-reduce:animate-none" aria-hidden="true" />
    </div>
  ) : failedFor === term ? (
    <p role="alert" className="m-0 px-3 py-5 text-center text-sm text-danger-text">
      {t.topbar.searchFailed}
    </p>
  ) : options.length === 0 ? (
    <p role="status" className="m-0 px-3 py-5 text-center text-sm text-ink-muted">
      {interpolate(t.topbar.noResults, { term })}
    </p>
  ) : (
    <ul id={listId} role="listbox" aria-label={t.topbar.searchResults} className="m-0 list-none p-0">
      {options.map((opt, i) => (
        <React.Fragment key={`${opt.group}-${opt.id}`}>
          {(i === 0 || options[i - 1].group !== opt.group) && (
            <li role="presentation" className="mx-3 mb-1 mt-3 text-xs font-semibold text-ink-muted first:mt-1">
              {groupTitle[opt.group]}
            </li>
          )}
          <li
            id={optionId(i)}
            role="option"
            aria-selected={active === i}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => goTo(opt)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "flex cursor-pointer flex-col rounded-lg px-3 py-2.5 transition-colors duration-150 motion-reduce:transition-none",
              active === i ? "bg-brand-soft" : "hover:bg-sunken",
            )}
          >
            <span className="text-sm font-semibold text-ink">{opt.primary}</span>
            {opt.secondary && (
              <span dir="auto" className="mt-0.5 text-[13px] text-ink-muted">
                {opt.secondary}
              </span>
            )}
          </li>
        </React.Fragment>
      ))}
    </ul>
  );

  const input = (
    <input
      ref={inputRef}
      type="search"
      role="combobox"
      aria-expanded={showResults}
      aria-controls={showResults ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={showResults && active >= 0 ? optionId(active) : undefined}
      aria-label={searchLabel}
      aria-keyshortcuts={variant === "inline" ? "Meta+K Control+K" : undefined}
      autoFocus={variant === "icon"}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
        setActive(-1);
        setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      placeholder={isAdmin ? t.topbar.searchPlaceholder : t.topbar.searchPlaceholderStaff}
      className={cn(
        "w-full border border-line bg-card text-base text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 motion-reduce:transition-none md:text-sm",
        variant === "inline" ? "h-10 rounded-full ps-10 pe-16" : "h-12 rounded-lg ps-11 pe-4",
      )}
    />
  );

  if (variant === "icon") {
    return (
      <div ref={rootRef} className="md:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-label={searchLabel}
          aria-expanded={open}
          className={iconBtn}
        >
          <Search aria-hidden="true" />
        </button>
        {open && (
          <div className="fixed inset-x-4 top-[72px] z-50 rounded-2xl border border-line bg-card p-2 shadow-float">
            <div className="relative">
              <Search
                size={20}
                aria-hidden="true"
                className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              {input}
            </div>
            {query.length > 0 && <div className="mt-2 max-h-[60vh] overflow-y-auto">{resultsBody}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <div className="relative w-56 lg:w-64 xl:w-72">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        {input}
        {shortcut && !inputValue && (
          <kbd
            aria-hidden="true"
            dir="ltr"
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded-sm border border-line bg-sunken px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-muted"
          >
            {shortcut}
          </kbd>
        )}
      </div>
      {showResults && (
        <div className={cn(menuPanel, "end-0 max-h-[400px] w-[360px] overflow-y-auto")}>{resultsBody}</div>
      )}
    </div>
  );
}

/* ── Master / per-barber view switcher (shop admins) ── */
function ViewSwitcher() {
  const { t } = useTranslation();
  const currentView = useWorkspaceStore((s) => s.currentView);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const setCurrentView = useWorkspaceStore((s) => s.setCurrentView);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef, triggerRef);

  const currentLabel =
    currentView === "master" ? t.topbar.masterView : barbers.find((b) => b.id === currentView)?.name ?? t.topbar.masterView;
  const choices = [{ id: "master", name: t.topbar.masterView }, ...barbers];

  return (
    <div ref={rootRef} className="relative">
      {/* lg+: labelled pill; below lg: icon button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.topbar.switchView}: ${currentLabel}`}
        className={cn(
          iconBtn,
          "lg:flex lg:h-10 lg:w-auto lg:items-center lg:gap-2 lg:border lg:border-line lg:bg-card lg:pe-3 lg:ps-4 lg:text-sm lg:font-semibold lg:text-ink lg:hover:border-line-strong lg:hover:bg-card lg:[&_svg]:size-4",
        )}
      >
        <Users aria-hidden="true" className="lg:text-ink-muted" />
        <span className="hidden max-w-[160px] truncate lg:inline">{currentLabel}</span>
        <ChevronDown aria-hidden="true" className="hidden text-ink-muted lg:block" />
      </button>
      {open && (
        <div role="menu" aria-label={t.topbar.switchView} className={cn(menuPanel, "end-0 lg:end-auto lg:start-0")}>
          {choices.map((c, i) => {
            const selected = currentView === c.id;
            return (
              <React.Fragment key={c.id}>
                {i === 1 && <div role="separator" className="mx-2 my-1.5 h-px bg-line" />}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    setCurrentView(c.id);
                    close();
                    triggerRef.current?.focus();
                  }}
                  className={cn(menuItem, selected && "bg-brand-soft font-semibold text-brand-pressed hover:bg-brand-soft hover:text-brand-pressed")}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  {selected && <Check aria-hidden="true" className="!text-brand-text" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const shopName = useWorkspaceStore((s) => s.shopName);
  const role = useShellRole();
  const { t, locale, href, switchLocale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRootRef = useRef<HTMLDivElement>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  useDismiss(userMenuOpen, closeUserMenu, userRootRef, userTriggerRef);
  const { signOut, busy: signingOut } = useSignOut(closeUserMenu);

  const nextLocale = locale === "en" ? "ar" : "en";
  const handleToggleLocale = () => {
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.push(switchLocale(pathname, nextLocale));
  };

  const navItem = findNavItem(stripLocale(pathname));
  const pageTitle = navItem ? navLabel(t, navItem.id) : t.sidebar.dashboard;
  const roleLabel = role === "barber" ? t.topbar.roleBarber : role === "shop_admin" ? t.topbar.roleAdmin : "";
  const displayName = shopName || t.topbar.myShop;
  const isDark = theme === "dark";
  const themeLabel = isDark ? t.topbar.switchToLight : t.topbar.switchToDark;

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-page/90 px-4 backdrop-blur-md transition-[inset] duration-200 ease-standard supports-[backdrop-filter]:bg-page/80 motion-reduce:transition-none sm:gap-3 lg:start-[var(--sidebar-width)] lg:px-8">
      {/* Start: page title (+ the master/barber view on desktop) */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-h3 min-w-0 truncate text-ink" aria-current="page">
          {pageTitle}
        </span>
        {role === "shop_admin" && (
          <div className="hidden shrink-0 lg:block">
            <ViewSwitcher />
          </div>
        )}
      </div>

      {/* End: search, new booking, notifications, account */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <SearchBox variant="inline" />

        {role === "shop_admin" && (
          <div className="lg:hidden">
            <ViewSwitcher />
          </div>
        )}

        <SearchBox variant="icon" />

        {role && (
          <ButtonLink
            href={href("/calendar")}
            size="sm"
            icon={<CalendarPlus aria-hidden="true" />}
            className="hidden px-3 sm:inline-flex sm:px-3.5"
          >
            <span className="sr-only lg:not-sr-only">{t.calendar.newBooking}</span>
          </ButtonLink>
        )}

        <NotificationBell />

        <button
          type="button"
          onClick={handleToggleLocale}
          aria-label={t.topbar.switchLanguage}
          title={t.topbar.switchLanguage}
          lang={nextLocale}
          className={cn(iconBtn, "hidden sm:grid")}
        >
          <Globe aria-hidden="true" />
        </button>

        <div ref={userRootRef} className="relative">
          <button
            ref={userTriggerRef}
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label={`${t.topbar.accountMenu}: ${displayName}`}
            className={cn(
              "flex items-center gap-2.5 rounded-full p-1 transition-colors duration-150 hover:bg-sunken motion-reduce:transition-none 2xl:pe-3",
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-pressed ring-2 ring-card"
            >
              {getInitials(displayName) || "H"}
            </span>
            <span className="hidden min-w-0 text-start 2xl:block">
              <span className="block max-w-[160px] truncate text-sm font-semibold leading-tight text-ink">{displayName}</span>
              {roleLabel && <span className="block text-xs leading-snug text-ink-muted">{roleLabel}</span>}
            </span>
          </button>

          {userMenuOpen && (
            <div role="menu" aria-label={t.topbar.accountMenu} className={cn(menuPanel, "end-0 w-[min(256px,calc(100vw-2rem))]")}>
              <div className="mb-1 flex items-center gap-3 border-b border-line px-3 pb-3 pt-2">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-pressed"
                >
                  {getInitials(displayName) || "H"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{displayName}</span>
                  {roleLabel && <span className="block text-[13px] text-ink-muted">{roleLabel}</span>}
                </span>
              </div>

              {role === "shop_admin" && (
                <Link role="menuitem" href={href("/settings")} onClick={closeUserMenu} className={menuItem}>
                  <Settings aria-hidden="true" />
                  {t.sidebar.settings}
                </Link>
              )}
              {(role === "shop_admin" || role === "barber") && (
                <Link role="menuitem" href={href("/settings/notifications")} onClick={closeUserMenu} className={menuItem}>
                  <Bell aria-hidden="true" />
                  {t.notificationSettings.title}
                </Link>
              )}
              <Link role="menuitem" href={href("/explore")} onClick={closeUserMenu} className={menuItem}>
                <Compass aria-hidden="true" />
                {t.search.exploreCta}
              </Link>

              {/* Phones: language lives here; below lg the theme does too (the sidebar footer has it on desktop) */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeUserMenu();
                  handleToggleLocale();
                }}
                className={cn(menuItem, "sm:hidden")}
              >
                <Globe aria-hidden="true" />
                <span lang={nextLocale}>{t.topbar.language}</span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isDark}
                onClick={toggleTheme}
                className={cn(menuItem, "lg:hidden")}
              >
                {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                {themeLabel}
              </button>

              <div role="separator" className="mx-2 my-1.5 h-px bg-line" />

              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                disabled={signingOut}
                aria-busy={signingOut || undefined}
                className={cn(
                  menuItem,
                  "text-danger-text hover:bg-danger-soft hover:text-danger-text disabled:opacity-45 [&_svg]:text-danger-text",
                )}
              >
                {signingOut ? (
                  <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <LogOut aria-hidden="true" className="rtl:-scale-x-100" />
                )}
                {t.sidebar.signOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
