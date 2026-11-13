import { describe, it, expect, vi } from "vitest";
import {
  getClients,
  upsertClient,
  getClientById,
  getClientAppointments,
  createClientRecord,
  updateClientRecord,
  softDeleteClient,
  restoreClient,
  cleanClientInput,
  clientSearchFilter,
  summarizeVisits,
} from "./clients";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

// The shared mock builder predates `.is()`; add it so soft-delete filters chain.
function builderWith<T>(result: { data: T; error: unknown }) {
  const b = createQueryBuilder(result) as Record<string, ReturnType<typeof vi.fn>>;
  b.is = vi.fn(() => b);
  return b;
}

describe("getClientById", () => {
  it("looks up a single, non-deleted client by id", async () => {
    const builder = builderWith({ data: { id: "c1" }, error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClientById({ from: fromMock } as any, "c1");
    expect(builder.eq).toHaveBeenCalledWith("id", "c1");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.single).toHaveBeenCalled();
  });
});

describe("getClientAppointments", () => {
  it("orders history newest-first and applies the limit", async () => {
    const builder = builderWith({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClientAppointments({ from: fromMock } as any, "c1", 5);
    expect(builder.order).toHaveBeenCalledWith("start_time", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(5);
  });
});

describe("getClients", () => {
  it("excludes soft-deleted clients and applies an ilike filter when searching", async () => {
    const builder = builderWith({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClients({ from: fromMock } as any, "shop-1", 1, "sara");

    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("name.ilike.%sara%"));
    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });

  it("skips the search filter when no search term is given", async () => {
    const builder = builderWith({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClients({ from: fromMock } as any, "shop-1");
    expect(builder.or).not.toHaveBeenCalled();
  });

  it("clamps invalid pages to the first page", async () => {
    const builder = builderWith({ data: [], error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClients({ from: vi.fn(() => builder) } as any, "shop-1", -3);
    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });
});

describe("clientSearchFilter", () => {
  it("quotes values containing PostgREST syntax so they can't add clauses", () => {
    const f = clientSearchFilter("a,id.not.is.null");
    expect(f).toBe(
      'name.ilike."%a,id.not.is.null%",phone.ilike."%a,id.not.is.null%",email.ilike."%a,id.not.is.null%"',
    );
  });

  it("escapes LIKE wildcards and quotes", () => {
    expect(clientSearchFilter('50%_"x')).toContain('name.ilike."%50\\\\%\\\\_\\"x%"');
  });

  it("also matches the digits-only phone column for formatted numbers", () => {
    expect(clientSearchFilter("079 123")).toContain("phone_digits.ilike.%079123%");
  });

  it("returns an empty string for blank input", () => {
    expect(clientSearchFilter("   ")).toBe("");
  });
});

describe("cleanClientInput", () => {
  it("trims, lowercases email and turns blanks into null", () => {
    expect(cleanClientInput({ name: "  Sara   K ", phone: " ", email: " A@B.CO ", notes: "", source: null })).toEqual({
      name: "Sara K",
      phone: null,
      email: "a@b.co",
      notes: null,
      source: null,
    });
  });
});

describe("client mutations", () => {
  it("creates a client scoped to the shop without updated_at", async () => {
    const builder = builderWith({ data: { id: "n1" }, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createClientRecord({ from: vi.fn(() => builder) } as any, "shop-1", { name: "Sara", phone: "0791234567" });
    const values = builder.insert.mock.calls[0][0];
    expect(values).toMatchObject({ shop_id: "shop-1", name: "Sara", phone: "0791234567" });
    expect(values).not.toHaveProperty("updated_at");
  });

  it("updates within the shop", async () => {
    const builder = builderWith({ data: { id: "c1" }, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateClientRecord({ from: vi.fn(() => builder) } as any, "shop-1", "c1", { name: "Sara" });
    expect(builder.eq).toHaveBeenCalledWith("id", "c1");
    expect(builder.eq).toHaveBeenCalledWith("shop_id", "shop-1");
    expect(builder.update.mock.calls[0][0]).not.toHaveProperty("updated_at");
  });

  it("soft deletes instead of hard deleting, and can restore", async () => {
    const builder = builderWith({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = { from: vi.fn(() => builder) } as any;
    await softDeleteClient(sb, "shop-1", "c1");
    expect(builder.delete).not.toHaveBeenCalled();
    expect(builder.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    await restoreClient(sb, "shop-1", "c1");
    expect(builder.update).toHaveBeenLastCalledWith({ deleted_at: null });
  });
});

describe("summarizeVisits", () => {
  it("counts completed visits and finds the latest", () => {
    expect(
      summarizeVisits([
        { start_time: "2026-01-01T10:00:00Z", status: "completed" },
        { start_time: "2026-03-01T10:00:00Z", status: "cancelled" },
        { start_time: "2026-02-01T10:00:00Z", status: "completed" },
      ]),
    ).toEqual({ visits: 2, lastVisit: "2026-02-01T10:00:00Z" });
  });
});

describe("upsertClient", () => {
  it("updates the existing client when one matches by phone", async () => {
    const selectBuilder = builderWith({ data: { id: "existing-1" }, error: null });
    const updateBuilder = builderWith({ data: { id: "existing-1" }, error: null });
    const fromMock = vi.fn().mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);

    await upsertClient(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      "shop-1",
      { name: "Sara", phone: "0791234567" },
    );

    expect(selectBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Sara" }));
    expect(updateBuilder.update.mock.calls[0][0]).not.toHaveProperty("updated_at");
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "existing-1");
  });

  it("inserts a new client when none matches by phone", async () => {
    const selectBuilder = builderWith({ data: null, error: null });
    const insertBuilder = builderWith({ data: { id: "new-1" }, error: null });
    const fromMock = vi.fn().mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);

    await upsertClient(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      "shop-1",
      { name: "New Client", phone: "0799999999" },
    );

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Client", phone: "0799999999" }),
    );
  });
});
