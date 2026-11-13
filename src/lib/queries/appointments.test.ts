import { describe, it, expect, vi } from "vitest";
import {
  getTodayAppointments,
  getUpcomingAppointments,
  getAppointmentsByDateRange,
  getAvailableSlots,
  updateAppointmentStatus,
  createStaffAppointment,
  updateStaffAppointment,
  completeAppointmentSale,
  dayRangeBounds,
  parseDay,
  errorCodeOf,
  overlapsAny,
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
  it("sets only the new status (updated_at is trigger-owned)", async () => {
    const builder = createQueryBuilder({ data: { id: "a1" }, error: null });
    await updateAppointmentStatus(client(builder), "a1", "confirmed");
    expect(builder.update).toHaveBeenCalledWith({ status: "confirmed" });
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

function rpcClient() {
  const rpc = vi.fn(() => Promise.resolve({ data: [], error: null }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { rpc } as any, rpc };
}

describe("getAvailableSlots", () => {
  it("calls get_busy_slots with a specific barber", async () => {
    const { client: c, rpc } = rpcClient();
    await getAvailableSlots(c, "shop-1", "2026-01-01", "barber-1");
    expect(rpc).toHaveBeenCalledWith("get_busy_slots", { p_shop_id: "shop-1", p_day: "2026-01-01", p_barber_id: "barber-1" });
  });

  it("treats 'any' as no barber filter", async () => {
    const { client: c, rpc } = rpcClient();
    await getAvailableSlots(c, "shop-1", "2026-01-01", "any");
    expect(rpc).toHaveBeenCalledWith("get_busy_slots", { p_shop_id: "shop-1", p_day: "2026-01-01", p_barber_id: null });
  });
});

describe("completeAppointmentSale", () => {
  it("calls the atomic RPC", async () => {
    const { client: c, rpc } = rpcClient();
    await completeAppointmentSale(c, "a1", "card");
    expect(rpc).toHaveBeenCalledWith("complete_appointment_sale", { p_appointment_id: "a1", p_payment_method: "card", p_amount: null });
  });
});

describe("createStaffAppointment", () => {
  it("inserts a confirmed walk-in by default", async () => {
    const builder = createQueryBuilder({ data: { id: "a1" }, error: null });
    await createStaffAppointment(client(builder), {
      shopId: "shop-1",
      barberId: null,
      clientName: "Omar",
      serviceIds: ["s1"],
      serviceName: "Cut",
      startTime: "2026-01-01T10:00:00.000Z",
      endTime: "2026-01-01T10:30:00.000Z",
      price: 10,
    });
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ shop_id: "shop-1", status: "confirmed", source: "walk_in", client_name: "Omar" }),
    );
  });
});

describe("updateStaffAppointment", () => {
  it("sends only provided fields", async () => {
    const builder = createQueryBuilder({ data: { id: "a1" }, error: null });
    await updateStaffAppointment(client(builder), "a1", { barberId: null, startTime: "x" });
    expect(builder.update).toHaveBeenCalledWith({ barber_id: null, start_time: "x" });
    expect(builder.eq).toHaveBeenCalledWith("id", "a1");
  });
});

describe("day bounds", () => {
  it("parses yyyy-MM-dd as local midnight", () => {
    const d = parseDay("2026-03-05");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 5, 0]);
  });

  it("returns offset-qualified ISO bounds covering the whole local day", () => {
    const { from, to } = dayRangeBounds("2026-03-05");
    expect(from.endsWith("Z")).toBe(true);
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(24 * 3600 * 1000 - 1);
  });
});

describe("errorCodeOf", () => {
  it("maps RPC codes, pg codes and unknowns", () => {
    expect(errorCodeOf({ message: "SLOT_TAKEN" })).toBe("SLOT_TAKEN");
    expect(errorCodeOf({ code: "23P01", message: "conflicting key value" })).toBe("SLOT_TAKEN");
    expect(errorCodeOf({ code: "42501", message: "new row violates row-level security" })).toBe("FORBIDDEN");
    expect(errorCodeOf({ message: "network down" })).toBeNull();
    expect(errorCodeOf(null)).toBeNull();
  });
});

describe("overlapsAny", () => {
  const busy = [{ start_time: "2026-01-01T10:00:00Z", end_time: "2026-01-01T10:30:00Z" }];
  it("detects overlaps but allows back-to-back bookings", () => {
    expect(overlapsAny(new Date("2026-01-01T10:15:00Z"), new Date("2026-01-01T10:45:00Z"), busy)).toBe(true);
    expect(overlapsAny(new Date("2026-01-01T10:30:00Z"), new Date("2026-01-01T11:00:00Z"), busy)).toBe(false);
  });
});
