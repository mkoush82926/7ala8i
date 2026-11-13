import { describe, it, expect, vi } from "vitest";
import { getDashboardMetrics, getRevenueChart, getBarberPerformance, toDashboardMetricsView } from "./analytics";
import { createQueryBuilder } from "@/test/mocks/supabase-query-builder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (fromMock: ReturnType<typeof vi.fn>, rpc?: ReturnType<typeof vi.fn>) => ({ from: fromMock, rpc }) as any;

// Wednesday 7 Jan 2026, 12:00 in Amman.
const NOW = new Date("2026-01-07T09:00:00Z");
const shop = () => createQueryBuilder({ data: { timezone: "Asia/Amman" }, error: null });

describe("getDashboardMetrics", () => {
  it("reads the dashboard_metrics RPC and derives % changes", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        today_bookings: 2,
        yesterday_bookings: 1,
        today_sales: 100,
        yesterday_sales: 80,
        week_sales: 200,
        prev_week_sales: 0,
        month_sales: 500,
        prev_month_sales: 400,
        daily_goal: 150,
        currency: "JOD",
        timezone: "Asia/Amman",
      },
      error: null,
    });

    const result = await getDashboardMetrics(client(vi.fn(), rpc), "shop-1");

    expect(rpc).toHaveBeenCalledWith("dashboard_metrics", { p_shop_id: "shop-1" });
    expect(result.todaySales).toBe(100);
    expect(result.todaySalesChange).toBe(25);
    expect(result.todayBookings).toBe(2);
    expect(result.todayBookingsChange).toBe(100);
    expect(result.weeklyTrajectoryChange).toBe(100);
    expect(result.monthlyRevenueChange).toBe(25);
    expect(result.dailyGoal).toBe(150);
    expect(result.dailyProgress).toBe(100);
    expect(result.error).toBeNull();
  });

  it("returns zeros and the error when the RPC fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "nope" } });
    const result = await getDashboardMetrics(client(vi.fn(), rpc), "shop-1");
    expect(result.todaySales).toBe(0);
    expect(result.todaySalesChange).toBe(0);
    expect(result.currency).toBe("JOD");
    expect(result.error).toEqual({ message: "nope" });
  });

  it("defaults the goal when the shop has none", () => {
    expect(toDashboardMetricsView({ daily_goal: undefined }).dailyGoal).toBe(120);
  });
});

describe("getRevenueChart", () => {
  it("builds a gap-free week of sales in shop time", async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(shop())
      .mockReturnValueOnce(
        createQueryBuilder({
          data: [
            { amount: 50, created_at: "2026-01-05T07:00:00Z" }, // Monday
            { amount: 30, created_at: "2026-01-05T11:00:00Z" }, // Monday
            { amount: 20, created_at: "2026-01-05T22:30:00Z" }, // 01:30 Tuesday in Amman
          ],
          error: null,
        }),
      );

    const result = await getRevenueChart(client(fromMock), "shop-1", "week", { now: NOW });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(7);
    expect(result.data[0]).toEqual({ date: "2026-01-05", label: "Mon", revenue: 80, bookings: 2 });
    expect(result.data[1]).toMatchObject({ date: "2026-01-06", revenue: 20, bookings: 1 });
    expect(result.data[6]).toMatchObject({ date: "2026-01-11", revenue: 0, bookings: 0 });
    expect(fromMock).toHaveBeenNthCalledWith(2, "daily_sales");
  });

  it("returns an empty chart and surfaces the error when the query fails", async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(shop())
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: { message: "db down" } }));

    const result = await getRevenueChart(client(fromMock), "shop-1", "month", { now: NOW });

    expect(result).toEqual({ data: [], error: { message: "db down" } });
  });
});

describe("getBarberPerformance", () => {
  it("aggregates sales per barber and sorts by revenue", async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(shop())
      .mockReturnValueOnce(
        createQueryBuilder({
          data: [
            { amount: 100, barber_name: "Ahmad" },
            { amount: 300, barber_name: "Sara" },
            { amount: 50, barber_name: "Ahmad" },
          ],
          error: null,
        }),
      );

    const result = await getBarberPerformance(client(fromMock), "shop-1", NOW);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { name: "Sara", revenue: 300, bookings: 1 },
      { name: "Ahmad", revenue: 150, bookings: 2 },
    ]);
  });
});
