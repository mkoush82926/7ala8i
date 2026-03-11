import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths } from "date-fns";

type Client = SupabaseClient<Database>;
type ApptRow = { id: string; price: number; status: string | null; start_time?: string; barber_id?: string | null };
type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

// Helper to query appointments for a date range with explicit typing
async function queryAppts(
  supabase: Client,
  shopId: string,
  fields: string,
  start: string,
  end: string,
  extraFilters?: { status?: string },
): Promise<QueryResult<ApptRow>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("appointments") as any).select(fields).eq("shop_id", shopId);

  if (extraFilters?.status) {
    query = query.eq("status", extraFilters.status);
  }

  query = query.gte("start_time", start).lte("start_time", end);

  return query as unknown as QueryResult<ApptRow>;
}

// ─── Dashboard metrics ───
export async function getDashboardMetrics(supabase: Client, shopId: string) {
  const today = new Date();
  const todayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const todayEnd = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const yesterdayStart = format(startOfDay(subDays(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");
  const yesterdayEnd = format(endOfDay(subDays(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");

  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
  const prevWeekStart = format(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
  const prevWeekEnd = format(endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");

  const monthStart = format(startOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
  const prevMonthStart = format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");
  const prevMonthEnd = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");

  const fields = "id, price, status";

  const [todayAppts, yesterdayAppts, weekAppts, prevWeekAppts, monthAppts, prevMonthAppts] =
    await Promise.all([
      queryAppts(supabase, shopId, fields, todayStart, todayEnd),
      queryAppts(supabase, shopId, fields, yesterdayStart, yesterdayEnd),
      queryAppts(supabase, shopId, fields, weekStart, weekEnd),
      queryAppts(supabase, shopId, fields, prevWeekStart, prevWeekEnd),
      queryAppts(supabase, shopId, fields, monthStart, monthEnd),
      queryAppts(supabase, shopId, fields, prevMonthStart, prevMonthEnd),
    ]);

  const calcRevenue = (appts: ApptRow[] | null) =>
    (appts ?? [])
      .filter((a) => a.status === "completed")
      .reduce((sum, a) => sum + a.price, 0);

  const calcCount = (appts: ApptRow[] | null) => (appts ?? []).length;

  const pctChange = (current: number, previous: number) =>
    previous === 0 ? (current > 0 ? 100 : 0) : +((current - previous) / previous * 100).toFixed(1);

  const todaySales = calcRevenue(todayAppts.data);
  const yesterdaySales = calcRevenue(yesterdayAppts.data);
  const weeklyRevenue = calcRevenue(weekAppts.data);
  const prevWeeklyRevenue = calcRevenue(prevWeekAppts.data);
  const monthlyRevenue = calcRevenue(monthAppts.data);
  const prevMonthlyRevenue = calcRevenue(prevMonthAppts.data);

  return {
    todayBookings: calcCount(todayAppts.data),
    todayBookingsChange: pctChange(calcCount(todayAppts.data), calcCount(yesterdayAppts.data)),
    todaySales,
    todaySalesChange: pctChange(todaySales, yesterdaySales),
    weeklyTrajectory: weeklyRevenue,
    weeklyTrajectoryChange: pctChange(weeklyRevenue, prevWeeklyRevenue),
    monthlyRevenue,
    monthlyRevenueChange: pctChange(monthlyRevenue, prevMonthlyRevenue),
    dailyGoal: 120, // TODO: make configurable per shop
    dailyProgress: todaySales,
  };
}

// ─── Revenue chart data ───
export async function getRevenueChart(
  supabase: Client,
  shopId: string,
  period: "week" | "month" | "year",
) {
  const today = new Date();
  let startDate: string;
  let endDate: string;

  switch (period) {
    case "week":
      startDate = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
      endDate = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
      break;
    case "month":
      startDate = format(startOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
      endDate = format(endOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
      break;
    case "year":
      startDate = format(startOfYear(today), "yyyy-MM-dd'T'HH:mm:ss");
      endDate = format(endOfYear(today), "yyyy-MM-dd'T'HH:mm:ss");
      break;
  }

  const result = await queryAppts(supabase, shopId, "start_time, price, status", startDate, endDate, { status: "completed" });

  if (result.error) return { data: [], error: result.error };

  const appointments = result.data ?? [];

  // Group by date label
  const grouped: Record<string, { revenue: number; bookings: number }> = {};

  appointments.forEach((appt) => {
    const date = new Date(appt.start_time!);
    let label: string;

    switch (period) {
      case "week":
        label = format(date, "EEE");
        break;
      case "month":
        label = format(date, "MMM d");
        break;
      case "year":
        label = format(date, "MMM");
        break;
    }

    if (!grouped[label]) grouped[label] = { revenue: 0, bookings: 0 };
    grouped[label].revenue += appt.price;
    grouped[label].bookings += 1;
  });

  return {
    data: Object.entries(grouped).map(([label, vals]) => ({
      label,
      ...vals,
    })),
    error: null,
  };
}

// ─── Barber performance ───
export async function getBarberPerformance(supabase: Client, shopId: string) {
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");

  const result = await queryAppts(supabase, shopId, "barber_id, price, status", monthStart, monthEnd, { status: "completed" });

  if (result.error) return { data: [], error: result.error };

  const appointments = result.data ?? [];

  // Get barber names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = (await (supabase.from("profiles") as any)
    .select("id, full_name")
    .eq("shop_id", shopId)) as unknown as { data: { id: string; full_name: string }[] | null };

  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Aggregate
  const barberMap: Record<string, { name: string; revenue: number; bookings: number }> = {};

  appointments.forEach((appt) => {
    const id = appt.barber_id ?? "unknown";
    if (!barberMap[id]) {
      barberMap[id] = {
        name: nameMap.get(id) ?? "Unknown",
        revenue: 0,
        bookings: 0,
      };
    }
    barberMap[id].revenue += appt.price;
    barberMap[id].bookings += 1;
  });

  return {
    data: Object.values(barberMap).sort((a, b) => b.revenue - a.revenue),
    error: null,
  };
}
