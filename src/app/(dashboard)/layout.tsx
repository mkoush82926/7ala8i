"use client";

import React, { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ToastContainer } from "@/components/ui/toast";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, direction } = useThemeStore();
  const { isMobileSidebarOpen, setMobileSidebarOpen, initializeWorkspace } =
    useWorkspaceStore();

  // Initialize workspace data from Supabase
  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  // Apply theme and direction to html element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute(
      "lang",
      direction === "rtl" ? "ar" : "en",
    );
  }, [theme, direction]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <main className="transition-all duration-[var(--transition-normal)] md:ms-[72px]">
        <Topbar />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
      <ToastContainer />
    </div>
  );
}
