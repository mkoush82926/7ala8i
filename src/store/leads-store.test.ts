import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLeadsStore } from "./leads-store";
import { useWorkspaceStore } from "./workspace-store";
import type { Lead } from "@/lib/types";
import { createQueryBuilder as makeQueryBuilder } from "@/test/mocks/supabase-query-builder";

const fromMock = vi.fn(() => makeQueryBuilder());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}));

const baseLead: Lead = {
  id: "local-1",
  name: "Sara",
  phone: "0791234567",
  stage: "new",
  value: 100,
  notes: null,
  createdAt: new Date().toISOString(),
};

describe("useLeadsStore", () => {
  beforeEach(() => {
    fromMock.mockClear();
    fromMock.mockReturnValue(makeQueryBuilder());
    useLeadsStore.setState({ leads: [], loading: false, selectedLead: null, drawerOpen: false });
    useWorkspaceStore.setState({ shopId: "" });
  });

  it("does not fetch when no shopId is set on the workspace store", async () => {
    await useLeadsStore.getState().fetchLeads();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fetches and normalizes leads for the current shop", async () => {
    useWorkspaceStore.setState({ shopId: "shop-1" });
    fromMock.mockReturnValue(
      makeQueryBuilder({
        data: [
          { id: "1", name: "Sara", contact: "0791234567", value: 50, stage: "new", notes: null, created_at: "2026-01-01" },
        ],
        error: null,
      }),
    );

    await useLeadsStore.getState().fetchLeads();

    expect(useLeadsStore.getState().leads).toEqual([
      {
        id: "1",
        name: "Sara",
        phone: "0791234567",
        email: null,
        value: 50,
        stage: "new",
        notes: null,
        createdAt: "2026-01-01",
        contact: "0791234567",
      },
    ]);
    expect(useLeadsStore.getState().loading).toBe(false);
  });

  it("adds a lead optimistically before the DB call resolves", () => {
    useLeadsStore.getState().addLead(baseLead);
    expect(useLeadsStore.getState().leads).toContainEqual(baseLead);
  });

  it("updates a lead in place, including the selected lead", () => {
    useLeadsStore.setState({ leads: [baseLead], selectedLead: baseLead });
    useLeadsStore.getState().updateLead(baseLead.id, { name: "Sara Updated" });

    expect(useLeadsStore.getState().leads[0].name).toBe("Sara Updated");
    expect(useLeadsStore.getState().selectedLead?.name).toBe("Sara Updated");
  });

  it("deletes a lead and closes the drawer if it was selected", () => {
    useLeadsStore.setState({ leads: [baseLead], selectedLead: baseLead, drawerOpen: true });
    useLeadsStore.getState().deleteLead(baseLead.id);

    expect(useLeadsStore.getState().leads).toHaveLength(0);
    expect(useLeadsStore.getState().selectedLead).toBeNull();
    expect(useLeadsStore.getState().drawerOpen).toBe(false);
  });

  it("bulk-deletes leads by id", () => {
    const second: Lead = { ...baseLead, id: "local-2" };
    useLeadsStore.setState({ leads: [baseLead, second] });
    useLeadsStore.getState().deleteLeads([baseLead.id]);

    expect(useLeadsStore.getState().leads).toEqual([second]);
  });

  it("moves a lead to a new stage", () => {
    useLeadsStore.setState({ leads: [baseLead] });
    useLeadsStore.getState().moveLead(baseLead.id, "booked");

    expect(useLeadsStore.getState().leads[0].stage).toBe("booked");
  });

  it("selecting a lead opens the drawer; deselecting closes it", () => {
    useLeadsStore.getState().selectLead(baseLead);
    expect(useLeadsStore.getState().drawerOpen).toBe(true);

    useLeadsStore.getState().selectLead(null);
    expect(useLeadsStore.getState().drawerOpen).toBe(false);
  });

  it("imports leads by prepending them to the existing list", () => {
    useLeadsStore.setState({ leads: [baseLead] });
    const imported: Lead = { ...baseLead, id: "imported-1" };
    useLeadsStore.getState().importLeads([imported]);

    expect(useLeadsStore.getState().leads.map((l) => l.id)).toEqual(["imported-1", baseLead.id]);
  });
});
