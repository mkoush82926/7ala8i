import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DashboardMetrics } from "@/lib/supabase/database.types";
import { fetchAllRows } from "./analytics-page";
import {
  type AnalyticsPeriod,
  DEFAULT_TIMEZONE,
  bucketKeyOf,
  getPeriodRange,
  inclusiveEnd,
  pctChange,
} from "./analytics-period";

type Client = SupabaseClient<Database>;
type Row = Record<string, unknown>;

// Revenue everywhere = daily_sales (money taken), matching the
// dashboard_metrics RPC and the Analytics page. Bookings = non-cancelled
// appointments.

export interface DashboardMetricsView {
  todayBookings: number;
  todayBookingsChange: number;
  todaySales: number;
  todaySalesChange: number;
  weeklyTrajectory: number;
  weeklyTrajectoryChange: number;
  monthlyRevenue: number;
  monthlyRevenueChange: number;
  dailyGoal: number;
  dailyProgress: number;
  currency: string;
  timezone: string;
}

export function toDashboardMetricsView(m: Partial<DashboardMetrics> | null | undefined): DashboardMetricsView {
  const n = (v: unknown) => Number(v) || 0;
  const todaySales = n(m?.today_sales);
  return {
    todayBookings: n(m?.today_bookings),
    todayBookingsChange: pctChange(n(m?.today_bookings), n(m?.yesterday_bookings)),
    todaySales,
    todaySalesChange: pctChange(todaySales, n(m?.yesterday_sales)),
    weeklyTrajectory: n(m?.week_sales),
    weeklyTrajectoryChange: pctChange(n(m?.week_sales), n(m?.prev_week_sales)),
    monthlyRevenue: n(m?.month_sales),
    monthlyRevenueChange: pctChange(n(m?.month_sales), n(m?.prev_month_sales)),
    dailyGoal: m?.daily_goal == null ? 120 : n(m.daily_goal),
    dailyProgress: todaySales,
    currency: m?.currency || "JOD",
    timezone: m?.timezone || DEFAULT_TIMEZONE,
  };
}

// ─── Dashboard metrics (one RPC, shop time zone, weeks start Monday) ───
export async function getDashboardMetrics(
  supabase: Client,
  shopId: string,
): Promise<DashboardMetricsView & { error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("dashboard_metrics", { p_shop_id: shopId });
  return { ...toDashboardMetricsView(error ? null : (data as DashboardMetrics | null)), error: error ?? null };
}

async function shopZone(supabase: Client, shopId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("shops") as any).select("timezone").eq("id", shopId).maybeSingle();
  return (data as { timezone?: string | null } | null)?.timezone || DEFAULT_TIMEZONE;
}

function salesQuery(supabase: Client, shopId: string, cols: string, from: string, to: string) {
  return () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("daily_sales") as any)
      .select(cols)
      .eq("shop_id", shopId)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });
}

function bucketLabel(key: string, bucket: "day" | "month", period: AnalyticsPeriod, locale: string, timeZone: string) {
  const [y, m, d] = key.split("-").map(Number);
  // Noon UTC keeps the calendar date stable in any display zone.
  const date = new Date(Date.UTC(y, m - 1, d || 1, 12));
  const intl = locale === "ar" ? "ar-JO-u-nu-latn" : locale === "en" ? "en-GB" : locale;
  const opts: Intl.DateTimeFormatOptions =
    bucket === "month"
      ? { month: "short" }
      : period === "week"
        ? { weekday: "short" }
        : { day: "numeric", month: "short" };
  try {
    return new Intl.DateTimeFormat(intl, { ...opts, timeZone: "UTC" }).format(date);
  } catch {
    void timeZone;
    return key;
  }
}

// ─── Revenue chart data (gap-free buckets for the whole period) ───
export async function getRevenueChart(
  supabase: Client,
  shopId: string,
  period: AnalyticsPeriod,
  options: { locale?: string; now?: Date } = {},
) {
  const timeZone = await shopZone(supabase, shopId);
  const range = getPeriodRange(period, timeZone, options.now);
  const res = await fetchAllRows(
    salesQuery(supabase, shopId, "amount, created_at", range.start.toISOString(), inclusiveEnd(range.end)),
  );
  if (res.error) return { data: [], error: res.error };

  const buckets = new Map(range.buckets.map((k) => [k, { revenue: 0, bookings: 0 }]));
  for (const s of res.rows as Row[]) {
    const key = bucketKeyOf(String(s.created_at ?? ""), range.bucket, range.timeZone);
    const b = key ? buckets.get(key) : undefined;
    if (!b) continue;
    b.revenue += Number(s.amount) || 0;
    b.bookings += 1; // completed sales in the bucket
  }

  return {
    data: range.buckets.map((key) => ({
      /** yyyy-MM-dd or yyyy-MM in shop time — format with the locale helpers */
      date: key,
      label: bucketLabel(key, range.bucket, period, options.locale ?? "en", range.timeZone),
      revenue: +buckets.get(key)!.revenue.toFixed(3),
      bookings: buckets.get(key)!.bookings,
    })),
    error: null,
  };
}

// ─── Staff performance (this month, from sales) ───
export async function getBarberPerformance(supabase: Client, shopId: string, now?: Date) {
  const timeZone = await shopZone(supabase, shopId);
  const range = getPeriodRange("month", timeZone, now);
  const res = await fetchAllRows(
    salesQuery(supabase, shopId, "amount, barber_name", range.start.toISOString(), inclusiveEnd(range.end)),
  );
  if (res.error) return { data: [], error: res.error };

  const map = new Map<string, { name: string; revenue: number; bookings: number }>();
  for (const s of res.rows as Row[]) {
    const name = String(s.barber_name ?? "").trim();
    const entry = map.get(name) ?? { name, revenue: 0, bookings: 0 };
    entry.revenue += Number(s.amount) || 0;
    entry.bookings += 1;
    map.set(name, entry);
  }
  return {
    data: [...map.values()].sort((a, b) => b.revenue - a.revenue),
    error: null,
  };
}
