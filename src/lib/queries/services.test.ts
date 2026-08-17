import { describe, it, expect, vi } from "vitest";
import { getServices, getPublicServices, createService, updateService, deleteService } from "./services";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

describe("getServices", () => {
  it("orders by creation date ascending for the given shop", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getServices({ from: fromMock } as any, "shop-1");
    expect(builder.eq).toHaveBeenCalledWith("shop_id", "shop-1");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});

describe("updateService", () => {
  it("applies the given partial updates", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateService({ from: fromMock } as any, "svc-1", { price: 15 });
    expect(builder.update).toHaveBeenCalledWith({ price: 15 });
    expect(builder.eq).toHaveBeenCalledWith("id", "svc-1");
  });
});

describe("deleteService", () => {
  it("deletes the service by id", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteService({ from: fromMock } as any, "svc-1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "svc-1");
  });
});

describe("getPublicServices", () => {
  it("selects only the fields safe to expose publicly, ordered by price", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getPublicServices({ from: fromMock } as any, "shop-1");

    expect(builder.select).toHaveBeenCalledWith("id, name, name_ar, duration, price");
    expect(builder.order).toHaveBeenCalledWith("price", { ascending: true });
  });
});

describe("createService", () => {
  it("inserts the service scoped to the given shop", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);

    await createService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      "shop-1",
      { name: "Haircut", duration: 30, price: 10 },
    );

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ shop_id: "shop-1", name: "Haircut", duration: 30, price: 10 }),
    );
  });
});
