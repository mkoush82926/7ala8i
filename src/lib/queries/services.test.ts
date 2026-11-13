import { describe, it, expect, vi } from "vitest";
import {
  getServices,
  getPublicServices,
  createService,
  updateService,
  deleteService,
  archiveService,
  removeService,
  saveServiceOrder,
  PUBLIC_SERVICE_COLUMNS,
} from "./services";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (fromMock: ReturnType<typeof vi.fn>) => ({ from: fromMock }) as any;

function withContains<T extends Record<string, unknown>>(builder: T) {
  const b = builder as Record<string, unknown>;
  b.contains = vi.fn(() => b);
  return builder;
}

describe("getServices", () => {
  it("orders by the owner's sort_order, then creation date, for the given shop", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    await getServices(client(fromMock), "shop-1");
    expect(builder.eq).toHaveBeenCalledWith("shop_id", "shop-1");
    expect(builder.order).toHaveBeenNthCalledWith(1, "sort_order", expect.objectContaining({ ascending: true }));
    expect(builder.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
  });
});

describe("getPublicServices", () => {
  it("only lists ACTIVE services, with public columns, in menu order", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);

    await getPublicServices(client(fromMock), "shop-1");

    expect(builder.select).toHaveBeenCalledWith(PUBLIC_SERVICE_COLUMNS);
    expect(builder.eq).toHaveBeenCalledWith("shop_id", "shop-1");
    expect(builder.eq).toHaveBeenCalledWith("is_active", true);
    expect(builder.order).toHaveBeenNthCalledWith(1, "sort_order", expect.objectContaining({ ascending: true }));
    expect(builder.order).toHaveBeenNthCalledWith(2, "price", { ascending: true });
  });
});

describe("createService", () => {
  it("inserts the service scoped to the given shop", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);

    await createService(client(fromMock), "shop-1", { name: "Haircut", duration: 30, price: 10, sort_order: 3 });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ shop_id: "shop-1", name: "Haircut", duration: 30, price: 10, name_ar: null, sort_order: 3 }),
    );
  });
});

describe("updateService", () => {
  it("applies the given partial updates and never sends updated_at", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);
    await updateService(client(fromMock), "svc-1", { price: 15 });
    expect(builder.update).toHaveBeenCalledWith({ price: 15 });
    expect(builder.eq).toHaveBeenCalledWith("id", "svc-1");
  });
});

describe("archiveService / deleteService", () => {
  it("archives by switching is_active off", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    await archiveService(client(vi.fn(() => builder)), "svc-1");
    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
    expect(builder.eq).toHaveBeenCalledWith("id", "svc-1");
  });

  it("hard-deletes by id", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    await deleteService(client(vi.fn(() => builder)), "svc-1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "svc-1");
  });
});

describe("removeService", () => {
  it("archives a service that appointments still reference", async () => {
    const countBuilder = withContains(createQueryBuilder({ data: null, error: null }));
    (countBuilder as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null, count: 2 }).then(resolve);
    const archiveBuilder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn().mockReturnValueOnce(countBuilder).mockReturnValueOnce(archiveBuilder);

    const res = await removeService(client(fromMock), "shop-1", "svc-1");

    expect(countBuilder.contains).toHaveBeenCalledWith("service_ids", ["svc-1"]);
    expect(archiveBuilder.update).toHaveBeenCalledWith({ is_active: false });
    expect(archiveBuilder.delete).not.toHaveBeenCalled();
    expect(res).toEqual({ result: "archived", error: null });
  });

  it("deletes a service nobody booked", async () => {
    const countBuilder = withContains(createQueryBuilder({ data: null, error: null }));
    (countBuilder as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null, count: 0 }).then(resolve);
    const deleteBuilder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn().mockReturnValueOnce(countBuilder).mockReturnValueOnce(deleteBuilder);

    const res = await removeService(client(fromMock), "shop-1", "svc-1");

    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(res).toEqual({ result: "deleted", error: null });
  });

  it("falls back to archiving when the reference check fails", async () => {
    // No `.contains` on this builder → the check throws → archive.
    const countBuilder = createQueryBuilder({ data: null, error: null });
    const archiveBuilder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn().mockReturnValueOnce(countBuilder).mockReturnValueOnce(archiveBuilder);

    const res = await removeService(client(fromMock), "shop-1", "svc-1");
    expect(res.result).toBe("archived");
    expect(archiveBuilder.update).toHaveBeenCalledWith({ is_active: false });
  });
});

describe("saveServiceOrder", () => {
  it("only writes rows whose position changed", async () => {
    const builders = [createQueryBuilder({ data: null, error: null }), createQueryBuilder({ data: null, error: null })];
    const fromMock = vi.fn().mockReturnValueOnce(builders[0]).mockReturnValueOnce(builders[1]);

    const res = await saveServiceOrder(client(fromMock), ["b", "a", "c"], ["a", "b", "c"]);

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(builders[0].update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(builders[0].eq).toHaveBeenCalledWith("id", "b");
    expect(builders[1].update).toHaveBeenCalledWith({ sort_order: 1 });
    expect(res.error).toBeNull();
  });

  it("reports the first failure", async () => {
    const fromMock = vi.fn(() => createQueryBuilder({ data: null, error: { message: "denied" } }));
    const res = await saveServiceOrder(client(fromMock), ["b", "a"], ["a", "b"]);
    expect(res.error).toEqual({ message: "denied" });
  });
});
