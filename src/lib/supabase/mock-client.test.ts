import { describe, it, expect } from "vitest";
import { createMockClient } from "./mock-client";
import { MOCK_SHOP_IDS, MOCK_SERVICES } from "@/lib/mock-data";

function tomorrowAt(h: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d;
}

describe("mock client RPC contract", () => {
  const client = createMockClient();
  const shop = MOCK_SHOP_IDS.gentlemansChair;
  const service = MOCK_SERVICES.find((s) => s.shop_id === shop)!;

  it("create_public_booking prices server-side and resolves 'any' barber", async () => {
    const start = tomorrowAt(11);
    const { data, error } = await client.rpc("create_public_booking", {
      p_shop_id: shop, p_client_name: "Test", p_client_phone: "+962790000000",
      p_service_ids: [service.id], p_barber_id: null, p_start_time: start.toISOString(),
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ price: service.price, status: "pending" });
    expect((data as { barber_id: string }).barber_id).toBeTruthy();
  });

  it("get_busy_slots returns the booking just made, then SLOT_TAKEN on overlap", async () => {
    const start = tomorrowAt(15);
    const first = await client.rpc("create_public_booking", {
      p_shop_id: shop, p_client_name: "A", p_client_phone: "+962790000001",
      p_service_ids: [service.id], p_barber_id: "b-gc-1", p_start_time: start.toISOString(),
    });
    expect(first.error).toBeNull();

    const day = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const busy = await client.rpc("get_busy_slots", { p_shop_id: shop, p_day: day, p_barber_id: "b-gc-1" });
    expect((busy.data as unknown[]).length).toBeGreaterThan(0);

    const clash = await client.rpc("create_public_booking", {
      p_shop_id: shop, p_client_name: "B", p_client_phone: "+962790000002",
      p_service_ids: [service.id], p_barber_id: "b-gc-1", p_start_time: start.toISOString(),
    });
    expect(clash.error).toMatchObject({ code: "P0001", message: "SLOT_TAKEN" });
  });

  it("rejects past times and foreign services", async () => {
    const past = await client.rpc("create_public_booking", {
      p_shop_id: shop, p_client_name: "A", p_client_phone: "+962790000003",
      p_service_ids: [service.id], p_barber_id: null, p_start_time: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(past.error?.message).toBe("SLOT_IN_PAST");

    const foreign = MOCK_SERVICES.find((s) => s.shop_id !== shop)!;
    const bad = await client.rpc("create_public_booking", {
      p_shop_id: shop, p_client_name: "A", p_client_phone: "+962790000003",
      p_service_ids: [foreign.id], p_barber_id: null, p_start_time: tomorrowAt(12).toISOString(),
    });
    expect(bad.error?.message).toBe("SERVICE_INVALID");
  });

  it("supports the extra query builder filters", async () => {
    const { data } = await client.from("clients").select("*").is("deleted_at", null).neq("name", "nobody");
    expect(Array.isArray(data)).toBe(true);
  });
});
