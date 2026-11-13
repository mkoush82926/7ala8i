"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useLeadsStore } from "@/store/leads-store";

/**
 * Keeps the dashboard workspace in sync with the Supabase session:
 * - hydrates the workspace (shop, role, team) and leads once on mount;
 * - re-hydrates when a *different* user signs in (account switch in another tab);
 * - clears all workspace and leads state on sign-out so the next user never sees the
 *   previous user's shop.
 * Token refreshes and same-user SIGNED_IN echoes are ignored.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initializeWorkspace = useWorkspaceStore((s) => s.initializeWorkspace);
  const refreshWorkspace = useWorkspaceStore((s) => s.refreshWorkspace);
  const resetWorkspace = useWorkspaceStore((s) => s.resetWorkspace);
  const fetchLeads = useLeadsStore((s) => s.fetchLeads);
  const resetLeads = useLeadsStore((s) => s.resetLeads);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const loadLeads = async () => {
      const ws = useWorkspaceStore.getState();
      // Leads are admin-only under RLS; skip the request for barbers.
      if (cancelled || !ws.shopId || ws.role !== "shop_admin") return;
      try {
        await fetchLeads();
      } catch (err) {
        console.error("[AuthProvider] Failed to load leads:", err);
      }
    };

    (async () => {
      await initializeWorkspace();
      await loadLeads();
    })();

    // The local mock client has no auth events; just hydrate once there.
    if (typeof supabase.auth.onAuthStateChange !== "function") {
      return () => {
        cancelled = true;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        resetWorkspace();
        resetLeads();
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        const nextUserId = session?.user?.id ?? null;
        const { userId, initialized } = useWorkspaceStore.getState();
        if (initialized && nextUserId && nextUserId === userId) return;
        // Defer: supabase-js warns against awaiting other auth calls inside
        // this callback (it can deadlock the auth lock).
        setTimeout(async () => {
          if (cancelled) return;
          if (userId && nextUserId !== userId) {
            resetWorkspace();
            resetLeads();
          }
          await refreshWorkspace();
          await loadLeads();
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initializeWorkspace, refreshWorkspace, resetWorkspace, fetchLeads, resetLeads]);

  return <>{children}</>;
}
