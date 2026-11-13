import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

/** Staff roles that get a calendar lane / can be booked. */
const BOOKABLE_ROLES = ["shop_admin", "barber"] as const;

/**
 * The signed-in member's role. `null` until hydrated (never assume admin).
 * "client" / "super_admin" are legacy values some screens still compare
 * against; the DB only ever returns a UserRole.
 */
export type WorkspaceRole = UserRole | "super_admin" | "client" | null;

export interface WorkspaceBarber {
  id: string;
  name: string;
  avatar?: string;
  role: "shop_admin" | "barber";
}

/** Why the workspace has no shop to show (null when everything loaded). */
export type WorkspaceStatus = "ok" | "signed_out" | "no_shop" | "error";

interface WorkspaceState {
  userId: string | null;
  shopId: string;
  shopName: string;
  /** Shop currency code (ISO 4217); defaults to JOD. */
  currency: string;
  /** Shop IANA time zone; defaults to Asia/Amman. */
  timezone: string;
  role: WorkspaceRole;
  currentView: "master" | string; // "master" or barber_id
  teamSize: number;
  /** Everyone who can take bookings (barbers AND shop admins who cut hair). */
  barbers: WorkspaceBarber[];
  isMobileSidebarOpen: boolean;
  initialized: boolean;
  hydrated: boolean;
  status: WorkspaceStatus | null;
  error: string | null;

  setShop: (id: string, name: string) => void;
  setRole: (role: WorkspaceRole) => void;
  setCurrentView: (view: string) => void;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;
  /** Loads the workspace once; later calls are no-ops (use refreshWorkspace). */
  initializeWorkspace: () => Promise<void>;
  /** Re-fetches shop, role and team — call after team/shop mutations. */
  refreshWorkspace: () => Promise<void>;
  /** Clears everything (sign-out / user switch). */
  resetWorkspace: () => void;
}

const INITIAL_DATA = {
  userId: null,
  shopId: "",
  shopName: "",
  currency: "JOD",
  timezone: "Asia/Amman",
  role: null,
  currentView: "master",
  teamSize: 0,
  barbers: [] as WorkspaceBarber[],
  initialized: false,
  hydrated: false,
  status: null,
  error: null,
} satisfies Partial<WorkspaceState>;

// Concurrent callers (layout effect + auth listener) share one request.
let inflight: Promise<void> | null = null;
// Bumped by resetWorkspace so a fetch that started before sign-out can't
// write the previous user's shop back into the store.
let generation = 0;

function isBookableRole(role: unknown): role is WorkspaceBarber["role"] {
  return (BOOKABLE_ROLES as readonly unknown[]).includes(role);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const load = async () => {
    const gen = generation;
    const apply = (patch: Partial<WorkspaceState>) => {
      if (gen === generation) set(patch);
    };

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        apply({ ...INITIAL_DATA, hydrated: true, status: "signed_out" });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("shop_id, role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !profile.shop_id) {
        apply({
          ...INITIAL_DATA,
          userId: user.id,
          role: (profile?.role as WorkspaceRole) ?? null,
          hydrated: true,
          initialized: true,
          status: "no_shop",
        });
        return;
      }

      const shopId = profile.shop_id as string;

      const [shopRes, teamRes] = await Promise.all([
        supabase.from("shops").select("id, name, currency, timezone").eq("id", shopId).maybeSingle(),
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role")
          .eq("shop_id", shopId)
          .in("role", [...BOOKABLE_ROLES])
          .order("created_at", { ascending: true }),
      ]);

      if (teamRes.error) throw teamRes.error;

      const barbers: WorkspaceBarber[] = (teamRes.data ?? [])
        .filter((member) => isBookableRole(member.role))
        .map((member) => ({
          id: member.id,
          name: member.full_name ?? "",
          avatar: member.avatar_url ?? undefined,
          role: member.role as WorkspaceBarber["role"],
        }));

      // Drop a lane selection that points at someone who left the team.
      const view = get().currentView;
      const currentView =
        view === "master" || barbers.some((b) => b.id === view) ? view : "master";

      apply({
        userId: user.id,
        shopId,
        shopName: shopRes.data?.name ?? "",
        currency: shopRes.data?.currency || "JOD",
        timezone: shopRes.data?.timezone || "Asia/Amman",
        role: profile.role as WorkspaceRole,
        teamSize: barbers.length,
        barbers,
        currentView,
        initialized: true,
        hydrated: true,
        status: "ok",
        error: null,
      });
    } catch (err) {
      console.error("[Workspace] Failed to initialize:", err);
      // Mark hydrated even on error so the UI doesn't wait forever; keep any
      // data we already had so a failed refresh doesn't blank the dashboard.
      apply({
        hydrated: true,
        status: get().initialized ? get().status : "error",
        error: err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err),
      });
    }
  };

  const run = () => {
    if (!inflight) {
      const p: Promise<void> = load().finally(() => {
        if (inflight === p) inflight = null;
      });
      inflight = p;
    }
    return inflight;
  };

  return {
    ...INITIAL_DATA,
    isMobileSidebarOpen: false,

    setShop: (id, name) => set({ shopId: id, shopName: name }),
    setRole: (role) => set({ role }),
    setCurrentView: (view) => set({ currentView: view }),
    toggleMobileSidebar: () =>
      set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
    setMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),

    initializeWorkspace: async () => {
      if (get().initialized) return;
      await run();
    },

    refreshWorkspace: async () => {
      // A refresh must not piggy-back on a request that started before the
      // mutation it reflects — wait for it, then fetch again.
      if (inflight) await inflight.catch(() => undefined);
      await run();
    },

    resetWorkspace: () => {
      generation++;
      inflight = null;
      set({ ...INITIAL_DATA, isMobileSidebarOpen: false });
    },
  };
});
