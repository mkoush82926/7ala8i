import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

interface WorkspaceState {
  shopId: string;
  shopName: string;
  role: "super_admin" | "shop_admin" | "barber" | "client";
  currentView: "master" | string; // "master" or barber_id
  teamSize: number;
  barbers: { id: string; name: string; avatar?: string }[];
  isMobileSidebarOpen: boolean;
  initialized: boolean;
  hydrated: boolean;

  setShop: (id: string, name: string) => void;
  setRole: (role: WorkspaceState["role"]) => void;
  setCurrentView: (view: string) => void;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;
  initializeWorkspace: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  shopId: "",
  shopName: "",
  role: "shop_admin",
  currentView: "master",
  teamSize: 0,
  isMobileSidebarOpen: false,
  barbers: [],
  initialized: false,
  hydrated: false,

  setShop: (id, name) => set({ shopId: id, shopName: name }),
  setRole: (role) => set({ role }),
  setCurrentView: (view) => set({ currentView: view }),
  toggleMobileSidebar: () =>
    set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
  setMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),

  initializeWorkspace: async () => {
    if (get().initialized) return;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Fetch user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("shop_id, role, full_name")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      // Fetch shop details
      const { data: shop } = await supabase
        .from("shops")
        .select("id, name")
        .eq("id", profile.shop_id)
        .single();

      // Fetch team members (barbers + admins)
      const { data: team } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("shop_id", profile.shop_id);

      const barbers = (team ?? []).map((member) => ({
        id: member.id,
        name: member.full_name,
        avatar: member.avatar_url ?? undefined,
      }));

      set({
        shopId: profile.shop_id,
        shopName: shop?.name ?? "",
        role: profile.role,
        teamSize: barbers.length,
        barbers,
        initialized: true,
        hydrated: true,
      });
    } catch (err) {
      console.error("[Workspace] Failed to initialize:", err);
      set({ hydrated: true }); // Mark hydrated even on error so UI doesn't wait forever
    }
  },
}));
