"use client";

import { create } from "zustand";
import type { Lead, LeadStage } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "@/components/ui/toast";

type MutationResult = { error: { message: string } | null };

export type { LeadStage };

interface LeadsState {
  leads: Lead[];
  loading: boolean;
  selectedLead: Lead | null;
  drawerOpen: boolean;
  fetchLeads: () => Promise<void>;
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  deleteLeads: (ids: string[]) => void;
  moveLead: (id: string, stage: LeadStage) => void;
  selectLead: (lead: Lead | null) => void;
  setDrawerOpen: (open: boolean) => void;
  importLeads: (newLeads: Lead[]) => void;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  loading: false,
  selectedLead: null,
  drawerOpen: false,

  fetchLeads: async () => {
    const shopId = useWorkspaceStore.getState().shopId;
    if (!shopId) return;

    set({ loading: true });
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("leads") as any)
      .select("*")
      .eq("shop_id", shopId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && data) {
      const leads: Lead[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        phone: (row.contact as string) ?? "",
        email: null,
        value: row.value as number | null,
        stage: row.stage as LeadStage,
        notes: row.notes as string | null,
        createdAt: (row.created_at as string) ?? new Date().toISOString(),
        contact: row.contact as string | null,
      }));
      set({ leads });
    }
    set({ loading: false });
  },

  addLead: (lead) => {
    const previousLeads = get().leads;
    set((state) => ({ leads: [lead, ...state.leads] }));

    // Persist to Supabase
    const shopId = useWorkspaceStore.getState().shopId;
    if (shopId) {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("leads") as any)
        .insert({
          shop_id: shopId,
          name: lead.name,
          contact: lead.phone,
          stage: lead.stage,
          value: lead.value,
          notes: lead.notes,
        })
        .select()
        .single()
        .then(({ data, error }: { data: { id: string } | null } & MutationResult) => {
          if (error || !data) {
            set({ leads: previousLeads });
            toast("error", "Failed to save lead. Please try again.");
            return;
          }
          // Update ID with the real DB ID
          set((state) => ({
            leads: state.leads.map((l) =>
              l.id === lead.id ? { ...l, id: data.id } : l,
            ),
          }));
        });
    }
  },

  updateLead: (id, updates) => {
    const previousLeads = get().leads;
    const previousSelectedLead = get().selectedLead;

    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      selectedLead:
        state.selectedLead?.id === id
          ? { ...state.selectedLead, ...updates }
          : state.selectedLead,
    }));

    // Persist to Supabase
    const supabase = createClient();
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.contact = updates.phone;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.value !== undefined) dbUpdates.value = updates.value;
    if (updates.stage) dbUpdates.stage = updates.stage;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("leads") as any)
      .update(dbUpdates)
      .eq("id", id)
      .then(({ error }: MutationResult) => {
        if (error) {
          set({ leads: previousLeads, selectedLead: previousSelectedLead });
          toast("error", "Failed to update lead. Please try again.");
        }
      });
  },

  deleteLead: (id) => {
    const previousLeads = get().leads;
    const previousSelectedLead = get().selectedLead;
    const previousDrawerOpen = get().drawerOpen;

    set((state) => ({
      leads: state.leads.filter((l) => l.id !== id),
      selectedLead: state.selectedLead?.id === id ? null : state.selectedLead,
      drawerOpen: state.selectedLead?.id === id ? false : state.drawerOpen,
    }));

    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("leads") as any)
      .delete()
      .eq("id", id)
      .then(({ error }: MutationResult) => {
        if (error) {
          set({
            leads: previousLeads,
            selectedLead: previousSelectedLead,
            drawerOpen: previousDrawerOpen,
          });
          toast("error", "Failed to delete lead. Please try again.");
        }
      });
  },

  deleteLeads: (ids) => {
    const previousLeads = get().leads;
    const previousSelectedLead = get().selectedLead;
    const previousDrawerOpen = get().drawerOpen;

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
    }));

    const supabase = createClient();
    Promise.all(
      ids.map(
        (id) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("leads") as any).delete().eq("id", id) as Promise<MutationResult>,
      ),
    ).then((results) => {
      if (results.some((r) => r.error)) {
        set({
          leads: previousLeads,
          selectedLead: previousSelectedLead,
          drawerOpen: previousDrawerOpen,
        });
        toast("error", "Failed to delete some leads. Please try again.");
      }
    });
  },

  moveLead: (id, stage) => {
    const previousLeads = get().leads;

    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, stage } : l)),
    }));

    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("leads") as any)
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", id)
      .then(({ error }: MutationResult) => {
        if (error) {
          set({ leads: previousLeads });
          toast("error", "Failed to move lead. Please try again.");
        }
      });
  },

  selectLead: (lead) => set({ selectedLead: lead, drawerOpen: lead !== null }),

  setDrawerOpen: (open) =>
    set({ drawerOpen: open, selectedLead: open ? undefined : null }),

  importLeads: (newLeads) => {
    const previousLeads = get().leads;
    set((state) => ({ leads: [...newLeads, ...state.leads] }));

    // Persist to Supabase
    const shopId = useWorkspaceStore.getState().shopId;
    if (!shopId) return;

    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("leads") as any)
      .insert(
        newLeads.map((lead) => ({
          shop_id: shopId,
          name: lead.name,
          contact: lead.phone,
          stage: lead.stage,
          value: lead.value,
          notes: lead.notes,
        })),
      )
      .select()
      .then(({ data, error }: { data: { id: string }[] | null } & MutationResult) => {
        if (error || !data) {
          set({ leads: previousLeads });
          toast("error", "Failed to import leads. Please try again.");
          return;
        }
        // Swap the client-generated placeholder ids for the real DB ids,
        // matching rows back to their source lead by insertion order.
        set((state) => {
          const importedIds = new Set(newLeads.map((l) => l.id));
          let idx = 0;
          return {
            leads: state.leads.map((l) => {
              if (importedIds.has(l.id) && idx < data.length) {
                return { ...l, id: data[idx++].id };
              }
              return l;
            }),
          };
        });
        toast("success", `Imported ${data.length} lead${data.length === 1 ? "" : "s"}.`);
      });
  },
}));
