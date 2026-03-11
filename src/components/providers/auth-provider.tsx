"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useLeadsStore } from "@/store/leads-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initializeWorkspace = useWorkspaceStore((s) => s.initializeWorkspace);
  const fetchLeads = useLeadsStore((s) => s.fetchLeads);

  useEffect(() => {
    const supabase = createClient();

    async function hydrate() {
      await initializeWorkspace();
      await fetchLeads();
    }

    hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") hydrate();
    });

    return () => subscription.unsubscribe();
  }, [initializeWorkspace, fetchLeads]);

  return <>{children}</>;
}
