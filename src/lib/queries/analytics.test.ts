import { describe, it, expect, vi } from "vitest";
import { getDashboardMetrics, getRevenueChart, getBarberPerformance } from "./analytics";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

function client(fromMock: ReturnType<typeof vi.fn>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: fromMock } as any;
}

function appts(rows: { id: string; price: number; status: string | null }[]) {
  return createQueryBuilder({ data: rows, error: null });
}

describe("getDashboardMetrics", () => {
  it("computes revenue/booking counts and percentage changes for each window", async () => {
    const fromMock = vi
      .fn()
      // today: 100 completed + 50 pending (pending excluded from revenue)
      .mockReturnValueOnce(appts([{ id: "1", price: 100, status: "completed" }, { id: "2", price: 50, status: "pending" }]))
      // yesterday: 80 completed
      .mockReturnValueOnce(appts([{ id: "3", price: 80, status: "completed" }]))
      // this week: 200 completed
      .mockReturnValueOnce(appts([{ id: "4", price: 200, status: "completed" }]))
      // prev week: 0 revenue (empty)
      .mockReturnValueOnce(appts([]))
      // this month: 500 completed
      .mockReturnValueOnce(appts([{ id: "5", price: 500, status: "completed" }]))
      // prev month: 400 completed
      .mockReturnValueOnce(appts([{ id: "6", price: 400, status: "completed" }]));

    const result = await getDashboardMetrics(client(fromMock), "shop-1");

    expect(result.todaySales).toBe(100);
    expect(result.todaySalesChange).toBe(25); // (100-80)/80 * 100
    expect(result.todayBookings).toBe(2); // count includes pending
    expect(result.weeklyTrajectory).toBe(200);
    expect(result.weeklyTrajectoryChange).toBe(100); // prev was 0, curr > 0 => 100
    expect(result.monthlyRevenue).toBe(500);
    expect(result.monthlyRevenueChange).toBe(25); // (500-400)/400 * 100
  });

  it("reports 0% change when both current and previous periods are zero", async () => {
    const fromMock = vi.fn().mockReturnValue(appts([]));
    const result = await getDashboardMetrics(client(fromMock), "shop-1");

    expect(result.todaySalesChange).toBe(0);
    expect(result.todayBookingsChange).toBe(0);
  });
});

describe("getRevenueChart", () => {
  it("groups completed appointments by weekday label for the 'week' period", async () => {
    const fromMock = vi.fn().mockReturnValueOnce(
      createQueryBuilder({
        data: [
          { start_time: "2026-01-05T10:00:00", price: 50, status: "completed" }, // Monday
          { start_time: "2026-01-05T14:00:00", price: 30, status: "completed" }, // Monday
          { start_time: "2026-01-06T10:00:00", price: 20, status: "completed" }, // Tuesday
        ],
        error: null,
      }),
    );

    const result = await getRevenueChart(client(fromMock), "shop-1", "week");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { label: "Mon", revenue: 80, bookings: 2 },
      { label: "Tue", revenue: 20, bookings: 1 },
    ]);
  });

  it("returns an empty chart and surfaces the error when the query fails", async () => {
    const fromMock = vi.fn().mockReturnValueOnce(
      createQueryBuilder({ data: null, error: { message: "db down" } }),
    );

    const result = await getRevenueChart(client(fromMock), "shop-1", "month");

    expect(result).toEqual({ data: [], error: { message: "db down" } });
  });
});

describe("getBarberPerformance", () => {
  it("aggregates revenue/bookings per barber, maps names, and sorts descending", async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        createQueryBuilder({
          data: [
            { barber_id: "b1", price: 100, status: "completed" },
            { barber_id: "b2", price: 300, status: "completed" },
            { barber_id: "b1", price: 50, status: "completed" },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createQueryBuilder({
          data: [
            { id: "b1", full_name: "Ahmad" },
            { id: "b2", full_name: "Sara" },
          ],
          error: null,
        }),
      );

    const result = await getBarberPerformance(client(fromMock), "shop-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { name: "Sara", revenue: 300, bookings: 1 },
      { name: "Ahmad", revenue: 150, bookings: 2 },
    ]);
  });

  it("labels appointments with no matching profile as 'Unknown'", async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        createQueryBuilder({ data: [{ barber_id: "ghost", price: 10, status: "completed" }], error: null }),
      )
      .mockReturnValueOnce(createQueryBuilder({ data: [], error: null }));

    const result = await getBarberPerformance(client(fromMock), "shop-1");
    expect(result.data[0].name).toBe("Unknown");
  });
});
