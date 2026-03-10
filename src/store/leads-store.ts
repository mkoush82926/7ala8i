import { create } from "zustand";
import { leads as initialLeads, type Lead } from "@/lib/mock-data";

export type LeadStage = "new" | "contacted" | "booked" | "completed" | "loyal";

interface LeadsState {
  leads: Lead[];
  selectedLead: Lead | null;
  drawerOpen: boolean;
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  deleteLeads: (ids: string[]) => void;
  moveLead: (id: string, stage: LeadStage) => void;
  selectLead: (lead: Lead | null) => void;
  setDrawerOpen: (open: boolean) => void;
  importLeads: (newLeads: Lead[]) => void;
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: initialLeads,
  selectedLead: null,
  drawerOpen: false,

  addLead: (lead) => set((state) => ({ leads: [lead, ...state.leads] })),

  updateLead: (id, updates) =>
    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      selectedLead:
        state.selectedLead?.id === id
          ? { ...state.selectedLead, ...updates }
          : state.selectedLead,
    })),

  deleteLead: (id) =>
    set((state) => ({
      leads: state.leads.filter((l) => l.id !== id),
      selectedLead: state.selectedLead?.id === id ? null : state.selectedLead,
      drawerOpen: state.selectedLead?.id === id ? false : state.drawerOpen,
    })),

  deleteLeads: (ids) =>
    set((state) => ({
      leads: state.leads.filter((l) => !ids.includes(l.id)),
      selectedLead:
        state.selectedLead && ids.includes(state.selectedLead.id)
          ? null
          : state.selectedLead,
      drawerOpen:
        state.selectedLead && ids.includes(state.selectedLead.id)
          ? false
          : state.drawerOpen,
    })),

  moveLead: (id, stage) =>
    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, stage } : l)),
    })),

  selectLead: (lead) => set({ selectedLead: lead, drawerOpen: lead !== null }),

  setDrawerOpen: (open) =>
    set({ drawerOpen: open, selectedLead: open ? undefined : null }),

  importLeads: (newLeads) =>
    set((state) => ({ leads: [...newLeads, ...state.leads] })),
}));
