"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Kanban,
  Settings,
  BarChart3,
  Scissors,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, href: "/" },
  { id: "calendar", icon: Calendar, href: "/calendar" },
  { id: "leads", icon: Kanban, href: "/leads" },
  { id: "clients", icon: Users, href: "/clients" },
  { id: "analytics", icon: BarChart3, href: "/analytics" },
  { id: "settings", icon: Settings, href: "/settings" },
] as const;

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const { isMobileSidebarOpen, setMobileSidebarOpen } = useWorkspaceStore();
  const pathname = usePathname();
  const { direction } = useThemeStore();
  const t = useTranslation();
  const isRTL = direction === "rtl";

  const labels: Record<string, string> = {
    dashboard: t.sidebar.dashboard,
    calendar: t.sidebar.calendar,
    leads: t.sidebar.leads,
    clients: t.sidebar.clients,
    analytics: t.sidebar.analytics,
    settings: t.sidebar.settings,
  };

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  return (
    <motion.aside
      className={cn(
        "fixed top-0 h-screen z-40 flex flex-col transition-transform duration-300 md:translate-x-0",
        "bg-[var(--bg-primary)] border-r border-[var(--border-primary)]",
        isRTL ? "right-0 border-l border-r-0" : "left-0 border-r",
        isMobileSidebarOpen
          ? "translate-x-0"
          : isRTL
            ? "translate-x-full md:translate-x-0"
            : "-translate-x-full md:translate-x-0",
      )}
      initial={false}
      animate={{ width: expanded || isMobileSidebarOpen ? 260 : 72 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 gap-4 border-b border-[var(--border-primary)]">
        <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--text-primary)] flex items-center justify-center flex-shrink-0">
          <Scissors size={16} className="text-[var(--bg-primary)]" />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 10 : -10 }}
              transition={{ duration: 0.15 }}
              className="text-[14px] font-medium tracking-tight text-[var(--text-primary)] whitespace-nowrap"
            >
              Lumina
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "relative flex items-center gap-4 px-3 h-10 rounded-[var(--radius-md)]",
                "transition-colors duration-[var(--transition-fast)] cursor-pointer group",
                isActive
                  ? "text-[var(--text-primary)] bg-[var(--bg-surface-active)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]",
              )}
            >
              <item.icon
                size={18}
                className="relative z-10 flex-shrink-0 transition-opacity"
                style={isActive ? { opacity: 1 } : { opacity: 0.7 }}
              />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, x: isRTL ? 8 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRTL ? 8 : -8 }}
                    transition={{ duration: 0.12 }}
                    className="relative z-10 text-[13px] whitespace-nowrap font-medium"
                  >
                    {labels[item.id]}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Collapsed tooltip */}
              {!expanded && (
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--text-primary)] text-[var(--bg-primary)] text-[12px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-sm z-50",
                    isRTL ? "right-[calc(100%+8px)]" : "left-[calc(100%+8px)]",
                  )}
                >
                  {labels[item.id]}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-[var(--border-primary)]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center w-full h-8 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
        >
          {isRTL ? (
            expanded ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )
          ) : expanded ? (
            <ChevronLeft size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
