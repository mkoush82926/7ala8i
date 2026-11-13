"use client";

import { create } from "zustand";
import type { Lead, LeadStage } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  getLeads,
  createLead as createLeadQuery,
  createLeads as createLeadsQuery,
  updateLead as updateLeadQuery,
  updateLeadStage,
  deleteLead as deleteLeadQuery,
  deleteLeads as deleteLeadsQuery,
} from "@/lib/queries/leads";
import { errorCodeOf } from "@/lib/queries/appointments";

export type { LeadStage };

/** A pipeline lead plus its persisted order within its column. */
export type LeadRecord = Lead & { position?: number | null };

/** Fields the create form / CSV import provide. */
export interface LeadDraft {
  name: string;
  phone?: string | null;
  email?: string | null;
  value?: number | null;
  notes?: string | null;
  stage?: LeadStage;
}

/**
 * Every mutation resolves (never throws) with a result the caller turns into
 * translated feedback. `code` is a stable error code for t.error.codes.
 */
export type LeadResult = { ok: true } | { ok: false; code: string | null };

type DrawerMode = "view" | "create";

interface LeadsState {
  leads: LeadRecord[];
  loading: boolean;
  /** True once the first fetch for the current shop finished (success or not). */
  loaded: boolean;
  /** Error code of the last failed fetch (null when OK). */
  error: string | null;
  selectedLead: LeadRecord | null;
  drawerOpen: boolean;
  drawerMode: DrawerMode;
  /** Stage pre-selected when the create form opens. */
  createStage: LeadStage;

  fetchLeads: () => Promise<void>;
  createLead: (draft: LeadDraft) => Promise<{ ok: true; lead: LeadRecord } | { ok: false; code: string | null }>;
  updateLead: (id: string, updates: Partial<LeadDraft>) => Promise<LeadResult>;
  deleteLead: (id: string) => Promise<LeadResult>;
  deleteLeads: (ids: string[]) => Promise<LeadResult>;
  /** Moves a lead to `stage` at `index` within that column (default: end). Persists stage + positions once. */
  moveLead: (id: string, stage: LeadStage, index?: number) => Promise<LeadResult>;
  importLeads: (drafts: LeadDraft[]) => Promise<{ ok: true; count: number } | { ok: false; code: string | null }>;

  selectLead: (lead: LeadRecord | null) => void;
  openCreate: (stage?: LeadStage) => void;
  closeDrawer: () => void;
  /** Back-compat: `false` closes the drawer, `true` opens the create form. */
  setDrawerOpen: (open: boolean) => void;
  /** Drops every lead and UI selection (sign-out / account switch). */
  resetLeads: () => void;
}

// ─── Helpers ───

function rowToLead(row: Record<string, unknown>): LeadRecord {
  const phone = (row.phone as string | null) ?? (row.contact as string | null) ?? "";
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    phone,
    email: (row.email as string | null) ?? null,
    value: row.value == null ? null : Number(row.value),
    stage: (row.stage as LeadStage) ?? "new",
    notes: (row.notes as string | null) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    contact: (row.contact as string | null) ?? null,
    position: row.position == null ? null : Number(row.position),
  };
}

/** Stable sort by position (nulls last). Per-column order is what the board renders. */
export function sortLeads(leads: LeadRecord[]): LeadRecord[] {
  return leads
    .map((l, i) => ({ l, i }))
    .sort((a, b) => {
      const pa = a.l.position ?? Number.POSITIVE_INFINITY;
      const pb = b.l.position ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa < pb ? -1 : 1;
      return a.i - b.i;
    })
    .map(({ l }) => l);
}

function localId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftToLead(draft: LeadDraft, id: string, position: number | null): LeadRecord {
  return {
    id,
    name: draft.name.trim(),
    phone: draft.phone?.trim() ?? "",
    email: draft.email?.trim() || null,
    value: draft.value ?? null,
    stage: draft.stage ?? "new",
    notes: draft.notes?.trim() || null,
    createdAt: new Date().toISOString(),
    contact: draft.phone?.trim() || null,
    position,
  };
}

// Per-lead version counters: a failed write only rolls back if no newer
// change to that same lead happened in the meantime (no stale snapshots).
const versions = new Map<string, number>();
function bump(id: string) {
  const v = (versions.get(id) ?? 0) + 1;
  versions.set(id, v);
  return v;
}
let fetchToken = 0;

