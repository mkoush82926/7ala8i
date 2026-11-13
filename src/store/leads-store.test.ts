import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLeadsStore, sortLeads, type LeadRecord } from "./leads-store";
import { useWorkspaceStore } from "./workspace-store";
import { createQueryBuilder as makeQueryBuilder } from "@/test/mocks/supabase-query-builder";

const fromMock = vi.fn(() => makeQueryBuilder());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}));

const baseLead: LeadRecord = {
  id: "lead-1",
  name: "Sara",
  phone: "0791234567",
  stage: "new",
  value: 100,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  position: 0,
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useLeadsStore", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fromMock.mockImplementation(() => makeQueryBuilder());
    useLeadsStore.setState({
      leads: [],
      loading: false,
      loaded: false,
      error: null,
      selectedLead: null,
      drawerOpen: false,
      drawerMode: "view",
      createStage: "new",
    });
    useWorkspaceStore.setState({ shopId: "shop-1" });
  });

  it("does not fetch when no shopId is set on the workspace store", async () => {
    useWorkspaceStore.setState({ shopId: "" });
    await useLeadsStore.getState().fetchLeads();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fetches and normalizes leads (phone falls back to legacy contact)", async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({
        data: [
          { id: "1", name: "Sara", phone: null, contact: "0791234567", email: "s@x.io", value: 50, stage: "new", notes: null, position: 2, created_at: "2026-01-01" },
        ],
        error: null,
      }),
    );

    await useLeadsStore.getState().fetchLeads();

    const state = useLeadsStore.getState();
    expect(state.leads).toEqual([
      {
        id: "1",
        name: "Sara",
        phone: "0791234567",
        email: "s@x.io",
        value: 50,
        stage: "new",
        notes: null,
        createdAt: "2026-01-01",
        contact: "0791234567",
        position: 2,
      },
    ]);
    expect(state.loading).toBe(false);
    expect(state.loaded).toBe(true);
    expect(state.error).toBeNull();
  });

  it("records a fetch error instead of silently showing an empty board", async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: { message: "boom", code: "42501" } }));
    await useLeadsStore.getState().fetchLeads();
    expect(useLeadsStore.getState().error).toBe("FORBIDDEN");
    expect(useLeadsStore.getState().loaded).toBe(true);
  });

  it("createLead inserts first and adds the row with its real DB id", async () => {
    const builder = makeQueryBuilder({
      data: { id: "db-1", name: "Omar", phone: "079", stage: "contacted", position: -1, created_at: "2026-02-02" },
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await useLeadsStore.getState().createLead({ name: "  Omar ", phone: "079", stage: "contacted" });

    expect(result.ok).toBe(true);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ shop_id: "shop-1", name: "Omar", stage: "contacted", phone: "079", contact: "079" }),
    );
    expect(useLeadsStore.getState().leads.map((l) => l.id)).toEqual(["db-1"]);
  });

  it("createLead adds nothing when the insert fails", async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: { message: "nope", code: "42501" } }));
    const result = await useLeadsStore.getState().createLead({ name: "Omar" });
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(useLeadsStore.getState().leads).toHaveLength(0);
  });

  it("updates a lead optimistically, including the selected lead", async () => {
    useLeadsStore.setState({ leads: [baseLead], selectedLead: baseLead });
    const pending = useLeadsStore.getState().updateLead(baseLead.id, { name: "Sara Updated" });

    expect(useLeadsStore.getState().leads[0].name).toBe("Sara Updated");
    expect(useLeadsStore.getState().selectedLead?.name).toBe("Sara Updated");
    expect(await pending).toEqual({ ok: true });
  });

  it("rolls back only the failed lead, not unrelated later changes", async () => {
    const other: LeadRecord = { ...baseLead, id: "lead-2", name: "Ali", position: 1 };
    useLeadsStore.setState({ leads: [baseLead, other] });

    const slow = deferred<{ data: null; error: unknown }>();
    const failing = makeQueryBuilder();
    failing.then = (resolve: (v: unknown) => void) => slow.promise.then(resolve);
    fromMock.mockReturnValueOnce(failing).mockReturnValue(makeQueryBuilder());

    const first = useLeadsStore.getState().updateLead("lead-1", { name: "Sara X" });
    await useLeadsStore.getState().updateLead("lead-2", { name: "Ali Y" });
    slow.resolve({ data: null, error: { message: "fail" } });
    const result = await first;

    expect(result.ok).toBe(false);
    const names = useLeadsStore.getState().leads.map((l) => l.name);
    expect(names).toEqual(["Sara", "Ali Y"]);
  });

  it("deletes a lead and closes the drawer if it was selected", async () => {
    useLeadsStore.setState({ leads: [baseLead], selectedLead: baseLead, drawerOpen: true });
    const result = await useLeadsStore.getState().deleteLead(baseLead.id);

    expect(result.ok).toBe(true);
    expect(useLeadsStore.getState().leads).toHaveLength(0);
    expect(useLeadsStore.getState().selectedLead).toBeNull();
    expect(useLeadsStore.getState().drawerOpen).toBe(false);
  });

  it("restores a lead whose delete failed", async () => {
    useLeadsStore.setState({ leads: [baseLead] });
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: { message: "x" } }));
    const result = await useLeadsStore.getState().deleteLead(baseLead.id);
    expect(result.ok).toBe(false);
    expect(useLeadsStore.getState().leads).toEqual([baseLead]);
  });

  it("bulk-deletes leads in a single statement", async () => {
    const second: LeadRecord = { ...baseLead, id: "lead-2", position: 1 };
    const builder = makeQueryBuilder();
    fromMock.mockReturnValue(builder);
    useLeadsStore.setState({ leads: [baseLead, second] });
    await useLeadsStore.getState().deleteLeads([baseLead.id]);

    expect(builder.in).toHaveBeenCalledWith("id", ["lead-1"]);
    expect(useLeadsStore.getState().leads).toEqual([second]);
  });

  it("moves a lead to a new stage and persists stage + position once", async () => {
    const builder = makeQueryBuilder();
    fromMock.mockReturnValue(builder);
    useLeadsStore.setState({ leads: [baseLead] });
    const result = await useLeadsStore.getState().moveLead(baseLead.id, "booked");

    expect(result.ok).toBe(true);
    expect(useLeadsStore.getState().leads[0]).toMatchObject({ stage: "booked", position: 0 });
    expect(builder.update).toHaveBeenCalledTimes(1);
    expect(builder.update).toHaveBeenCalledWith({ stage: "booked", position: 0 });
  });

  it("does not write when a lead is dropped where it already is", async () => {
    useLeadsStore.setState({ leads: [baseLead] });
    await useLeadsStore.getState().moveLead(baseLead.id, "new", 0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("reorders within a column and rolls back on failure", async () => {
    const b: LeadRecord = { ...baseLead, id: "lead-2", name: "B", position: 1 };
    useLeadsStore.setState({ leads: [baseLead, b] });
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: { message: "x" } }));

    const pending = useLeadsStore.getState().moveLead("lead-2", "new", 0);
    expect(useLeadsStore.getState().leads.map((l) => l.id)).toEqual(["lead-2", "lead-1"]);
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(useLeadsStore.getState().leads.map((l) => l.id)).toEqual(["lead-1", "lead-2"]);
  });

  it("selecting a lead opens the drawer in view mode; closing clears it", () => {
    useLeadsStore.getState().selectLead(baseLead);
    expect(useLeadsStore.getState()).toMatchObject({ drawerOpen: true, drawerMode: "view" });

    useLeadsStore.getState().closeDrawer();
    expect(useLeadsStore.getState()).toMatchObject({ drawerOpen: false, selectedLead: null });
  });

  it("openCreate opens an empty create form preset to a stage (no DB write)", () => {
    useLeadsStore.getState().openCreate("contacted");
    expect(useLeadsStore.getState()).toMatchObject({
      drawerOpen: true,
      drawerMode: "create",
      createStage: "contacted",
      selectedLead: null,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("imports leads after the insert resolves, using the returned rows", async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: [{ id: "db-9", name: "Imported", stage: "new", created_at: "2026-03-03" }], error: null }),
    );
    useLeadsStore.setState({ leads: [baseLead] });
    const result = await useLeadsStore.getState().importLeads([{ name: "Imported" }, { name: "   " }]);

    expect(result).toEqual({ ok: true, count: 1 });
    expect(useLeadsStore.getState().leads.map((l) => l.id)).toEqual(["lead-1", "db-9"]);
  });
});

describe("sortLeads", () => {
  it("sorts by position with nulls last and keeps ties stable", () => {
    const mk = (id: string, position: number | null): LeadRecord => ({ ...baseLead, id, position });
    expect(sortLeads([mk("a", null), mk("b", 2), mk("c", null), mk("d", -1)]).map((l) => l.id)).toEqual([
      "d",
      "b",
      "a",
      "c",
    ]);
  });

  it("resetLeads drops leads, selection and the loaded flag", () => {
    useLeadsStore.setState({ leads: [baseLead], loaded: true, selectedLead: baseLead, drawerOpen: true });
    useLeadsStore.getState().resetLeads();
    const s = useLeadsStore.getState();
    expect(s.leads).toEqual([]);
    expect(s.loaded).toBe(false);
    expect(s.selectedLead).toBeNull();
    expect(s.drawerOpen).toBe(false);
  });
});
