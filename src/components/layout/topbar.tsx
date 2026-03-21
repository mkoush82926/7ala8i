"use client";

import React, { useState } from "react";
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
import { useRouter } from "next/navigation";

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
        background: hover ? "#f4f6f8" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.15s ease",
        color: "#76777d",
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
          border: "1.5px solid #ffffff",
        }} />
      )}
    </button>
  );
}

export function Topbar() {
  const { theme, toggleTheme, toggleLocale, direction } = useThemeStore();
  const { shopName, role, currentView, barbers, setCurrentView, toggleMobileSidebar } =
    useWorkspaceStore();
  const t = useTranslation();
  const isRTL = direction === "rtl";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <nav className="topbar-wrapper">
      {/* ── LEFT: hamburger + breadcrumb + view switcher ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Mobile hamburger */}
        <IconBtn onClick={toggleMobileSidebar}>
          <Menu size={18} />
        </IconBtn>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#b0b3b8",
            textTransform: "uppercase", letterSpacing: "0.12em",
          }}>
            {isRTL ? "الأتيليه" : "Atelier Overview"}
          </span>
          <span style={{ fontSize: 14, color: "#d4d6da", lineHeight: 1 }}>/</span>
          <span style={{
            fontSize: 12, fontWeight: 700, color: "#191c1e",
            letterSpacing: "0.01em",
          }}>
            {isRTL ? "لوحة التحكم" : "Main Dashboard"}
          </span>
        </div>

        {/* View Switcher — desktop only, for shop_admin */}
        {role === "shop_admin" && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 44,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid #eceef0",
                background: "#f4f6f8",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#45464c",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#eceef0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#f4f6f8";
              }}
            >
              <span>
                {currentView === "master"
                  ? t.topbar.masterView || "Master View"
                  : barbers.find((b) => b.id === currentView)?.name}
              </span>
              <ChevronDown size={11} />
            </button>

            {dropdownOpen && (
              <>
                {/* Click-away backdrop */}
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
                  background: "#ffffff",
                  border: "1px solid #eceef0",
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
                      color: currentView === "master" ? "#191c1e" : "#76777d",
                      background: currentView === "master" ? "#f4f6f8" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {t.topbar.masterView || "Master View"}
                  </button>
                  {barbers.length > 0 && (
                    <div style={{ height: 1, background: "#f0f2f5", margin: "4px 6px" }} />
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
                        color: currentView === barber.id ? "#191c1e" : "#76777d",
                        background: currentView === barber.id ? "#f4f6f8" : "transparent",
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
        <div style={{ position: "relative", marginRight: 8 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#b0b3b8",
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
              border: "1px solid #eceef0",
              background: "#f8f9fb",
              fontSize: 13,
              color: "#191c1e",
              outline: "none",
              transition: "all 0.18s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#191c1e";
              e.currentTarget.style.width = "240px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = "#f8f9fb";
              e.currentTarget.style.borderColor = "#eceef0";
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
        <IconBtn badge>
          <Bell size={17} />
        </IconBtn>

        {/* Language */}
        <IconBtn onClick={toggleLocale}>
          <Globe size={17} />
        </IconBtn>

        {/* Theme */}
        <IconBtn onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </IconBtn>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: "#eceef0", margin: "0 12px" }} />

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
              (e.currentTarget as HTMLButtonElement).style.background = "#f4f6f8";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
            }}
          >
            <div style={{ textAlign: isRTL ? "left" : "right" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#191c1e", margin: 0, lineHeight: 1.3 }}>
                {shopName || "My Atelier"}
              </p>
              <p style={{ fontSize: 10, color: "#b0b3b8", fontWeight: 600, textTransform: "capitalize", margin: 0, lineHeight: 1.4 }}>
                {role?.replace("_", " ") || "Admin"}
              </p>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#191c1e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "2px solid #eceef0",
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#ffffff", letterSpacing: "0.05em" }}>
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
                background: "#ffffff",
                border: "1px solid #eceef0",
                borderRadius: 14,
                boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
                padding: "8px",
                zIndex: 50,
              }}>
                {/* User info header */}
                <div style={{ padding: "10px 14px 12px", borderBottom: "1px solid #f0f2f5", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#191c1e", margin: 0 }}>{shopName || "My Atelier"}</p>
                  <p style={{ fontSize: 11, color: "#b0b3b8", margin: 0, marginTop: 2, textTransform: "capitalize" }}>{role?.replace("_", " ") || "Admin"}</p>
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
                    color: "#45464c",
                    textDecoration: "none",
                    transition: "background 0.15s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#f4f6f8"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                >
                  <Settings size={15} style={{ color: "#76777d" }} />
                  {isRTL ? "الإعدادات" : "Settings"}
                </a>

                {/* Divider */}
                <div style={{ height: 1, background: "#f0f2f5", margin: "6px 8px" }} />

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
