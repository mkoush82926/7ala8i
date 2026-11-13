"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Globe, ChevronDown, Menu, Users, Sun, Moon, Settings, LogOut, Search, Loader2, Check } from "lucide-react";
import { format } from "date-fns";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn, getInitials } from "@/lib/utils";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { searchWorkspace, type WorkspaceSearchResult } from "@/lib/queries/search";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useShellRole, useSignOut } from "@/components/layout/sidebar";
import { findNavItem, navLabel, stripLocale } from "@/components/layout/nav-config";

const EMPTY_SEARCH_RESULT: WorkspaceSearchResult = { clients: [], leads: [], appointments: [] };

const iconBtn =
  "relative grid size-11 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]";

const menuPanel =
  "absolute top-[calc(100%+8px)] z-50 min-w-[200px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1.5 shadow-xl";

const menuItem =
  "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13px] font-semibold text-[var(--text-secondary)] no-underline transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]";

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
  const { t, isRTL, href, formatDate, formatTime } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    <div className="flex justify-center py-5" role="status" aria-label={t.common.loading}>
      <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" aria-hidden="true" />
    </div>
  ) : failedFor === term ? (
    <p role="alert" className="m-0 px-3 py-4 text-center text-[13px] text-[var(--accent-rose)]">
      {t.topbar.searchFailed}
    </p>
  ) : options.length === 0 ? (
    <p role="status" className="m-0 px-3 py-4 text-center text-[13px] text-[var(--text-muted)]">
      {interpolate(t.topbar.noResults, { term })}
    </p>
  ) : (
    <ul id={listId} role="listbox" aria-label={t.topbar.searchResults} className="m-0 list-none p-0">
      {options.map((opt, i) => (
        <React.Fragment key={`${opt.group}-${opt.id}`}>
          {(i === 0 || options[i - 1].group !== opt.group) && (
            <li
              role="presentation"
              className={cn(
                "mx-3 mb-0.5 mt-2 text-[11px] font-bold text-[var(--text-muted)]",
                !isRTL && "uppercase tracking-[0.1em]",
              )}
            >
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
              "flex cursor-pointer flex-col rounded-lg px-3 py-2",
              active === i ? "bg-[var(--bg-secondary)]" : "hover:bg-[var(--bg-secondary)]",
            )}
          >
            <span className="text-[13px] font-bold text-[var(--text-primary)]">{opt.primary}</span>
            {opt.secondary && (
              <span dir="auto" className="mt-px text-[12px] text-[var(--text-muted)]">
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
      type="search"
      role="combobox"
      aria-expanded={showResults}
      aria-controls={showResults ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={showResults && active >= 0 ? optionId(active) : undefined}
      aria-label={searchLabel}
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
        "h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[16px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hover)] focus:shadow-[var(--shadow-focus)] sm:text-[13px]",
        variant === "inline" ? "ps-9 pe-3" : "px-3",
      )}
    />
  );

  if (variant === "icon") {
    return (
      <div ref={rootRef} className="lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-label={searchLabel}
          aria-expanded={open}
          className={iconBtn}
        >
          <Search size={17} aria-hidden="true" />
        </button>
        {open && (
          <div className="fixed inset-x-4 top-[72px] z-50 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 shadow-xl">
            {input}
            {query.length > 0 && <div className="mt-2 max-h-[60vh] overflow-y-auto">{resultsBody}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <div className="relative w-60 xl:w-72">
        <Search
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        {input}
      </div>
      {showResults && (
        <div className={cn(menuPanel, "end-0 max-h-[360px] w-[320px] overflow-y-auto")}>{resultsBody}</div>
      )}
    </div>
  );
}

/* ── Master / per-barber view switcher (shop admins) ── */
function ViewSwitcher() {
  const { t, isRTL } = useTranslation();
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
          "lg:flex lg:h-11 lg:w-auto lg:items-center lg:gap-1.5 lg:border lg:border-[var(--border-subtle)] lg:bg-[var(--bg-secondary)] lg:px-4 lg:text-[12px] lg:font-bold",
          !isRTL && "lg:uppercase lg:tracking-[0.08em]",
        )}
      >
        <Users size={17} aria-hidden="true" className="lg:hidden" />
        <span className="hidden max-w-[160px] truncate lg:inline">{currentLabel}</span>
        <ChevronDown size={12} aria-hidden="true" className="hidden lg:block" />
      </button>
      {open && (
        <div role="menu" aria-label={t.topbar.switchView} className={cn(menuPanel, "end-0 lg:end-auto lg:start-0")}>
          {choices.map((c, i) => {
            const selected = currentView === c.id;
            return (
              <React.Fragment key={c.id}>
                {i === 1 && <div role="separator" className="mx-1.5 my-1 h-px bg-[var(--border-subtle)]" />}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    setCurrentView(c.id);
                    close();
                    triggerRef.current?.focus();
                  }}
                  className={cn(menuItem, selected && "bg-[var(--bg-secondary)] text-[var(--text-primary)]")}
                >
                  <span className="flex-1">{c.name}</span>
                  {selected && <Check size={14} aria-hidden="true" />}
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
  const isMobileSidebarOpen = useWorkspaceStore((s) => s.isMobileSidebarOpen);
  const toggleMobileSidebar = useWorkspaceStore((s) => s.toggleMobileSidebar);
  const role = useShellRole();
  const { t, locale, isRTL, href, switchLocale } = useTranslation();
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
    <header className="topbar-wrapper">
      {/* Start: menu, title, view switcher, search */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={toggleMobileSidebar}
          aria-label={t.topbar.openMenu}
          aria-expanded={isMobileSidebarOpen}
          className={cn(iconBtn, "-ms-2 lg:hidden")}
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "hidden text-[11px] font-bold text-[var(--text-muted)] md:inline",
              !isRTL && "uppercase tracking-[0.12em]",
            )}
          >
            {displayName}
          </span>
          <span aria-hidden="true" className="hidden text-[14px] leading-none text-[var(--border-primary)] md:inline">
            /
          </span>
          <span
            className="truncate text-[14px] font-bold text-[var(--text-primary)] md:text-[13px]"
            style={{ letterSpacing: headingTracking(isRTL, "0.01em") }}
            aria-current="page"
          >
            {pageTitle}
          </span>
        </div>

        {role === "shop_admin" && (
          <div className="hidden lg:block">
            <ViewSwitcher />
          </div>
        )}

        <SearchBox variant="inline" />
      </div>

      {/* End: actions and account */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {role === "shop_admin" && (
          <div className="lg:hidden">
            <ViewSwitcher />
          </div>
        )}

        <SearchBox variant="icon" />

        <NotificationBell />

        <button
          type="button"
          onClick={handleToggleLocale}
          aria-label={t.topbar.switchLanguage}
          title={t.topbar.switchLanguage}
          lang={nextLocale}
          className={cn(iconBtn, "hidden sm:grid")}
        >
          <Globe size={17} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={themeLabel}
          aria-pressed={isDark}
          title={themeLabel}
          className={cn(iconBtn, "hidden sm:grid")}
        >
          {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>

        <div aria-hidden="true" className="mx-2 hidden h-8 w-px bg-[var(--border-subtle)] sm:block" />

        <div ref={userRootRef} className="relative">
          <button
            ref={userTriggerRef}
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label={`${t.topbar.accountMenu}: ${displayName}`}
            className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-[var(--bg-secondary)] sm:pe-2"
          >
            <span className="hidden text-end sm:block">
              <span className="block max-w-[160px] truncate text-[13px] font-bold leading-tight text-[var(--text-primary)]">
                {displayName}
              </span>
              {roleLabel && (
                <span className="block text-[11px] font-semibold leading-snug text-[var(--text-muted)]">{roleLabel}</span>
              )}
            </span>
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--brand-primary)] text-[11px] font-extrabold text-[var(--brand-on-primary)]"
            >
              {getInitials(displayName)}
            </span>
          </button>

          {userMenuOpen && (
            <div role="menu" aria-label={t.topbar.accountMenu} className={cn(menuPanel, "end-0 w-[min(240px,calc(100vw-2rem))]")}>
              <div className="mb-1.5 border-b border-[var(--border-subtle)] px-3 pb-3 pt-2">
                <p className="m-0 truncate text-[13px] font-bold text-[var(--text-primary)]">{displayName}</p>
                {roleLabel && <p className="m-0 mt-0.5 text-[12px] text-[var(--text-muted)]">{roleLabel}</p>}
              </div>

              {role === "shop_admin" && (
                <Link role="menuitem" href={href("/settings")} onClick={closeUserMenu} className={menuItem}>
                  <Settings size={15} aria-hidden="true" />
                  {t.sidebar.settings}
                </Link>
              )}

              {/* Phones: language and theme live in the menu to keep the bar from overflowing */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeUserMenu();
                  handleToggleLocale();
                }}
                className={cn(menuItem, "sm:hidden")}
              >
                <Globe size={15} aria-hidden="true" />
                <span lang={nextLocale}>{t.topbar.language}</span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isDark}
                onClick={toggleTheme}
                className={cn(menuItem, "sm:hidden")}
              >
                {isDark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
                {themeLabel}
              </button>

              <div role="separator" className="mx-2 my-1.5 h-px bg-[var(--border-subtle)]" />

              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                disabled={signingOut}
                aria-busy={signingOut || undefined}
                className={cn(menuItem, "text-[var(--accent-rose)] hover:bg-[var(--accent-rose-muted)] hover:text-[var(--accent-rose)] disabled:opacity-60")}
              >
                {signingOut ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <LogOut size={15} aria-hidden="true" />}
                {t.sidebar.signOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
