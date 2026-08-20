"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Globe, ChevronDown, Bell, Menu, Users, Sun, Moon,
  Settings, LogOut, Search, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { getInitials } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { searchWorkspace, type WorkspaceSearchResult } from "@/lib/queries/search";

interface NotificationRow {
  id: string;
  client_name: string;
  start_time: string;
}

const EMPTY_SEARCH_RESULT: WorkspaceSearchResult = { clients: [], leads: [], appointments: [] };

/* ── Icon button helper ── */
function IconBtn({
  onClick,
  children,
  badge,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  badge?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        width: 44,
        height: 44,
        borderRadius: 8,
        border: "none",
        background: hover ? "var(--bg-secondary)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.15s ease",
        color: "var(--text-tertiary)",
        flexShrink: 0,
      }}
    >
      {children}
      {badge && (
        <span style={{
          position: "absolute", top: 7, right: 7,
          width: 7, height: 7,
          background: "#ba1a1a",
          borderRadius: "50%",
          border: "1.5px solid var(--bg-primary)",
        }} />
      )}
    </button>
  );
}

/* ── Search result row group (Clients / Leads / Appointments) ── */
function ResultGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: { id: string; primary: string; secondary?: string }[];
  onSelect: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ padding: "4px 0" }}>
      <p style={{
        fontSize: 10, fontWeight: 800, textTransform: "uppercase",
        letterSpacing: "0.12em", color: "var(--text-tertiary)",
        margin: "6px 12px 2px",
      }}>
        {title}
      </p>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={onSelect}
          style={{
            display: "flex", flexDirection: "column", width: "100%",
            textAlign: "start", padding: "8px 12px", border: "none",
            borderRadius: 8, background: "transparent", cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{item.primary}</span>
          {item.secondary && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{item.secondary}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Real workspace search — debounced, grouped dropdown results ──
   `variant="inline"` renders a persistent input (desktop, lg+).
   `variant="icon"` renders a magnifying-glass IconBtn that opens the same
   panel (mobile), matching the desktop/mobile duality already used above
   for the barber view switcher. ── */
function SearchBox({ variant }: { variant: "inline" | "icon" }) {
  const { shopId } = useWorkspaceStore();
  const { isRTL, locale } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [term, setTerm] = useState("");
  const [rawResults, setRawResults] = useState<WorkspaceSearchResult>(EMPTY_SEARCH_RESULT);
  // Term the current `rawResults` were fetched for — lets "still fetching"
  // be derived instead of tracked as a separate boolean set from an effect.
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);

  // Keystrokes shouldn't each fire a new request — wait for a short pause
  // (matches the Clients-page search debounce).
  useEffect(() => {
    const handle = setTimeout(() => setTerm(inputValue.trim()), 300);
    return () => clearTimeout(handle);
  }, [inputValue]);

  useEffect(() => {
    if (!shopId || !term) return;
    let cancelled = false;
    const supabase = createClient();
    searchWorkspace(supabase, shopId, term).then((res) => {
      if (cancelled) return;
      setRawResults(res);
      setFetchedFor(term);
    });
    return () => { cancelled = true; };
  }, [shopId, term]);

  // Stale results from a previous term shouldn't linger once the query is
  // cleared — derive the displayed set instead of resetting it in an effect.
  const results = shopId && term && fetchedFor === term ? rawResults : EMPTY_SEARCH_RESULT;

  function goTo(path: string) {
    setOpen(false);
    setInputValue("");
    router.push(`/${locale}${path}`);
  }

  const showResults = inputValue.trim().length > 0;
  const isBusy = inputValue.trim() !== term || (term.length > 0 && fetchedFor !== term);
  const hasResults =
    results.clients.length + results.leads.length + results.appointments.length > 0;

  const resultsBody = isBusy ? (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
      <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
    </div>
  ) : !hasResults ? (
    <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "16px 12px", margin: 0, textAlign: "center" }}>
      {isRTL ? `لا نتائج لـ "${term}"` : `No results for "${term}"`}
    </p>
  ) : (
    <>
      <ResultGroup
        title={isRTL ? "العملاء" : "Clients"}
        items={results.clients.map((c) => ({ id: c.id, primary: c.name, secondary: c.phone ?? undefined }))}
        onSelect={() => goTo("/clients")}
      />
      <ResultGroup
        title={isRTL ? "العملاء المحتملون" : "Leads"}
        items={results.leads.map((l) => ({ id: l.id, primary: l.name, secondary: l.contact ?? undefined }))}
        onSelect={() => goTo("/leads")}
      />
      <ResultGroup
        title={isRTL ? "المواعيد" : "Appointments"}
        items={results.appointments.map((a) => ({
          id: a.id,
          primary: a.client_name,
          secondary: format(new Date(a.start_time), "MMM d, HH:mm"),
        }))}
        onSelect={() => goTo("/calendar")}
      />
    </>
  );

  if (variant === "icon") {
    return (
      <div style={{ position: "relative" }} className="lg:hidden">
        <IconBtn onClick={() => setOpen((v) => !v)}>
          <Search size={17} />
        </IconBtn>
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
            <div style={{
              position: "absolute", top: "calc(100% + 8px)",
              right: isRTL ? "auto" : 0, left: isRTL ? 0 : "auto",
              width: 280, background: "var(--bg-primary)", border: "1px solid var(--border-primary)",
              borderRadius: 12, zIndex: 50, padding: 10,
            }}>
              <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
                placeholder={isRTL ? "بحث..." : "Search..."}
                style={{
                  width: "100%", height: 38, border: "1px solid var(--border-primary)",
                  borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none",
                  background: "var(--bg-primary)", color: "var(--text-primary)",
                }}
              />
              {showResults && (
                <div style={{ marginTop: 8, maxHeight: 320, overflowY: "auto" }}>
                  {resultsBody}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }} className="hidden lg:block">
      <div style={{ position: "relative" }}>
        <Search
          size={15}
          style={{
            position: "absolute",
            left: isRTL ? "auto" : 12,
            right: isRTL ? 12 : "auto",
            top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)",
          }}
        />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.style.borderColor = "var(--border-hover)";
            e.currentTarget.style.boxShadow = "var(--shadow-focus)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-primary)";
            e.currentTarget.style.boxShadow = "none";
          }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder={isRTL ? "بحث عن عميل أو موعد..." : "Search clients, leads, appointments..."}
          style={{
            width: 240, height: 40,
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            borderRadius: 8,
            padding: isRTL ? "0 36px 0 12px" : "0 12px 0 36px",
            fontSize: 13, outline: "none", color: "var(--text-primary)",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        />
      </div>
      {open && showResults && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)",
            right: isRTL ? "auto" : 0, left: isRTL ? 0 : "auto",
            width: 300, maxHeight: 360, overflowY: "auto",
            background: "var(--bg-primary)", border: "1px solid var(--border-primary)",
            borderRadius: 12, zIndex: 50, padding: 6,
          }}>
            {resultsBody}
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar() {
  const { theme, toggleTheme } = useThemeStore();
  const { shopId, shopName, role, currentView, barbers, setCurrentView, toggleMobileSidebar } = useWorkspaceStore();
  const { t, locale, isRTL } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    const supabase = createClient();
    supabase.from('appointments').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setNotifications(data); });

    const channel = supabase.channel('public:appointments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments', filter: `shop_id=eq.${shopId}` }, payload => {
        setNotifications(prev => [payload.new as NotificationRow, ...prev].slice(0, 5));
        setUnreadCount(c => c + 1);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast("success", "You have been successfully signed out.");
    router.push(`/${locale}/auth/login`);
  }

  const handleToggleLocale = () => {
    const newLocale = locale === "en" ? "ar" : "en";
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    // If pathname starts with /locale, replace it, else push new locale
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath || `/${newLocale}`);
  };

  const getPageTitle = () => {
    if (pathname.includes('/analytics')) return isRTL ? "التحليلات" : "Analytics";
    if (pathname.includes('/clients')) return isRTL ? "العملاء" : "Clients";
    if (pathname.includes('/calendar')) return isRTL ? "التقويم" : "Calendar";
    if (pathname.includes('/services')) return isRTL ? "الخدمات" : "Services";
    if (pathname.includes('/settings')) return isRTL ? "الإعدادات" : "Settings";
    if (pathname.includes('/book')) return isRTL ? "الحجز" : "Booking Engine";
    if (pathname.includes('/leads')) return isRTL ? "العملاء المحتملين" : "Leads Management";
    return isRTL ? "لوحة التحكم" : "Main Dashboard";
  };

  return (
    <nav className="topbar-wrapper" style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border-primary)" }}>
      {/* ── LEFT: hamburger + breadcrumb + view switcher ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Mobile hamburger */}
        <div className="lg:hidden">
            <IconBtn onClick={toggleMobileSidebar}>
              <Menu size={18} />
            </IconBtn>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
            textTransform: "uppercase", letterSpacing: "0.12em",
          }}>
            {isRTL ? "الأتيليه" : "Atelier Overview"}
          </span>
          <span style={{ fontSize: 14, color: "var(--border-hover)", lineHeight: 1 }}>/</span>
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
            letterSpacing: "0.01em",
          }}>
            {getPageTitle()}
          </span>
        </div>

        {/* View Switcher — desktop only, for shop_admin */}
        {role === "shop_admin" && (
          <div style={{ position: "relative" }} className="hidden lg:block">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 44,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-secondary)",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)";
              }}
            >
              <span>
                {currentView === "master"
                  ? t.topbar?.masterView || "Master View"
                  : barbers.find((b) => b.id === currentView)?.name}
              </span>
              <ChevronDown size={11} />
            </button>

            {dropdownOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setDropdownOpen(false)}
                />
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: isRTL ? "auto" : 0,
                  right: isRTL ? 0 : "auto",
                  minWidth: 180,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 12,
                  padding: "6px",
                  zIndex: 50,
                }}>
                  <button
                    onClick={() => { setCurrentView("master"); setDropdownOpen(false); }}
                    style={{
                      width: "100%",
                      textAlign: isRTL ? "right" : "left",
                      padding: "9px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: currentView === "master" ? "var(--text-primary)" : "var(--text-tertiary)",
                      background: currentView === "master" ? "var(--bg-secondary)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {t.topbar?.masterView || "Master View"}
                  </button>
                  {barbers.length > 0 && (
                    <div style={{ height: 1, background: "var(--border-primary)", margin: "4px 6px" }} />
                  )}
                  {barbers.map((barber) => (
                    <button
                      key={barber.id}
                      onClick={() => { setCurrentView(barber.id); setDropdownOpen(false); }}
                      style={{
                        width: "100%",
                        textAlign: isRTL ? "right" : "left",
                        padding: "9px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: currentView === barber.id ? "var(--text-primary)" : "var(--text-tertiary)",
                        background: currentView === barber.id ? "var(--bg-secondary)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {barber.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Workspace search — desktop inline input */}
        <SearchBox variant="inline" />
      </div>

      {/* ── RIGHT: icons + user ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Mobile view switcher */}
        {role === "shop_admin" && (
          <div style={{ position: "relative" }} className="lg:hidden">
            <IconBtn onClick={() => setDropdownOpen((v) => !v)}>
              <Users size={17} />
            </IconBtn>

            {dropdownOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setDropdownOpen(false)}
                />
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: isRTL ? "auto" : 0,
                  right: isRTL ? 0 : "auto",
                  minWidth: 180,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 12,
                  padding: "6px",
                  zIndex: 50,
                }}>
                  <button
                    onClick={() => { setCurrentView("master"); setDropdownOpen(false); }}
                    style={{
                      width: "100%",
                      textAlign: isRTL ? "right" : "left",
                      padding: "9px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: currentView === "master" ? "var(--text-primary)" : "var(--text-tertiary)",
                      background: currentView === "master" ? "var(--bg-secondary)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {t.topbar?.masterView || "Master View"}
                  </button>
                  {barbers.length > 0 && (
                    <div style={{ height: 1, background: "var(--border-primary)", margin: "4px 6px" }} />
                  )}
                  {barbers.map((barber) => (
                    <button
                      key={barber.id}
                      onClick={() => { setCurrentView(barber.id); setDropdownOpen(false); }}
                      style={{
                        width: "100%",
                        textAlign: isRTL ? "right" : "left",
                        padding: "9px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: currentView === barber.id ? "var(--text-primary)" : "var(--text-tertiary)",
                        background: currentView === barber.id ? "var(--bg-secondary)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {barber.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Workspace search — mobile icon trigger */}
        <SearchBox variant="icon" />

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <IconBtn badge={unreadCount > 0} onClick={() => { setBellOpen(!bellOpen); setUnreadCount(0); }}>
            <Bell size={17} />
          </IconBtn>
          {bellOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setBellOpen(false)} />
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: isRTL ? "auto" : 0, left: isRTL ? 0 : "auto",
                width: 280, background: "var(--bg-primary)", border: "1px solid var(--border-primary)",
                borderRadius: 12, zIndex: 50, padding: 12
              }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}>Recent Bookings</h4>
                {notifications.length === 0 ? <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No recent bookings.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{ display: "flex", flexDirection: "column", background: "var(--bg-secondary)", padding: "8px 10px", borderRadius: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{n.client_name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {new Date(n.start_time).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Language */}
        <IconBtn onClick={handleToggleLocale}>
          <Globe size={17} />
        </IconBtn>

        {/* Theme */}
        <IconBtn onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </IconBtn>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: "var(--border-primary)", margin: "0 12px" }} />

        {/* User section — click to open menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: "4px 8px 4px 4px",
              borderRadius: 12,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
            }}
          >
            <div style={{ textAlign: isRTL ? "left" : "right" }} className="hidden sm:block">
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>
                {shopName || "My Atelier"}
              </p>
              <p style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "capitalize", margin: 0, lineHeight: 1.4 }}>
                {role?.replace("_", " ") || "Admin"}
              </p>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: "var(--brand-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "2px solid var(--border-primary)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-on-primary)", letterSpacing: "0.05em" }}>
                {getInitials(shopName || "A")}
              </span>
            </div>
          </button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
                onClick={() => setUserMenuOpen(false)}
              />
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: isRTL ? "auto" : 0,
                left: isRTL ? 0 : "auto",
                minWidth: 200,
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                borderRadius: 12,
                padding: "8px",
                zIndex: 50,
              }}>
                {/* User info header */}
                <div style={{ padding: "10px 14px 12px", borderBottom: "1px solid var(--border-primary)", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{shopName || "My Atelier"}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, marginTop: 2, textTransform: "capitalize" }}>{role?.replace("_", " ") || "Admin"}</p>
                </div>

                {/* Settings */}
                <a
                  href={`/${locale}/settings`}
                  onClick={() => setUserMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "background 0.15s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-secondary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                >
                  <Settings size={15} style={{ color: "var(--text-tertiary)" }} />
                  {isRTL ? "الإعدادات" : "Settings"}
                </a>

                {/* Divider */}
                <div style={{ height: 1, background: "var(--border-primary)", margin: "6px 8px" }} />

                {/* Sign Out */}
                <button
                  onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ba1a1a",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    transition: "background 0.15s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(186,26,26,0.08)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <LogOut size={15} />
                  {isRTL ? "تسجيل الخروج" : "Sign Out"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
