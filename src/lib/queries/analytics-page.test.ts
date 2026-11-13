import { describe, it, expect, vi } from "vitest";
import { getFullAnalytics, fetchAllRows, csvCell, toCsv, PAGE_SIZE } from "./analytics-page";
import { getPeriodRange, zonedMidnight, bucketKeyOf } from "./analytics-period";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (fromMock: ReturnType<typeof vi.fn>) => ({ from: fromMock }) as any;

function counted(count: number) {
  const b = createQueryBuilder({ data: null, error: null });
  (b as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null, count }).then(resolve);
  return b;
}

// Order of from() calls in getFullAnalytics: shops, then (in Promise.all
// order) current appts, previous appts, current sales, previous sales,
// current new-clients count, previous new-clients count.
function mockAnalytics({
  shop = { timezone: "Asia/Amman", currency: "JOD" },
  currAppts = [] as unknown[],
  prevAppts = [] as unknown[],
  currSales = [] as unknown[],
  prevSales = [] as unknown[],
  currClients = 0,
  prevClients = 0,
} = {}) {
  return vi
    .fn()
    .mockReturnValueOnce(createQueryBuilder({ data: shop, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: currAppts, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: prevAppts, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: currSales, error: null }))
    .mockReturnValueOnce(createQueryBuilder({ data: prevSales, error: null }))
    .mockReturnValueOnce(counted(currClients))
    .mockReturnValueOnce(counted(prevClients));
}

// Wednesday 7 Jan 2026, 12:00 in Amman (UTC+3).
const NOW = new Date("2026-01-07T09:00:00Z");

describe("analytics periods (shop time zone)", () => {
  it("starts weeks on Monday at local midnight", () => {
    const r = getPeriodRange("week", "Asia/Amman", NOW);
    expect(r.start.toISOString()).toBe("2026-01-04T21:00:00.000Z"); // Mon 5 Jan 00:00 +03
    expect(r.end.toISOString()).toBe("2026-01-11T21:00:00.000Z");
    expect(r.prevStart.toISOString()).toBe("2025-12-28T21:00:00.000Z");
    expect(r.buckets).toEqual([
      "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-11",
    ]);
  });

  it("covers every day of the month and every month of the year", () => {
    expect(getPeriodRange("month", "Asia/Amman", NOW).buckets).toHaveLength(31);
    const feb = getPeriodRange("month", "Asia/Amman", new Date("2026-02-10T09:00:00Z"));
    expect(feb.buckets).toHaveLength(28);
    const y = getPeriodRange("year", "Asia/Amman", NOW);
    expect(y.buckets[0]).toBe("2026-01");
    expect(y.buckets).toHaveLength(12);
  });

  it("assigns late-night bookings to the shop's local day", () => {
    // 22:30 UTC on the 5th is 01:30 on the 6th in Amman.
    expect(bucketKeyOf("2026-01-05T22:30:00Z", "day", "Asia/Amman")).toBe("2026-01-06");
    expect(zonedMidnight(2026, 1, 6, "UTC").toISOString()).toBe("2026-01-06T00:00:00.000Z");
  });

  it("falls back to the default zone for an invalid one", () => {
    expect(() => getPeriodRange("week", "Not/AZone", NOW)).not.toThrow();
  });
});

