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
  IdCard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";
import { NotificationBell } from "@/components/notifications/notification-bell";

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, href: "/" },
  { id: "calendar", icon: Calendar, href: "/calendar" },
  { id: "leads", icon: Kanban, href: "/leads" },
  { id: "clients", icon: Users, href: "/clients" },
  { id: "services", icon: Scissors, href: "/services" },
  { id: "team", icon: IdCard, href: "/team" },
  { id: "analytics", icon: BarChart3, href: "/analytics" },
  { id: "settings", icon: Settings, href: "/settings" },
] as const;

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { t, locale } = useTranslation();
  const router = useRouter();

  const [currentUserRole, setCurrentUserRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
        setCurrentUserRole(profile?.role || null);
      }
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (onClose) onClose();
    router.push(`/${locale}/auth/login`);
  }

  const labels: Record<string, string> = {
    dashboard: t.sidebar.dashboard,
    calendar:  t.sidebar.calendar,
    leads:     t.sidebar.leads,
    clients:   t.sidebar.clients,
    services:  "Services",
    team:      "Team",
    analytics: t.sidebar.analytics,
    settings:  t.sidebar.settings,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div style={{ padding: "36px 24px 32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1
            style={{ fontFamily: "var(--font-intervar), sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: "0.012em", color: "#091135", lineHeight: 1 }}
          >
            Halaqy
          </h1>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#36394a", textTransform: "uppercase", letterSpacing: "0.22em", marginTop: 8 }}>
            Digital Atelier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-secondary-container transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 16px" }}>
        {navItems.map((item) => {
          if (item.id === "settings" && currentUserRole !== 'shop_admin') return null;

          const localePrefix = `/${locale}`;
          const pathnameWithoutLocale =
            pathname === localePrefix
              ? "/"
              : pathname.startsWith(`${localePrefix}/`)
                ? pathname.slice(localePrefix.length)
                : pathname;
          const isActive =
            item.href === "/"
              ? pathnameWithoutLocale === "/"
              : pathnameWithoutLocale.startsWith(item.href);
          const href = item.href === "/" ? localePrefix : `${localePrefix}${item.href}`;

          return (
            <Link
              key={item.id}
              href={href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 16px", borderRadius: 8,
                textDecoration: "none", fontSize: 13, fontWeight: 600,
                letterSpacing: "0.01em",
                transition: "all 0.2s",
                background: isActive ? "#f5f3ff" : "transparent",
                color: isActive ? "#091135" : "#36394a",
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
        <div style={{ height: 1, background: "#e1e9f0", marginBottom: 20 }} />
        <Link
          href={`/${locale}/calendar`}
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
            borderRadius: 8, border: "1px solid #e1e9f0",
            background: "transparent", fontSize: 13, fontWeight: 600,
            color: "#36394a", cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#ba1a1a";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(186,26,26,0.3)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(186,26,26,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#36394a";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e1e9f0";
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
  const { isRTL } = useTranslation();

  return (
    <>
      {/* Desktop Sidebar — matches Stitch: h-screen w-72 fixed bg-white border-r border-outline */}
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 z-40 w-72 bg-[var(--bg-primary)] border-e border-[var(--border-primary)] flex-col pt-20 transition-all",
          "start-0"
        )}
        style={{ width: "var(--sidebar-width)", background: "#ffffff", borderColor: "#e1e9f0" }}
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
              className="fixed inset-0 z-40 md:hidden bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: isRTL ? 100 : -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? 100 : -100, opacity: 0 }}
              className={cn(
                "fixed inset-y-0 z-50 w-72 bg-[var(--bg-primary)] border-e border-[var(--border-primary)] flex flex-col",
                "start-0"
              )}
              style={{ width: "var(--sidebar-width)", background: "#ffffff", borderColor: "#e1e9f0" }}
            >
              <SidebarContent onClose={() => setMobileSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
