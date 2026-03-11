"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subWeeks, subMonths,
} from "date-fns";

export interface DashboardMetrics {
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
}

export interface SaleItem {
  id: string;
  clientName: string;
  service: string;
  barberName: string;
  amount: number;
  time: string;
  paymentMethod: "cash" | "card";
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

const emptyMetrics: DashboardMetrics = {
  todayBookings: 0, todayBookingsChange: 0,
  todaySales: 0, todaySalesChange: 0,
  weeklyTrajectory: 0, weeklyTrajectoryChange: 0,
  monthlyRevenue: 0, monthlyRevenueChange: 0,
  dailyGoal: 120, dailyProgress: 0,
};

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    async function fetchMetrics() {
      if (!shopId) { setLoading(false); return; }

      try {
        const now = new Date();
        const todayStart = startOfDay(now).toISOString();
        const todayEnd = endOfDay(now).toISOString();
        const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
        const yesterdayEnd = endOfDay(subDays(now, 1)).toISOString();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
        const prevWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();
        const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
        const prevMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

        const [
          todayAppts, yesterdayAppts,
          todaySalesRes, yesterdaySalesRes,
          weeklySalesRes, prevWeeklySalesRes,
          monthlySalesRes, prevMonthlySalesRes,
          shopRes,
        ] = await Promise.all([
          supabase.from("appointments").select("id", { count: "exact", head: true })
            .eq("shop_id", shopId).gte("start_time", todayStart).lte("start_time", todayEnd).neq("status", "cancelled"),
          supabase.from("appointments").select("id", { count: "exact", head: true })
            .eq("shop_id", shopId).gte("start_time", yesterdayStart).lte("start_time", yesterdayEnd).neq("status", "cancelled"),
          supabase.from("daily_sales").select("amount").eq("shop_id", shopId)
            .gte("created_at", todayStart).lte("created_at", todayEnd),
          supabase.from("daily_sales").select("amount").eq("shop_id", shopId)
            .gte("created_at", yesterdayStart).lte("created_at", yesterdayEnd),
          supabase.from("daily_sales").select("amount").eq("shop_id", shopId)
            .gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("daily_sales").select("amount").eq("shop_id", shopId)
            .gte("created_at", prevWeekStart).lte("created_at", prevWeekEnd),
          supabase.from("daily_sales").select("amount").eq("shop_id", shopId)
            .gte("created_at", monthStart).lte("created_at", monthEnd),
          supabase.from("daily_sales").select("amount").eq("shop_id", shopId)
            .gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd),
          supabase.from("shops").select("daily_goal").eq("id", shopId).single(),
        ]);

        const sum = (data: { amount: number }[] | null) => (data || []).reduce((s, r) => s + Number(r.amount), 0);

        const todayBookings = todayAppts.count || 0;
        const yesterdayBookings = yesterdayAppts.count || 0;
        const todaySalesTotal = sum(todaySalesRes.data);
        const yesterdaySalesTotal = sum(yesterdaySalesRes.data);
        const weeklyTotal = sum(weeklySalesRes.data);
        const prevWeeklyTotal = sum(prevWeeklySalesRes.data);
        const monthlyTotal = sum(monthlySalesRes.data);
        const prevMonthlyTotal = sum(prevMonthlySalesRes.data);
        const dailyGoal = Number(shopRes.data?.daily_goal) || 120;

        setMetrics({
          todayBookings,
          todayBookingsChange: calcChange(todayBookings, yesterdayBookings),
          todaySales: todaySalesTotal,
          todaySalesChange: calcChange(todaySalesTotal, yesterdaySalesTotal),
          weeklyTrajectory: weeklyTotal,
          weeklyTrajectoryChange: calcChange(weeklyTotal, prevWeeklyTotal),
          monthlyRevenue: monthlyTotal,
          monthlyRevenueChange: calcChange(monthlyTotal, prevMonthlyTotal),
          dailyGoal,
          dailyProgress: todaySalesTotal,
        });
      } catch {
        setMetrics(emptyMetrics);
      }
      setLoading(false);
    }

    fetchMetrics();
  }, [supabase, shopId]);

  return { metrics, loading };
}

export function useDailySales() {
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    async function fetchSales() {
      if (!shopId) { setLoading(false); return; }

      try {
        const now = new Date();
        const todayStart = startOfDay(now).toISOString();
        const todayEnd = endOfDay(now).toISOString();

        const { data, error } = await supabase
          .from("daily_sales")
          .select("*")
          .eq("shop_id", shopId)
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd)
          .order("sale_time", { ascending: false });

        if (error || !data) {
          setSales([]);
          setLoading(false);
          return;
        }

        setSales(data.map((s) => ({
          id: s.id,
          clientName: s.client_name,
          service: s.service_name,
          barberName: s.barber_name,
          amount: Number(s.amount),
          time: s.sale_time,
          paymentMethod: s.payment_method as "cash" | "card",
        })));
      } catch {
        setSales([]);
      }
      setLoading(false);
    }

    fetchSales();
  }, [supabase, shopId]);

  return { sales, loading };
}
