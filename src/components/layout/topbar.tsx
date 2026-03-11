"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Sun,
  Moon,
  Globe,
  ChevronDown,
  Bell,
  Search,
  Menu,
  Users,
  LogOut,
} from "lucide-react";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { getGreeting, getInitials } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { logout } from "@/app/auth/actions";

export function Topbar() {
  const { theme, toggleTheme, locale, toggleLocale, direction } =
    useThemeStore();
  const {
    shopName,
    role,
    currentView,
    barbers,
    setCurrentView,
    toggleMobileSidebar,
  } = useWorkspaceStore();
  const t = useTranslation();
  const isRTL = direction === "rtl";

  const getLocalizedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.topbar.goodMorning;
    if (hour < 17) return t.topbar.goodAfternoon;
    return t.topbar.goodEvening;
  };

  return (
    <header
      className={cn(
        "h-20 flex items-center justify-between px-6 md:px-10 border-b border-[var(--border-primary)]",
        "bg-[var(--bg-primary)]/80 backdrop-blur-[20px]",
        "sticky top-0 z-[100]",
      )}
    >
      {/* Left — Hamburger & Greeting */}
      <div className="flex items-center gap-3 md:gap-6">
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden flex items-center justify-center w-12 h-12 rounded-[var(--radius-md)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <p className="text-[11px] text-[var(--text-tertiary)] font-light tracking-wider uppercase">
            {getLocalizedGreeting()}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-[14px] md:text-[15px] text-[var(--text-primary)] font-medium">
              {shopName}
            </h1>
          </div>
        </div>

        {/* Workspace View Switcher (Team shops only) */}
        {role === "shop_admin" && (
          <div className="relative group hidden lg:block">
            <button className="flex items-center gap-2 h-12 px-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors cursor-pointer">
              <span>
                {currentView === "master"
                  ? t.topbar.masterView
                  : barbers.find((b) => b.id === currentView)?.name}
              </span>
              <ChevronDown size={14} />
            </button>
            {/* Dropdown */}
            <div
              className={cn(
                "absolute top-full mt-1 w-48 py-1 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-[var(--shadow-lg)] backdrop-blur-[20px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50",
                isRTL ? "right-0" : "left-0",
              )}
            >
              <button
                onClick={() => setCurrentView("master")}
                className={cn(
                  "w-full px-3 py-2 text-[12px] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer",
                  isRTL ? "text-end" : "text-start",
                  currentView === "master"
                    ? "text-[var(--accent-mint)]"
                    : "text-[var(--text-secondary)]",
                )}
              >
                {t.topbar.masterView}
              </button>
              <div className="h-px bg-[var(--border-primary)] my-1" />
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => setCurrentView(barber.id)}
                  className={cn(
                    "w-full px-3 py-2 text-[12px] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer",
                    isRTL ? "text-end" : "text-start",
                    currentView === barber.id
                      ? "text-[var(--accent-mint)]"
                      : "text-[var(--text-secondary)]",
                  )}
                >
                  {barber.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Search */}
        <div className="relative hidden lg:block me-2">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors"
            size={16}
          />
          <input
            type="text"
            placeholder={t.common?.search || "Search..."}
            className="h-12 w-64 ps-11 pe-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-transparent focus:border-[var(--border-primary)] focus:bg-[var(--bg-primary)] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* View Switcher Mobile - Simplified */}
          {role === "shop_admin" && (
            <button className="lg:hidden flex items-center justify-center w-12 h-12 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer">
              <Users className="w-5 h-5" />
            </button>
          )}

          {/* Notifications */}
          <button className="hidden sm:flex relative items-center justify-center w-12 h-12 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer group">
            <Bell size={18} />
            <span className="absolute top-3 right-3 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-mint)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-mint)]"></span>
            </span>
          </button>

          {/* Language Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleLocale}
            className="flex items-center justify-center w-12 h-12 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
          >
            <Globe size={18} />
          </motion.button>

          {/* Theme Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className="flex items-center justify-center w-12 h-12 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </motion.button>

          {/* Logout */}
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center justify-center w-12 h-12 rounded-full text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </form>

          {/* User Avatar */}
          <div
            className={cn(
              "w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--text-primary)] flex items-center justify-center shadow-sm border border-[var(--border-primary)] cursor-pointer hover:opacity-90 transition-opacity",
              isRTL ? "me-2" : "ms-2",
            )}
          >
            <span className="text-[11px] md:text-[13px] font-medium text-[var(--bg-primary)]">
              {getInitials("Admin User")}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
