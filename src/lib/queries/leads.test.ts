import { describe, it, expect, vi } from "vitest";
import { getLeads, createLead, updateLeadStage, updateLead, deleteLead } from "./leads";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

describe("getLeads", () => {
  it("orders by position then most-recently-created", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getLeads({ from: fromMock } as any, "shop-1");
    expect(builder.order).toHaveBeenNthCalledWith(1, "position", { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: false });
  });
});

describe("updateLead", () => {
  it("merges the provided updates with a fresh updated_at", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateLead({ from: fromMock } as any, "lead-1", { name: "New Name" });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ name: "New Name" }));
    expect(builder.eq).toHaveBeenCalledWith("id", "lead-1");
  });
});

describe("deleteLead", () => {
  it("deletes the lead by id", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteLead({ from: fromMock } as any, "lead-1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "lead-1");
  });
});

describe("createLead", () => {
  it("defaults stage to 'new' when not provided", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createLead({ from: fromMock } as any, "shop-1", { name: "Sara" });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "new" }),
    );
  });

  it("respects an explicit stage", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createLead({ from: fromMock } as any, "shop-1", { name: "Sara", stage: "contacted" });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "contacted" }),
    );
  });
});

describe("updateLeadStage", () => {
  it("only includes position in the update when explicitly provided", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateLeadStage({ from: fromMock } as any, "lead-1", "booked");

    const call = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call).not.toHaveProperty("position");
    expect(call.stage).toBe("booked");
  });

  it("includes position when provided, even as 0", async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    const fromMock = vi.fn(() => builder);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateLeadStage({ from: fromMock } as any, "lead-1", "booked", 0);

    const call = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.position).toBe(0);
  });
});
