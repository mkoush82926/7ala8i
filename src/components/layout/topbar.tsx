"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Globe, ChevronDown, Bell, Search, Menu, Users, Sun, Moon,
  Settings, LogOut,
} from "lucide-react";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { getInitials } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/components/ui/toast";

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
        borderRadius: 10,
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
          background: "#ef4444",
          borderRadius: "50%",
          border: "1.5px solid var(--bg-primary)",
        }} />
      )}
    </button>
  );
}

export function Topbar() {
  const { theme, toggleTheme, toggleLocale, direction } = useThemeStore();
  const { shopId, shopName, role, currentView, barbers, setCurrentView, toggleMobileSidebar } = useWorkspaceStore();
  const t = useTranslation();
  const isRTL = direction === "rtl";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    const supabase = createClient();
    supabase.from('appointments').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setNotifications(data); });

    const channel = supabase.channel('public:appointments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments', filter: `shop_id=eq.${shopId}` }, payload => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 5));
        setUnreadCount(c => c + 1);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast("success", "You have been successfully signed out.");
    router.push("/auth/login");
  }

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
                  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
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
      </div>

      {/* ── RIGHT: search + icons + user ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Search bar */}
        <div style={{ position: "relative", marginRight: 8 }} className="hidden sm:block">
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder={t.common?.search || "Search…"}
            style={{
              height: 36,
              width: 200,
              paddingLeft: 34,
              paddingRight: 14,
              borderRadius: 10,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-secondary)",
              fontSize: 13,
              color: "var(--text-primary)",
              outline: "none",
              transition: "all 0.18s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = "var(--bg-primary)";
              e.currentTarget.style.borderColor = "var(--text-primary)";
              e.currentTarget.style.width = "240px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.borderColor = "var(--border-primary)";
              e.currentTarget.style.width = "200px";
            }}
          />
        </div>

        {/* Mobile view switcher */}
        {role === "shop_admin" && (
          <div className="lg:hidden">
            <IconBtn>
              <Users size={17} />
            </IconBtn>
          </div>
        )}

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
                borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 50, padding: 12
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
        <IconBtn onClick={toggleLocale}>
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
              borderRadius: 10,
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
                borderRadius: 14,
                boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
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
                  href="/settings"
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
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff5f5"; }}
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
