"use client";

import { useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useDashboardVersion } from "@/hooks/use-pos";
import type { DashboardMetrics as DashboardMetricsRow } from "@/lib/supabase/database.types";
import type { PaymentMethod } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────
   Overview data hooks.
   - Metrics come from ONE `dashboard_metrics` RPC (shop time zone,
     SECURITY INVOKER) instead of nine parallel queries that summed
     every sale row in the browser.
   - Shop display settings (currency, time zone, goal) are fetched once
     per shop and shared by every widget through a module cache.
   - Every hook re-runs when a POS mutation bumps the dashboard version.
   ───────────────────────────────────────────────────────────── */

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
  currency: string;
  timezone: string;
}

export interface SaleItem {
  id: string;
  clientName: string;
  service: string;
  barberName: string;
  amount: number;
  /** ISO timestamp of the sale. */
  soldAt: string;
  paymentMethod: PaymentMethod;
}

export interface ShopSettings {
  currency: string;
  timezone: string;
  dailyGoal: number;
}

export const DEFAULT_CURRENCY = "JOD";
const DEFAULT_GOAL = 120;

/** Percent change, one decimal. A rise from zero reads as +100%. */
export function calcChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const EMPTY_METRICS: DashboardMetrics = {
  todayBookings: 0,
  todayBookingsChange: 0,
  todaySales: 0,
  todaySalesChange: 0,
  weeklyTrajectory: 0,
  weeklyTrajectoryChange: 0,
  monthlyRevenue: 0,
  monthlyRevenueChange: 0,
  dailyGoal: DEFAULT_GOAL,
  dailyProgress: 0,
  currency: DEFAULT_CURRENCY,
  timezone: "Asia/Amman",
};

/** Maps the RPC row (or null, e.g. in mock mode) to the view model. Pure. */
export function toDashboardMetrics(row: Partial<DashboardMetricsRow> | null | undefined): DashboardMetrics {
  if (!row) return EMPTY_METRICS;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const todayBookings = n(row.today_bookings);
  const todaySales = n(row.today_sales);
  const week = n(row.week_sales);
  const month = n(row.month_sales);
  return {
    todayBookings,
    todayBookingsChange: calcChange(todayBookings, n(row.yesterday_bookings)),
    todaySales,
    todaySalesChange: calcChange(todaySales, n(row.yesterday_sales)),
    weeklyTrajectory: week,
    weeklyTrajectoryChange: calcChange(week, n(row.prev_week_sales)),
    monthlyRevenue: month,
    monthlyRevenueChange: calcChange(month, n(row.prev_month_sales)),
    dailyGoal: n(row.daily_goal) || DEFAULT_GOAL,
    dailyProgress: todaySales,
    currency: row.currency || DEFAULT_CURRENCY,
    timezone: row.timezone || EMPTY_METRICS.timezone,
  };
}

export function useDashboardMetrics() {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const version = useDashboardVersion();
  const [supabase] = useState(() => createClient());

  const query = useSupabaseQuery<DashboardMetrics>(
    async () => {
      const { data, error } = await supabase.rpc("dashboard_metrics", { p_shop_id: shopId });
      if (error) return { data: null, error: { message: error.message } };
      return { data: toDashboardMetrics(data as DashboardMetricsRow | null), error: null };
    },
    [shopId, version],
    { enabled: !!shopId },
  );

  return {
    metrics: query.data ?? EMPTY_METRICS,
    loading: query.initialLoading,
    refreshing: query.refreshing,
    error: query.error,
    refetch: query.refetch,
  };
}

/* ── Shop settings: one request per shop per session ── */
const settingsCache = new Map<string, Promise<ShopSettings>>();

async function loadShopSettings(shopId: string): Promise<ShopSettings> {
  const supabase = createClient();
  // daily_goal is a private column: only own-shop staff read it, via RPC.
  const [shopRes, privateRes] = await Promise.all([
    supabase.from("shops").select("currency, timezone").eq("id", shopId).maybeSingle(),
    supabase.rpc("get_my_shop_private"),
  ]);
  if (shopRes.error) throw shopRes.error;
  const row = (shopRes.data ?? {}) as { currency?: string | null; timezone?: string | null };
  const priv = ((privateRes.data ?? []) as { shop_id: string; daily_goal: number | null }[]).find(
    (r) => r.shop_id === shopId,
  );
  return {
    currency: row.currency || DEFAULT_CURRENCY,
    timezone: row.timezone || EMPTY_METRICS.timezone,
    dailyGoal: Number(priv?.daily_goal) || DEFAULT_GOAL,
  };
}

/** Clears the cached settings, e.g. after the settings page saves the currency. */
export function invalidateShopSettings(shopId?: string) {
  if (shopId) settingsCache.delete(shopId);
  else settingsCache.clear();
}

export function useShopSettings(): ShopSettings {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const { data } = useSupabaseQuery<ShopSettings>(
    async () => {
      let p = settingsCache.get(shopId);
      if (!p) {
        p = loadShopSettings(shopId);
        settingsCache.set(shopId, p);
        // Do not cache failures — the next mount retries.
        p.catch(() => settingsCache.delete(shopId));
      }
      return { data: await p, error: null };
    },
    [shopId],
    { enabled: !!shopId, retryCount: 0 },
  );
  return data ?? { currency: DEFAULT_CURRENCY, timezone: EMPTY_METRICS.timezone, dailyGoal: DEFAULT_GOAL };
}

/** Today's recorded sales (daily_sales rows written by complete_appointment_sale). */
export function useDailySales() {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const version = useDashboardVersion();
  const [supabase] = useState(() => createClient());

  const query = useSupabaseQuery<SaleItem[]>(
    async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("daily_sales")
        .select("id, client_name, service_name, barber_name, amount, payment_method, created_at")
        .eq("shop_id", shopId)
        .gte("created_at", startOfDay(now).toISOString())
        .lte("created_at", endOfDay(now).toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return { data: null, error: { message: error.message } };
      const rows = (data ?? []) as {
        id: string;
        client_name: string | null;
        service_name: string | null;
        barber_name: string | null;
        amount: number | string | null;
        payment_method: string | null;
        created_at: string | null;
      }[];
      return {
        data: rows.map((s) => ({
          id: s.id,
          clientName: s.client_name ?? "",
          service: s.service_name ?? "",
          barberName: s.barber_name ?? "",
          amount: Number(s.amount) || 0,
          soldAt: s.created_at ?? now.toISOString(),
          paymentMethod: (["cash", "card", "online", "mixed"].includes(s.payment_method ?? "")
            ? s.payment_method
            : "cash") as PaymentMethod,
        })),
        error: null,
      };
    },
    [shopId, version],
    { enabled: !!shopId },
  );

  return {
    sales: query.data ?? [],
    loading: query.initialLoading,
    refreshing: query.refreshing,
    error: query.error,
    refetch: query.refetch,
  };
}
