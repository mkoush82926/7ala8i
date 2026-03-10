import { create } from "zustand";

interface WorkspaceState {
    shopId: string;
    shopName: string;
    role: "super_admin" | "shop_admin" | "barber" | "client";
    currentView: "master" | string; // "master" or barber_id
    teamSize: number;
    barbers: { id: string; name: string; avatar?: string }[];
    isMobileSidebarOpen: boolean;
    setShop: (id: string, name: string) => void;
    setRole: (role: WorkspaceState["role"]) => void;
    setCurrentView: (view: string) => void;
    toggleMobileSidebar: () => void;
    setMobileSidebarOpen: (isOpen: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
    shopId: "shop-001",
    shopName: "The Gentlemen's Den",
    role: "shop_admin",
    currentView: "master",
    teamSize: 5,
    isMobileSidebarOpen: false,
    barbers: [
        { id: "barber-001", name: "Ahmad Al-Masri" },
        { id: "barber-002", name: "Khalid Nasser" },
        { id: "barber-003", name: "Omar Haddad" },
        { id: "barber-004", name: "Faris Jabari" },
        { id: "barber-005", name: "Yousef Qasem" },
    ],
    setShop: (id, name) => set({ shopId: id, shopName: name }),
    setRole: (role) => set({ role }),
    setCurrentView: (view) => set({ currentView: view }),
    toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
    setMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),
}));
