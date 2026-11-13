import { describe, expect, it, vi } from "vitest";
import {
  AvailabilityError,
  availabilityErrorCode,
  dayPartOf,
  daySpan,
  getAvailableSlots,
  groupSlotsByDate,
  groupSlotsByDayPart,
  isSlotBookable,
  mapSlotRow,
  nextAvailableSlot,
  pickAnyBarber,
  slotsForServiceDay,
  toItemsPayload,
  type AvailableSlotRow,
  type RpcClient,
} from "./index";

const SHOP = "11111111-1111-4111-8111-111111111111";
const S1 = "22222222-2222-4222-8222-222222222222";
const S2 = "33333333-3333-4333-8333-333333333333";
const B1 = "44444444-4444-4444-8444-444444444444";

function client(data: unknown, error: { message?: string; code?: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc, client: { rpc } as unknown as RpcClient };
}

// Amman is UTC+3: 09:00 local = 06:00Z; a Ramadan 00:30 slot belongs to the next local date.
const row = (start: string, end: string, date: string, time: string, ids: string[] = [B1]): AvailableSlotRow => ({
  start_time: start,
  end_time: end,
  local_date: date,
  local_time: time,
  barber_ids: ids,
});

describe("toItemsPayload", () => {
  it("accepts ids and objects, dedupes and keeps order", () => {
    expect(toItemsPayload([S2, { serviceId: S1 }, S2, ""])).toEqual([S2, S1]);
  });
});

describe("mapSlotRow", () => {
  it("parses a row and computes duration", () => {
    expect(mapSlotRow(row("2026-11-23T06:00:00+00:00", "2026-11-23T06:45:00+00:00", "2026-11-23", "09:00:00"))).toEqual({
      startIso: "2026-11-23T06:00:00.000Z",
      endIso: "2026-11-23T06:45:00.000Z",
      localDate: "2026-11-23",
      localTime: "09:00",
      barberIds: [B1],
      durationMin: 45,
    });
  });

  it("drops malformed rows", () => {
    expect(mapSlotRow(null)).toBeNull();
    expect(mapSlotRow(row("bad", "2026-11-23T06:45:00Z", "2026-11-23", "09:00"))).toBeNull();
    expect(mapSlotRow(row("2026-11-23T06:45:00Z", "2026-11-23T06:00:00Z", "2026-11-23", "09:00"))).toBeNull();
    expect(mapSlotRow(row("2026-11-23T06:00:00Z", "2026-11-23T06:30:00Z", "2026-11-23", "09:00", []))).toBeNull();
  });
});

