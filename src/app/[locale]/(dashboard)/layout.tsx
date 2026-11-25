"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, useShellRole, useSidebarWidth } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";
import { canAccessPath, homePathFor, stripLocale } from "@/components/layout/nav-config";
import { InstallPrompt } from "@/components/pwa/install-prompt";

/*
 * Dashboard shell (v2 §5.10). Theme, dir and lang are owned by the root
 * ThemeProvider (which also mounts the single ToastContainer), so this layout
 * only wires the workspace, the navigation chrome and the role guard.
 *
 * Chrome: 240px labelled sidebar (72px collapsed) from lg, a bottom tab bar
 * below lg, and a fixed 64px topbar. `--sidebar-width` is set here so the
 * sidebar, topbar and content offset always agree.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const initializeWorkspace = useWorkspaceStore((s) => s.initializeWorkspace);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const status = useWorkspaceStore((s) => s.status);
  const refreshWorkspace = useWorkspaceStore((s) => s.refreshWorkspace);
  const role = useShellRole();
  const pathname = usePathname();
  const router = useRouter();
  const { t, href } = useTranslation();
  const sidebarWidth = useSidebarWidth();

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  // Role guard (UX only — RLS is the real boundary): barbers who open an
  // admin page land on My Day; customers who reach the shell go to their portal.
  // A failed first load leaves role null; that is not a customer. Show a retry
  // state instead of redirecting (middleware would bounce staff back here).
  const path = stripLocale(pathname);
  const loadFailed = hydrated && status === "error";
  const isCustomer = hydrated && !loadFailed && status !== "signed_out" && role === null;
  const allowed = !hydrated || loadFailed || (!isCustomer && canAccessPath(role, path));

  useEffect(() => {
    if (!hydrated || allowed) return;
    const target = status === "signed_out" ? "/auth/login" : isCustomer ? "/customer" : homePathFor(role);
    router.replace(href(target));
  }, [allowed, hydrated, href, isCustomer, role, router, status]);

  return (
    <div
      className="min-h-dvh bg-page text-ink antialiased"
      style={{ "--sidebar-width": sidebarWidth } as React.CSSProperties}
    >
      <Sidebar />
      <Topbar />
      <main
        id="main"
        tabIndex={-1}
        className="min-h-dvh outline-none transition-[margin] duration-200 ease-standard motion-reduce:transition-none lg:ms-[var(--sidebar-width)]"
      >
        {/* 64px topbar above; the mobile tab bar (64px + safe area) below */}
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-20 sm:px-6 lg:px-8 lg:pb-12 lg:pt-[88px]">
          {loadFailed ? (
            <EmptyState
              tone="error"
              size="lg"
              headingLevel={2}
              title={t.error.title}
              description={t.error.message}
              action={{ label: t.common.retry, onClick: () => void refreshWorkspace() }}
            />
          ) : allowed ? (
            <>
              {/* WS-1K: offer the app install where staff start their day. Renders nothing once installed or snoozed. */}
              {(path === "/my-day" || path === "/calendar") && <InstallPrompt variant="compact" className="mb-4" />}
              {children}
            </>
          ) : (
            <DashboardSkeleton />
          )}
        </div>
      </main>
    </div>
  );
}
