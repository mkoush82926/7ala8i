"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  format, subDays, subWeeks, subMonths,
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
} from "date-fns";

interface RevenuePoint {
  name: string;
  revenue: number;
}

interface BarberPerf {
  name: string;
  revenue: number;
  clients: number;
}

interface AcquisitionPoint {
  name: string;
  value: number;
  color: string;
}

interface PeakHourPoint {
  hour: string;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
}

type Period = "week" | "month" | "year";

export function useAnalytics(period: Period = "month") {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const supabase = useRef(createClient()).current;

  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [barbers, setBarbers] = useState<BarberPerf[]>([]);
  const [acquisition, setAcquisition] = useState<AcquisitionPoint[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourPoint[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalRevenue: 0,
    totalBookings: 0,
    totalClients: 0,
    returnRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);

    try {
      const now = new Date();
      let rangeStart: Date;
      const rangeEnd = endOfDay(now);

      if (period === "week") {
        rangeStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      } else if (period === "month") {
        rangeStart = startOfMonth(subMonths(now, 1));
      } else {
        rangeStart = startOfDay(subMonths(now, 12));
      }

      const [salesRes, apptsRes, clientsRes, sourcesRes] = await Promise.all([
        supabase
          .from("daily_sales")
          .select("amount, barber_name, created_at")
          .eq("shop_id", shopId)
          .gte("created_at", rangeStart.toISOString())
          .lte("created_at", rangeEnd.toISOString()),
        supabase
          .from("appointments")
          .select("id, start_time, barber_id, source, status")
          .eq("shop_id", shopId)
          .neq("status", "cancelled")
          .gte("start_time", rangeStart.toISOString())
          .lte("start_time", rangeEnd.toISOString()),
        supabase
          .from("clients")
          .select("id, source")
          .eq("shop_id", shopId),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId),
      ]);

      const sales = salesRes.data || [];
      const appts = apptsRes.data || [];
      const clients = clientsRes.data || [];
      const totalClients = sourcesRes.count || clients.length || 0;

      const totalRevenue = sales.reduce((s, r) => s + Number(r.amount), 0);
      const totalBookings = appts.length;
      const returnRate = totalClients > 0 ? Math.min(Math.round((totalBookings / totalClients) * 100), 100) : 0;

      setSummaryMetrics({ totalRevenue, totalBookings, totalClients, returnRate });

      // Revenue trend
      if (period === "week") {
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = subDays(now, 6 - i);
          const key = format(d, "yyyy-MM-dd");
          const rev = sales.filter((s) => s.created_at?.startsWith(key)).reduce((sum, s) => sum + Number(s.amount), 0);
          return { name: dayNames[d.getDay()], revenue: rev };
        });
        setRevenue(days);
      } else if (period === "month") {
        const days = Array.from({ length: 30 }, (_, i) => {
          const d = subDays(now, 29 - i);
          const key = format(d, "yyyy-MM-dd");
          const rev = sales.filter((s) => s.created_at?.startsWith(key)).reduce((sum, s) => sum + Number(s.amount), 0);
          return { name: format(d, "d"), revenue: rev };
        });
        setRevenue(days);
      } else {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthData = months.map((m, idx) => {
          const ms = new Date(now.getFullYear(), idx, 1);
          const me = endOfMonth(ms);
          const rev = sales.filter((s) => { const d = new Date(s.created_at); return d >= ms && d <= me; }).reduce((sum, s) => sum + Number(s.amount), 0);
          return { name: m, revenue: rev };
        });
        setRevenue(monthData);
      }

      // Top barbers from sales
      const barberMap: Record<string, { revenue: number; clients: number }> = {};
      sales.forEach((s) => {
        const name = s.barber_name || "Unknown";
        if (!barberMap[name]) barberMap[name] = { revenue: 0, clients: 0 };
        barberMap[name].revenue += Number(s.amount);
        barberMap[name].clients += 1;
      });
      const barberList = Object.entries(barberMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setBarbers(barberList.length > 0 ? barberList : []);

      // Acquisition from client sources
      const sourceMap: Record<string, number> = {};
      clients.forEach((c) => {
        const src = (c.source as string) || "Direct";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
      const acqColors = ["var(--accent-mint)", "var(--accent-lavender)", "var(--accent-blue)", "var(--accent-amber)", "var(--accent-rose)"];
      const total = Object.values(sourceMap).reduce((s, v) => s + v, 0) || 1;
      const acqData = Object.entries(sourceMap)
        .map(([name, count], i) => ({ name, value: Math.round((count / total) * 100), color: acqColors[i % acqColors.length] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setAcquisition(acqData.length > 0 ? acqData : [{ name: "Direct", value: 100, color: "var(--accent-mint)" }]);

      // Peak hours from appointments
      const hourGrid: Record<string, Record<string, number>> = {};
      const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      for (let h = 9; h <= 19; h++) {
        const hKey = h <= 12 ? `${h}${h === 12 ? "PM" : "AM"}` : `${h - 12}PM`;
        hourGrid[hKey] = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 };
      }
      appts.forEach((a) => {
        const d = new Date(a.start_time);
        const h = d.getHours();
        if (h < 9 || h > 19) return;
        const hKey = h <= 12 ? `${h}${h === 12 ? "PM" : "AM"}` : `${h - 12}PM`;
        const dayKey = dayKeys[d.getDay()];
        if (dayKey !== "sun" && hourGrid[hKey] && dayKey in hourGrid[hKey]) {
          hourGrid[hKey][dayKey] += 1;
        }
      });
      const peakData = Object.entries(hourGrid).map(([hour, days]) => ({
        hour,
        mon: days.mon || 0, tue: days.tue || 0, wed: days.wed || 0,
        thu: days.thu || 0, fri: days.fri || 0, sat: days.sat || 0,
      }));
      setPeakHours(peakData);
    } catch { /* defaults stay */ }
    setLoading(false);
  }, [supabase, shopId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { revenue, barbers, acquisition, peakHours, summaryMetrics, loading };
}
