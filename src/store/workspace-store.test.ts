import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkspaceStore } from "./workspace-store";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

const initialState = {
  shopId: "",
  shopName: "",
  role: "shop_admin" as const,
  currentView: "master",
  teamSize: 0,
  barbers: [],
  isMobileSidebarOpen: false,
  initialized: false,
  hydrated: false,
};

describe("useWorkspaceStore", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    useWorkspaceStore.setState(initialState);
  });

  it("setShop updates shopId and shopName", () => {
    useWorkspaceStore.getState().setShop("shop-1", "Lumina");
    expect(useWorkspaceStore.getState()).toMatchObject({ shopId: "shop-1", shopName: "Lumina" });
  });

  it("toggleMobileSidebar flips the open state", () => {
    useWorkspaceStore.getState().toggleMobileSidebar();
    expect(useWorkspaceStore.getState().isMobileSidebarOpen).toBe(true);
  });

  it("initializeWorkspace is a no-op if already initialized", async () => {
    useWorkspaceStore.setState({ initialized: true });
    await useWorkspaceStore.getState().initializeWorkspace();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("does nothing (but marks hydrated) when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await useWorkspaceStore.getState().initializeWorkspace();
    expect(useWorkspaceStore.getState().initialized).toBe(false);
  });

  it("hydrates shop, role, and team from the authenticated user's profile", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock
      .mockReturnValueOnce(
        createQueryBuilder({ data: { shop_id: "shop-1", role: "shop_admin", full_name: "Owner" }, error: null }),
      )
      .mockReturnValueOnce(createQueryBuilder({ data: { id: "shop-1", name: "Lumina" }, error: null }))
      .mockReturnValueOnce(
        createQueryBuilder({
          data: [{ id: "u2", full_name: "Barber One", avatar_url: null, role: "barber" }],
          error: null,
        }),
      );

    await useWorkspaceStore.getState().initializeWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.hydrated).toBe(true);
    expect(state.shopId).toBe("shop-1");
    expect(state.shopName).toBe("Lumina");
    expect(state.teamSize).toBe(1);
    expect(state.barbers).toEqual([{ id: "u2", name: "Barber One", avatar: undefined }]);
  });

  it("marks hydrated even when an unexpected error occurs", async () => {
    getUserMock.mockRejectedValue(new Error("network down"));
    await useWorkspaceStore.getState().initializeWorkspace();
    expect(useWorkspaceStore.getState().hydrated).toBe(true);
    expect(useWorkspaceStore.getState().initialized).toBe(false);
  });
});
