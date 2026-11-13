import { describe, expect, it } from "vitest";
import { buildRevenueSeries } from "./sales-chart";
import { escapeCsvValue } from "./daily-receipt";
import { calcChange, toDashboardMetrics, EMPTY_METRICS } from "@/hooks/use-dashboard-data";

describe("escapeCsvValue", () => {
  it("quotes separators and neutralises formulas", () => {
    expect(escapeCsvValue("plain")).toBe("plain");
    expect(escapeCsvValue('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvValue("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvValue("-5")).toBe("'-5");
  });
});

describe("buildRevenueSeries", () => {
  const now = new Date(2026, 10, 12, 15, 0); // Thu 12 Nov 2026

  it("fills a Monday-first week and sums sales per day", () => {
    const series = buildRevenueSeries(
      [
        { amount: 10, created_at: new Date(2026, 10, 12, 9).toISOString() },
        { amount: "5.5", created_at: new Date(2026, 10, 12, 18).toISOString() },
        { amount: 7, created_at: new Date(2026, 10, 9, 10).toISOString() },
        { amount: 99, created_at: new Date(2026, 10, 1).toISOString() }, // outside week
        { amount: 3, created_at: null },
      ],
      "week",
      now,
    );
    expect(series).toHaveLength(7);
    expect(series[0].key).toBe("2026-11-09");
    expect(series[0].revenue).toBe(7);
    expect(series[3].revenue).toBe(15.5);
    expect(series.reduce((s, p) => s + p.revenue, 0)).toBe(22.5);
  });

  it("uses month buckets for a year", () => {
    const series = buildRevenueSeries([{ amount: 4, created_at: new Date(2026, 1, 3).toISOString() }], "year", now);
    expect(series).toHaveLength(12);
    expect(series[1]).toMatchObject({ key: "2026-02", revenue: 4 });
  });
});

describe("dashboard metrics mapping", () => {
  it("computes percent change", () => {
    expect(calcChange(0, 0)).toBe(0);
    expect(calcChange(5, 0)).toBe(100);
    expect(calcChange(15, 10)).toBe(50);
    expect(calcChange(5, 10)).toBe(-50);
  });

  it("maps the RPC row and tolerates null", () => {
    expect(toDashboardMetrics(null)).toBe(EMPTY_METRICS);
    const m = toDashboardMetrics({
      today_bookings: 4,
      yesterday_bookings: 2,
      today_sales: 30,
      yesterday_sales: 0,
      week_sales: 100,
      prev_week_sales: 80,
      month_sales: 400,
      prev_month_sales: 500,
      daily_goal: 0,
      currency: "",
      timezone: "Asia/Amman",
    });
    expect(m.todayBookingsChange).toBe(100);
    expect(m.todaySalesChange).toBe(100);
    expect(m.weeklyTrajectoryChange).toBe(25);
    expect(m.monthlyRevenueChange).toBe(-20);
    expect(m.dailyGoal).toBe(EMPTY_METRICS.dailyGoal);
    expect(m.dailyProgress).toBe(30);
    expect(m.currency).toBe("JOD");
  });
});
