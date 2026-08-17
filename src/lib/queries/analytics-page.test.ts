import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFullAnalytics } from "./analytics-page";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

function client(fromMock: ReturnType<typeof vi.fn>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: fromMock } as any;
}

// getFullAnalytics issues, in order: current appts, previous appts,
// current clients, previous clients, then profiles (for barber names).
function mockFullAnalytics({
  currAppts = [],
  prevAppts = [],
  currClients = [],
  prevClients = [],
  profiles = [],
}: {
  currAppts?: unknown[];
  prevAppts?: unknown[];
  currClients?: unknown[];
  prevClients?: unknown[];
  profiles?: unknown[];
}) {
  return vi
    .fn()
    .mockReturnValueOnce(createQueryBuilder({ data: currAppts, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: prevAppts, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: currClients, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: prevClients, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: profiles, error: null }));
}

describe("getFullAnalytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 7)); // Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes summary metrics with correct percentage changes", async () => {
    const fromMock = mockFullAnalytics({
      currAppts: [
        { id: "1", price: 100, status: "completed", start_time: "2026-01-05T10:00:00", source: "online", barber_id: "b1", client_id: "c1" },
      ],
      prevAppts: [{ id: "0", price: 50, status: "completed", client_id: "c0" }],
      currClients: [{ id: "c1" }],
      prevClients: [],
    });

    const result = await getFullAnalytics(client(fromMock), "shop-1", "week");
    const revenue = result.summary.find((s) => s.id === "revenue")!;
    const bookings = result.summary.find((s) => s.id === "bookings")!;
    const clients = result.summary.find((s) => s.id === "clients")!;

    expect(revenue.value).toBe("100 JOD");
    expect(revenue.change).toBe(100); // prev 50 -> curr 100 = +100%
    expect(revenue.dir).toBe("up");
    expect(bookings.value).toBe("1");
    expect(clients.change).toBe(100); // prev 0, curr 1 client -> 100%
  });

  it("falls back to 'Walk-in (100%)' acquisition when there are no appointments", async () => {
    const fromMock = mockFullAnalytics({});
    const result = await getFullAnalytics(client(fromMock), "shop-1", "week");

    expect(result.acquisitionChart).toEqual([
      { name: "Walk-in (100%)", value: 100, color: "#000000" },
    ]);
  });

  it("buckets acquisition sources by their booking source", async () => {
    const fromMock = mockFullAnalytics({
      currAppts: [
        { id: "1", price: 10, status: "completed", source: "online", client_id: "c1" },
        { id: "2", price: 10, status: "pending", source: "online", client_id: "c2" },
        { id: "3", price: 10, status: "completed", source: null, client_id: "c3" },
      ],
    });

    const result = await getFullAnalytics(client(fromMock), "shop-1", "week");
    const online = result.acquisitionChart.find((c) => c.name.startsWith("online"));
    const walkIn = result.acquisitionChart.find((c) => c.name.startsWith("Walk-in"));

    expect(online?.value).toBe(67); // 2 of 3
    expect(walkIn?.value).toBe(33); // 1 of 3 (missing source defaults to Walk-in)
  });

  it("attributes barber revenue and resolves names, falling back to 'Unassigned'", async () => {
    const fromMock = mockFullAnalytics({
      currAppts: [
        { id: "1", price: 100, status: "completed", barber_id: "b1", client_id: "c1" },
        { id: "2", price: 50, status: "completed", barber_id: null, client_id: "c2" },
      ],
      profiles: [{ id: "b1", full_name: "Ahmad" }],
    });

    const result = await getFullAnalytics(client(fromMock), "shop-1", "week");

    expect(result.barberChart).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Ahmad", revenue: 100 }),
        expect.objectContaining({ name: "Unassigned", revenue: 50 }),
      ]),
    );
  });

  it("normalizes the peak-hours heatmap so the busiest slot is 1.0", async () => {
    const monday = "2026-01-05"; // known Monday
    const fromMock = mockFullAnalytics({
      currAppts: [
        { id: "1", price: 10, status: "completed", start_time: `${monday}T09:00:00`, client_id: "c1" },
        { id: "2", price: 10, status: "completed", start_time: `${monday}T09:30:00`, client_id: "c2" },
        { id: "3", price: 10, status: "completed", start_time: `${monday}T18:00:00`, client_id: "c3" },
      ],
    });

    const result = await getFullAnalytics(client(fromMock), "shop-1", "week");
    const morningRow = result.peakChart[0]; // "09 AM" bucket
    expect(morningRow.vals[0]).toBe(1); // Monday column, normalized against max of 2
  });
});
