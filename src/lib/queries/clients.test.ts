import { describe, it, expect, vi } from "vitest";
import { getClients, upsertClient, getClientById, getClientAppointments } from "./clients";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

describe("getClientById", () => {
  it("looks up a single client by id", async () => {
    const builder = createQueryBuilder({ data: { id: "c1" }, error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClientById({ from: fromMock } as any, "c1");
    expect(builder.eq).toHaveBeenCalledWith("id", "c1");
    expect(builder.single).toHaveBeenCalled();
  });
});

describe("getClientAppointments", () => {
  it("orders history newest-first and applies the limit", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClientAppointments({ from: fromMock } as any, "c1", 5);
    expect(builder.order).toHaveBeenCalledWith("start_time", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(5);
  });
});

describe("getClients", () => {
  it("applies an ilike filter across name/phone/email when a search term is given", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClients({ from: fromMock } as any, "shop-1", 1, "sara");

    expect(builder.or).toHaveBeenCalledWith(
      expect.stringContaining("name.ilike.%sara%"),
    );
  });

  it("skips the search filter when no search term is given", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClients({ from: fromMock } as any, "shop-1");

    expect(builder.or).not.toHaveBeenCalled();
  });
});

describe("upsertClient", () => {
  it("updates the existing client when one matches by phone", async () => {
    const selectBuilder = createQueryBuilder({ data: { id: "existing-1" }, error: null });
    const updateBuilder = createQueryBuilder({ data: { id: "existing-1" }, error: null });
    const fromMock = vi.fn().mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);

    await upsertClient(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      "shop-1",
      { name: "Sara", phone: "0791234567" },
    );

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sara" }),
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "existing-1");
  });

  it("inserts a new client when none matches by phone", async () => {
    const selectBuilder = createQueryBuilder({ data: null, error: null });
    const insertBuilder = createQueryBuilder({ data: { id: "new-1" }, error: null });
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