describe("getAvailableSlots", () => {
  it("calls the RPC with the SQL argument names and maps rows sorted", async () => {
    const { rpc, client: c } = client([
      row("2026-11-23T07:00:00Z", "2026-11-23T07:30:00Z", "2026-11-23", "10:00"),
      row("2026-11-23T06:00:00Z", "2026-11-23T06:30:00Z", "2026-11-23", "09:00"),
    ]);
    const slots = await getAvailableSlots(c, { shopId: SHOP, dateFrom: "2026-11-23", items: [S1, { serviceId: S2 }], barberId: "any" });
    expect(rpc).toHaveBeenCalledWith("get_available_slots", {
      p_shop_id: SHOP,
      p_date_from: "2026-11-23",
      p_date_to: "2026-11-23",
      p_items: [S1, S2],
      p_barber_id: null,
      p_ignore_appointment_id: null,
      p_ignore_hold_id: null,
    });
    expect(slots.map((s) => s.localTime)).toEqual(["09:00", "10:00"]);
  });

  it("passes barber, reschedule and hold ids through", async () => {
    const { rpc, client: c } = client([]);
    await getAvailableSlots(c, {
      shopId: SHOP, dateFrom: "2026-11-23", dateTo: "2026-12-06", items: [S1],
      barberId: B1, ignoreAppointmentId: "appt", ignoreHoldId: "hold",
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_date_to: "2026-12-06", p_barber_id: B1, p_ignore_appointment_id: "appt", p_ignore_hold_id: "hold" });
  });

  it("returns [] for non-array data", async () => {
    const { client: c } = client(null);
    await expect(getAvailableSlots(c, { shopId: SHOP, dateFrom: "2026-11-23", items: [S1] })).resolves.toEqual([]);
  });

  it("validates input before calling the server", async () => {
    const { rpc, client: c } = client([]);
    await expect(getAvailableSlots(c, { shopId: SHOP, dateFrom: "23/11/2026", items: [S1] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(getAvailableSlots(c, { shopId: SHOP, dateFrom: "2026-11-23", dateTo: "2026-11-22", items: [S1] })).rejects.toBeInstanceOf(AvailabilityError);
    await expect(getAvailableSlots(c, { shopId: SHOP, dateFrom: "2026-01-01", dateTo: "2026-03-05", items: [S1] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(getAvailableSlots(c, { shopId: SHOP, dateFrom: "2026-11-23", items: [] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const eleven = Array.from({ length: 11 }, (_, i) => `svc-${i}`);
    await expect(getAvailableSlots(c, { shopId: SHOP, dateFrom: "2026-11-23", items: eleven })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps server error codes", async () => {
    const { client: c } = client(null, { message: "SERVICE_INVALID", code: "P0001" });
    await expect(getAvailableSlots(c, { shopId: SHOP, dateFrom: "2026-11-23", items: [S1] })).rejects.toMatchObject({ code: "SERVICE_INVALID" });
  });
});

describe("nextAvailableSlot", () => {
  it("returns the first slot or null", async () => {
    const after = new Date("2026-11-23T00:00:00Z");
    const { rpc, client: c } = client([row("2026-11-23T17:00:00Z", "2026-11-23T17:30:00Z", "2026-11-23", "20:00")]);
    const slot = await nextAvailableSlot(c, { shopId: SHOP, items: [S1], barberId: B1, after });
    expect(rpc).toHaveBeenCalledWith("next_available_slot", { p_shop_id: SHOP, p_items: [S1], p_barber_id: B1, p_after: after.toISOString() });
    expect(slot?.localTime).toBe("20:00");

    const empty = client([]);
    await expect(nextAvailableSlot(empty.client, { shopId: SHOP, items: [S1] })).resolves.toBeNull();
    expect(empty.rpc.mock.calls[0][1]).toMatchObject({ p_after: null, p_barber_id: null });
  });

  it("rejects an invalid `after`", async () => {
    const { client: c } = client([]);
    await expect(nextAvailableSlot(c, { shopId: SHOP, items: [S1], after: "nope" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("isSlotBookable / pickAnyBarber", () => {
  it("is true only for a literal true", async () => {
    const yes = client(true);
    await expect(isSlotBookable(yes.client, { shopId: SHOP, start: "2026-11-23T06:00:00Z", items: [S1], barberId: B1 })).resolves.toBe(true);
    expect(yes.rpc).toHaveBeenCalledWith("is_slot_bookable", {
      p_shop_id: SHOP, p_start: "2026-11-23T06:00:00.000Z", p_items: [S1], p_barber_id: B1,
      p_ignore_appointment_id: null, p_ignore_hold_id: null,
    });
    await expect(isSlotBookable(client(null).client, { shopId: SHOP, start: new Date(), items: [S1] })).resolves.toBe(false);
  });

  it("pickAnyBarber returns an id or null", async () => {
    await expect(pickAnyBarber(client(B1).client, { shopId: SHOP, start: "2026-11-23T06:00:00Z", items: [S1] })).resolves.toBe(B1);
    await expect(pickAnyBarber(client(null).client, { shopId: SHOP, start: "2026-11-23T06:00:00Z", items: [S1] })).resolves.toBeNull();
    await expect(pickAnyBarber(client(null, { message: "boom" }).client, { shopId: SHOP, start: "2026-11-23T06:00:00Z", items: [S1] }))
      .rejects.toMatchObject({ code: "UNKNOWN" });
  });
});

describe("availabilityErrorCode", () => {
  it("maps known codes", () => {
    expect(availabilityErrorCode(null)).toBeNull();
    expect(availabilityErrorCode({ message: "SHOP_NOT_FOUND" })).toBe("SHOP_NOT_FOUND");
    expect(availabilityErrorCode({ message: "invalid input syntax for type uuid", code: "22P02" })).toBe("SERVICE_INVALID");
    expect(availabilityErrorCode({ message: "network" })).toBe("UNKNOWN");
  });
});

describe("grouping helpers", () => {
  // Ramadan night: 20:00 and 23:30 on the 23rd, 00:30 and 01:30 on the 24th, then 10:00 on the 24th.
  const slots = [
    row("2026-11-24T07:00:00Z", "2026-11-24T07:30:00Z", "2026-11-24", "10:00"),
    row("2026-11-23T21:30:00Z", "2026-11-23T22:00:00Z", "2026-11-24", "00:30"),
    row("2026-11-23T17:00:00Z", "2026-11-23T17:30:00Z", "2026-11-23", "20:00"),
    row("2026-11-23T20:30:00Z", "2026-11-23T21:00:00Z", "2026-11-23", "23:30"),
    row("2026-11-23T22:30:00Z", "2026-11-23T23:00:00Z", "2026-11-24", "01:30"),
  ].map((r) => mapSlotRow(r)!);

  it("groups by local date in time order", () => {
    const byDate = groupSlotsByDate(slots);
    expect([...byDate.keys()]).toEqual(["2026-11-23", "2026-11-24"]);
    expect(byDate.get("2026-11-24")!.map((s) => s.localTime)).toEqual(["00:30", "01:30", "10:00"]);
  });

  it("keeps a night shift together as one service day", () => {
    const night = slotsForServiceDay(slots, "2026-11-23", "2026-11-24");
    expect(night.map((s) => s.localTime)).toEqual(["20:00", "23:30", "00:30", "01:30"]);
    expect(groupSlotsByDayPart(night).map((g) => [g.key, g.items.length])).toEqual([["evening", 1], ["night", 3]]);
  });

  it("classifies day parts", () => {
    expect(dayPartOf("04:59")).toBe("night");
    expect(dayPartOf("05:00")).toBe("morning");
    expect(dayPartOf("12:00")).toBe("afternoon");
    expect(dayPartOf("17:00")).toBe("evening");
    expect(dayPartOf("22:00")).toBe("night");
    expect(dayPartOf("xx")).toBe("night");
  });

  it("daySpan counts calendar days", () => {
    expect(daySpan("2026-11-23", "2026-11-23")).toBe(0);
    expect(daySpan("2026-12-31", "2027-01-01")).toBe(1);
  });
});