describe("getFullAnalytics", () => {
  it("uses daily_sales for revenue and non-cancelled appointments for bookings", async () => {
    const fromMock = mockAnalytics({
      currAppts: [
        { id: "1", start_time: "2026-01-05T08:00:00Z", source: "online", client_id: "c1" },
        { id: "2", start_time: "2026-01-06T08:00:00Z", source: "instagram", client_id: "c1" },
      ],
      prevAppts: [{ id: "0", client_id: "c0" }],
      currSales: [
        { amount: 60, barber_name: "Ahmad", created_at: "2026-01-05T09:00:00Z" },
        { amount: 40, barber_name: "", created_at: "2026-01-06T09:00:00Z" },
      ],
      prevSales: [{ amount: 50 }],
      currClients: 1,
      prevClients: 0,
    });

    const r = await getFullAnalytics(client(fromMock), "shop-1", "week", NOW);

    expect(fromMock).toHaveBeenNthCalledWith(1, "shops");
    expect(r.summary.revenue).toEqual({ current: 100, previous: 50, change: 100 });
    expect(r.summary.bookings).toEqual({ current: 2, previous: 1, change: 100 });
    expect(r.summary.newClients.change).toBe(100);
    expect(r.summary.averageTicket.current).toBe(50);
    // c1 booked twice → 100% repeat
    expect(r.summary.repeatRate.current).toBe(100);
    expect(r.currency).toBe("JOD");
  });

  it("excludes cancelled appointments and bounds every query to the period", async () => {
    const fromMock = mockAnalytics();
    await getFullAnalytics(client(fromMock), "shop-1", "week", NOW);
    const apptBuilder = fromMock.mock.results[1].value;
    expect(apptBuilder.neq).toHaveBeenCalledWith("status", "cancelled");
    expect(apptBuilder.gte).toHaveBeenCalledWith("start_time", "2026-01-04T21:00:00.000Z");
    expect(apptBuilder.lte).toHaveBeenCalledWith("start_time", "2026-01-11T20:59:59.999Z");
    expect(apptBuilder.range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
  });

  it("returns a gap-free series for the whole period", async () => {
    const fromMock = mockAnalytics({
      currSales: [{ amount: 30, barber_name: "A", created_at: "2026-01-07T10:00:00Z" }],
    });
    const r = await getFullAnalytics(client(fromMock), "shop-1", "week", NOW);
    expect(r.revenueSeries).toHaveLength(7);
    expect(r.revenueSeries.map((p) => p.revenue)).toEqual([0, 0, 30, 0, 0, 0, 0]);
  });

  it("ranks staff by sales revenue and marks unassigned sales", async () => {
    const fromMock = mockAnalytics({
      currSales: [
        { amount: 100, barber_name: "Ahmad", created_at: "2026-01-05T09:00:00Z" },
        { amount: 50, barber_name: null, created_at: "2026-01-05T10:00:00Z" },
      ],
    });
    const r = await getFullAnalytics(client(fromMock), "shop-1", "week", NOW);
    expect(r.barbers).toEqual([
      { name: "Ahmad", revenue: 100, sales: 1, pct: 67 },
      { name: null, revenue: 50, sales: 1, pct: 33 },
    ]);
  });

  it("normalises booking sources (missing → walk_in, unknown → other)", async () => {
    const fromMock = mockAnalytics({
      currAppts: [
        { id: "1", start_time: "2026-01-05T08:00:00Z", source: "online", client_id: "c1" },
        { id: "2", start_time: "2026-01-05T09:00:00Z", source: null, client_id: "c2" },
        { id: "3", start_time: "2026-01-05T10:00:00Z", source: "Walk-in", client_id: "c3" },
        { id: "4", start_time: "2026-01-05T11:00:00Z", source: "tiktok", client_id: "c4" },
      ],
    });
    const r = await getFullAnalytics(client(fromMock), "shop-1", "week", NOW);
    expect(r.sources).toEqual([
      { source: "walk_in", count: 2, pct: 50 },
      { source: "online", count: 1, pct: 25 },
      { source: "other", count: 1, pct: 25 },
    ]);
  });

  it("keeps Sunday and late-evening bookings in the heatmap", async () => {
    const fromMock = mockAnalytics({
      currAppts: [
        // Sunday 11 Jan 2026, 21:00 Amman
        { id: "1", start_time: "2026-01-11T18:00:00Z", source: "online", client_id: "c1" },
        // Monday 5 Jan, 10:00 Amman (twice)
        { id: "2", start_time: "2026-01-05T07:00:00Z", source: "online", client_id: "c2" },
        { id: "3", start_time: "2026-01-05T07:30:00Z", source: "online", client_id: "c3" },
      ],
    });
    const r = await getFullAnalytics(client(fromMock), "shop-1", "week", NOW);
    const h = r.heatmap;
    expect(h.hours[h.hours.length - 1]).toBe(21);
    expect(h.counts[0][h.hours.indexOf(21)]).toBe(1); // Sunday
    expect(h.counts[1][h.hours.indexOf(10)]).toBe(2); // Monday
    expect(h.max).toBe(2);
    expect(h.total).toBe(3);
  });

  it("throws when a query fails", async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }))
      .mockReturnValue(createQueryBuilder({ data: null, error: { message: "boom" } }));
    await expect(getFullAnalytics(client(fromMock), "shop-1", "month", NOW)).rejects.toThrow("boom");
  });
});

describe("fetchAllRows", () => {
  it("pages until a short page and flags truncation at the cap", async () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, i) => ({ i }));
    const pages = [full, [{ i: "last" }]];
    let call = 0;
    const make = () => createQueryBuilder({ data: pages[Math.min(call++, 1)], error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await fetchAllRows(make as any);
    expect(res.rows).toHaveLength(PAGE_SIZE + 1);
    expect(res.truncated).toBe(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capped = await fetchAllRows((() => createQueryBuilder({ data: full, error: null })) as any, PAGE_SIZE * 2);
    expect(capped.truncated).toBe(true);
    expect(capped.rows).toHaveLength(PAGE_SIZE * 2);
  });
});

describe("CSV helpers", () => {
  it("quotes cells and neutralises formula injection in text", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(null)).toBe('""');
  });

  it("emits a BOM and CRLF rows", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe('﻿"a","b"\r\n"1","x"');
  });
});
