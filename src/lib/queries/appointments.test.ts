import { describe, it, expect, vi } from "vitest";
import {
  getTodayAppointments,
  getUpcomingAppointments,
  getAppointmentsByDateRange,
  getAvailableSlots,
  updateAppointmentStatus,
} from "./appointments";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

function client(builder: ReturnType<typeof createQueryBuilder>) {
  const fromMock = vi.fn(() => builder);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: fromMock } as any;
}

describe("getTodayAppointments", () => {
  it("orders by start_time ascending for the given shop", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    await getTodayAppointments(client(builder), "shop-1");
    expect(builder.eq).toHaveBeenCalledWith("shop_id", "shop-1");
    expect(builder.order).toHaveBeenCalledWith("start_time", { ascending: true });
  });
});

describe("getUpcomingAppointments", () => {
  it("filters to pending/confirmed and applies the limit", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    await getUpcomingAppointments(client(builder), "shop-1", 3);
    expect(builder.in).toHaveBeenCalledWith("status", ["pending", "confirmed"]);
    expect(builder.limit).toHaveBeenCalledWith(3);
  });
});

describe("updateAppointmentStatus", () => {
  it("sets the new status and updated_at timestamp", async () => {
    const builder = createQueryBuilder({ data: { id: "a1" }, error: null });
    await updateAppointmentStatus(client(builder), "a1", "confirmed");
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "a1");
  });
});

describe("getAppointmentsByDateRange", () => {
  it("filters by barberId only when one is provided", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    await getAppointmentsByDateRange(client(builder), "shop-1", "2026-01-01", "2026-01-07", "barber-1");
    expect(builder.eq).toHaveBeenCalledWith("barber_id", "barber-1");
  });

  it("does not filter by barberId when omitted", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    await getAppointmentsByDateRange(client(builder), "shop-1", "2026-01-01", "2026-01-07");
    expect(builder.eq).not.toHaveBeenCalledWith("barber_id", expect.anything());
  });
});

describe("getAvailableSlots", () => {
  it("filters by a specific barberId", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    await getAvailableSlots(client(builder), "shop-1", "2026-01-01", "barber-1");
    expect(builder.eq).toHaveBeenCalledWith("barber_id", "barber-1");
  });

  it("treats 'any' as no barber filter", async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    await getAvailableSlots(client(builder), "shop-1", "2026-01-01", "any");
    expect(builder.eq).not.toHaveBeenCalledWith("barber_id", expect.anything());
  });
});
