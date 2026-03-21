"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Kanban,
  Settings,
  BarChart3,
  CalendarPlus,
  Scissors,
  LogOut,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, href: "/" },
  { id: "calendar", icon: Calendar, href: "/calendar" },
  { id: "leads", icon: Kanban, href: "/leads" },
  { id: "clients", icon: Users, href: "/clients" },
  { id: "services", icon: Scissors, href: "/services" },
  { id: "analytics", icon: BarChart3, href: "/analytics" },
  { id: "settings", icon: Settings, href: "/settings" },
] as const;

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const t = useTranslation();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (onClose) onClose();
    router.push("/auth/login");
  }

  const labels: Record<string, string> = {
    dashboard: t.sidebar.dashboard,
    calendar:  t.sidebar.calendar,
    leads:     t.sidebar.leads,
    clients:   t.sidebar.clients,
    services:  "Services",
    analytics: t.sidebar.analytics,
    settings:  t.sidebar.settings,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div style={{ padding: "36px 24px 32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1
            style={{ fontFamily: "Manrope, sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "#191c1e", lineHeight: 1 }}
          >
            Halaqy
          </h1>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#76777d", textTransform: "uppercase", letterSpacing: "0.22em", marginTop: 8 }}>
            Digital Atelier
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-secondary-container transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 16px" }}>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 16px", borderRadius: 10,
                textDecoration: "none", fontSize: 13, fontWeight: 600,
                letterSpacing: "0.01em",
                transition: "all 0.2s",
                background: isActive ? "#191c1e" : "transparent",
                color: isActive ? "#ffffff" : "#76777d",
              }}
            >
              <item.icon size={18} style={{ flexShrink: 0 }} />
              <span>{labels[item.id]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Book Appointment CTA + Sign Out */}
      <div style={{ padding: "24px 20px 32px", marginTop: "auto" }}>
        {/* Divider line */}
        <div style={{ height: 1, background: "#f0f2f5", marginBottom: 20 }} />
        <Link
          href="/calendar"
          onClick={onClose}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}
        >
          <CalendarPlus size={16} />
          Book Appointment
        </Link>
        <button
          onClick={handleSignOut}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", height: 40,
            borderRadius: 10, border: "1px solid #eceef0",
            background: "transparent", fontSize: 13, fontWeight: 600,
            color: "#76777d", cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#ba1a1a";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecdd3";
            (e.currentTarget as HTMLButtonElement).style.background = "#fff5f5";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#76777d";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#eceef0";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isMobileSidebarOpen, setMobileSidebarOpen } = useWorkspaceStore();
  const { direction } = useThemeStore();
  const isRTL = direction === "rtl";

  return (
    <>
      {/* Desktop Sidebar — matches Stitch: h-screen w-72 fixed bg-white border-r border-outline */}
      <aside
        className={cn(
          "hidden md:flex fixed top-0 h-screen z-40 flex-col",
          isRTL ? "right-0 border-l" : "left-0 border-r"
        )}
        style={{ width: "var(--sidebar-width)", background: "#ffffff", borderColor: "#e2e8f0" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: isRTL ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? "100%" : "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "fixed top-0 h-screen z-50 md:hidden flex flex-col",
                isRTL ? "right-0 border-l" : "left-0 border-r"
              )}
              style={{ width: "var(--sidebar-width)", background: "#ffffff", borderColor: "#e2e8f0" }}
            >
              <SidebarContent onClose={() => setMobileSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
