"use client";

import React, { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ToastContainer } from "@/components/ui/toast";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useThemeStore();
  const { dir, locale } = useTranslation();
  const { initializeWorkspace } = useWorkspaceStore();

  // Initialize workspace data from Supabase
  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  // Apply theme and direction to html element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", locale);
  }, [theme, dir, locale]);

  return (
    /* Stitch body: bg-background text-on-surface antialiased */
    <div className="min-h-screen bg-background text-on-surface antialiased">
      <Sidebar />

      {/* Stitch: ml-72 mt-20 min-h-screen p-10 lg:p-14 */}
      <main
        className={`main-content transition-all duration-300`}
        style={{ minHeight: "100vh" }}
      >
        <Topbar />
        <div
          className="page-padding"
          style={{ paddingTop: "92px", paddingBottom: "96px" }}
        >
          {children}
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