const fail = (err: unknown): { ok: false; code: string | null } => ({ ok: false, code: errorCodeOf(err) });

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  loading: false,
  loaded: false,
  error: null,
  selectedLead: null,
  drawerOpen: false,
  drawerMode: "view",
  createStage: "new",

  resetLeads: () => {
    fetchToken++; // an in-flight fetch for the previous user must not land
    set({
      leads: [],
      loading: false,
      loaded: false,
      error: null,
      selectedLead: null,
      drawerOpen: false,
      drawerMode: "view",
      createStage: "new",
    });
  },

  fetchLeads: async () => {
    const shopId = useWorkspaceStore.getState().shopId;
    if (!shopId) return;

    const token = ++fetchToken;
    set({ loading: true, error: null });
    try {
      const { data, error } = await getLeads(createClient(), shopId);
      if (token !== fetchToken) return; // a newer fetch superseded this one
      if (error) {
        set({ loading: false, loaded: true, error: errorCodeOf(error) ?? "LOAD_FAILED" });
        return;
      }
      const leads = ((data ?? []) as Record<string, unknown>[]).map(rowToLead);
      set({ leads: sortLeads(leads), loading: false, loaded: true, error: null });
    } catch (err) {
      if (token !== fetchToken) return;
      set({ loading: false, loaded: true, error: errorCodeOf(err) ?? "LOAD_FAILED" });
    }
  },

  createLead: async (draft) => {
    const shopId = useWorkspaceStore.getState().shopId;
    if (!shopId) return { ok: false, code: "NO_SHOP" };
    const stage = draft.stage ?? "new";
    const column = get().leads.filter((l) => l.stage === stage);
    const minPos = column.reduce<number | null>(
      (min, l) => (l.position == null ? min : min == null ? l.position : Math.min(min, l.position)),
      null,
    );
    const position = (minPos ?? 0) - 1; // new leads go to the top of their column

    try {
      const { data, error } = await createLeadQuery(createClient(), shopId, {
        name: draft.name.trim(),
        phone: draft.phone?.trim() || null,
        email: draft.email?.trim() || null,
        value: draft.value ?? null,
        notes: draft.notes?.trim() || null,
        stage,
        position,
      });
      if (error) return fail(error);
      // Insert-only on Save: we always add the row with its real id. (The
      // local-preview mock returns no row; fall back to a local id there.)
      const lead = data ? rowToLead(data as Record<string, unknown>) : draftToLead({ ...draft, stage }, localId(), position);
      set((state) => ({ leads: sortLeads([lead, ...state.leads.filter((l) => l.id !== lead.id)]) }));
      return { ok: true, lead };
    } catch (err) {
      return fail(err);
    }
  },

  updateLead: async (id, updates) => {
    const prev = get().leads.find((l) => l.id === id);
    if (!prev) return { ok: false, code: "NOT_FOUND" };
    const v = bump(id);

    const patch: Partial<LeadRecord> = {};
    if (updates.name !== undefined) patch.name = updates.name.trim();
    if (updates.phone !== undefined) {
      patch.phone = updates.phone?.trim() ?? "";
      patch.contact = updates.phone?.trim() || null;
    }
    if (updates.email !== undefined) patch.email = updates.email?.trim() || null;
    if (updates.value !== undefined) patch.value = updates.value;
    if (updates.notes !== undefined) patch.notes = updates.notes?.trim() || null;
    if (updates.stage !== undefined) patch.stage = updates.stage;

    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      selectedLead: state.selectedLead?.id === id ? { ...state.selectedLead, ...patch } : state.selectedLead,
    }));

    const rollback = () => {
      if (versions.get(id) !== v) return;
      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? prev : l)),
        selectedLead: state.selectedLead?.id === id ? prev : state.selectedLead,
      }));
    };

    try {
      const { error } = await updateLeadQuery(createClient(), id, {
        ...(updates.name !== undefined ? { name: patch.name } : {}),
        ...(updates.phone !== undefined ? { phone: patch.phone || null } : {}),
        ...(updates.email !== undefined ? { email: patch.email ?? null } : {}),
        ...(updates.value !== undefined ? { value: patch.value ?? null } : {}),
        ...(updates.notes !== undefined ? { notes: patch.notes ?? null } : {}),
        ...(updates.stage !== undefined ? { stage: patch.stage } : {}),
      });
      if (error) {
        rollback();
        return fail(error);
      }
      return { ok: true };
    } catch (err) {
      rollback();
      return fail(err);
    }
  },

  deleteLead: async (id) => {
    const prev = get().leads.find((l) => l.id === id);
    if (!prev) return { ok: true };
    const v = bump(id);
    const wasSelected = get().selectedLead?.id === id;

    set((state) => ({
      leads: state.leads.filter((l) => l.id !== id),
      selectedLead: wasSelected ? null : state.selectedLead,
      drawerOpen: wasSelected ? false : state.drawerOpen,
    }));

    try {
      const { error } = await deleteLeadQuery(createClient(), id);
      if (error) {
        if (versions.get(id) === v) {
          set((state) => ({ leads: sortLeads([prev, ...state.leads.filter((l) => l.id !== id)]) }));
        }
        return fail(error);
      }
      versions.delete(id);
      return { ok: true };
    } catch (err) {
      if (versions.get(id) === v) {
        set((state) => ({ leads: sortLeads([prev, ...state.leads.filter((l) => l.id !== id)]) }));
      }
      return fail(err);
    }
  },

  deleteLeads: async (ids) => {
    if (ids.length === 0) return { ok: true };
    const idSet = new Set(ids);
    const prevItems = get().leads.filter((l) => idSet.has(l.id));
    const stamp = new Map(prevItems.map((l) => [l.id, bump(l.id)]));
    const selectedRemoved = !!get().selectedLead && idSet.has(get().selectedLead!.id);

    set((state) => ({
      leads: state.leads.filter((l) => !idSet.has(l.id)),
      selectedLead: selectedRemoved ? null : state.selectedLead,
      drawerOpen: selectedRemoved ? false : state.drawerOpen,
    }));

    const restore = () => {
      const back = prevItems.filter((l) => versions.get(l.id) === stamp.get(l.id));
      if (back.length) set((state) => ({ leads: sortLeads([...back, ...state.leads]) }));
    };

    try {
      // One statement — all-or-nothing, so there is no partial-failure state.
      const { error } = await deleteLeadsQuery(createClient(), ids);
      if (error) {
        restore();
        return fail(error);
      }
      return { ok: true };
    } catch (err) {
      restore();
      return fail(err);
    }
  },

  moveLead: async (id, stage, index) => {
    const all = get().leads;
    const moving = all.find((l) => l.id === id);
    if (!moving) return { ok: false, code: "NOT_FOUND" };

    const column = all.filter((l) => l.stage === stage && l.id !== id);
    const at = index === undefined ? column.length : Math.max(0, Math.min(index, column.length));
    const ordered = [...column.slice(0, at), moving, ...column.slice(at)];

    // Only leads whose stage or position actually changes get written.
    const changes = ordered
      .map((l, pos) => ({ prev: l, next: { ...l, stage, position: pos } }))
      .filter(({ prev, next }) => prev.stage !== next.stage || prev.position !== next.position);
    if (changes.length === 0) return { ok: true };

    const stamps = new Map(changes.map(({ prev }) => [prev.id, bump(prev.id)]));
    const nextById = new Map(changes.map(({ next }) => [next.id, next]));
    set((state) => ({
      leads: sortLeads(state.leads.map((l) => nextById.get(l.id) ?? l)),
      selectedLead:
        state.selectedLead && nextById.has(state.selectedLead.id)
          ? { ...state.selectedLead, ...nextById.get(state.selectedLead.id)! }
          : state.selectedLead,
    }));

    const supabase = createClient();
    try {
      const results = await Promise.all(
        changes.map(({ next }) => updateLeadStage(supabase, next.id, next.stage, next.position)),
      );
      const failed = results.find((r: { error: unknown }) => r.error);
      if (!failed) return { ok: true };

      // Roll back each item individually (only if not changed again since).
      const prevById = new Map(
        changes.filter(({ prev }) => versions.get(prev.id) === stamps.get(prev.id)).map(({ prev }) => [prev.id, prev]),
      );
      set((state) => ({
        leads: sortLeads(state.leads.map((l) => prevById.get(l.id) ?? l)),
        selectedLead:
          state.selectedLead && prevById.has(state.selectedLead.id)
            ? prevById.get(state.selectedLead.id)!
            : state.selectedLead,
      }));
      return fail((failed as { error: unknown }).error);
    } catch (err) {
      const prevById = new Map(
        changes.filter(({ prev }) => versions.get(prev.id) === stamps.get(prev.id)).map(({ prev }) => [prev.id, prev]),
      );
      set((state) => ({ leads: sortLeads(state.leads.map((l) => prevById.get(l.id) ?? l)) }));
      return fail(err);
    }
  },

  importLeads: async (drafts) => {
    const shopId = useWorkspaceStore.getState().shopId;
    if (!shopId) return { ok: false, code: "NO_SHOP" };
    const valid = drafts.filter((d) => d.name.trim().length > 0);
    if (valid.length === 0) return { ok: true, count: 0 };

    try {
      const { data, error } = await createLeadsQuery(
        createClient(),
        shopId,
        valid.map((d) => ({
          name: d.name.trim(),
          phone: d.phone?.trim() || null,
          email: d.email?.trim() || null,
          value: d.value ?? null,
          notes: d.notes?.trim() || null,
          stage: d.stage ?? "new",
        })),
      );
      if (error) return fail(error);
      const rows = (data ?? []) as Record<string, unknown>[];
      const imported = rows.length
        ? rows.map(rowToLead)
        : valid.map((d) => draftToLead(d, localId(), null)); // local-preview mock
      set((state) => ({ leads: sortLeads([...imported, ...state.leads]) }));
      return { ok: true, count: imported.length };
    } catch (err) {
      return fail(err);
    }
  },

  selectLead: (lead) =>
    set({ selectedLead: lead, drawerOpen: lead !== null, drawerMode: "view" }),

  openCreate: (stage = "new") =>
    set({ selectedLead: null, drawerOpen: true, drawerMode: "create", createStage: stage }),

  closeDrawer: () => set({ drawerOpen: false, selectedLead: null, drawerMode: "view" }),

  setDrawerOpen: (open) =>
    open
      ? set({ selectedLead: null, drawerOpen: true, drawerMode: "create", createStage: "new" })
      : set({ drawerOpen: false, selectedLead: null, drawerMode: "view" }),
}));
