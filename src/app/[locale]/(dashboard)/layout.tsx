"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, useShellRole } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation } from "@/hooks/use-translation";
import { canAccessPath, homePathFor, stripLocale } from "@/components/layout/nav-config";

/*
 * Dashboard shell. Theme, dir and lang are owned by the root ThemeProvider
 * (which also mounts the single ToastContainer), so this layout only wires
 * the workspace, the navigation chrome and the role guard.
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
      <Sidebar />
      <Topbar />
      <main id="main" tabIndex={-1} className="main-content min-h-screen outline-none">
        <div className="page-padding pb-24 pt-[92px]">
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
            children
          ) : (
            <DashboardSkeleton />
          )}
        </div>
      </main>
    </div>
  );
}
