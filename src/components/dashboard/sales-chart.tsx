"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getRevenueChart } from "@/lib/queries/analytics";
import { Loader2 } from "lucide-react";

type Period = "week" | "month" | "year";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-[var(--shadow-lg)] backdrop-blur-[20px]">
      <p className="text-[11px] text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-[13px] text-[var(--text-primary)] font-medium">
        {payload[0].value.toFixed(1)} JOD
      </p>
      {payload[1] && (
        <p className="text-[11px] text-[var(--accent-lavender)]">
          {payload[1].value} bookings
        </p>
      )}
    </div>
  );
}

export function SalesChart() {
  const [period, setPeriod] = useState<Period>("week");
  const t = useTranslation();
  const { shopId } = useWorkspaceStore();
  const supabase = createClient();

  const { data: chartResult, loading } = useSupabaseQuery(
    async () => {
      const result = await getRevenueChart(supabase, shopId, period);
      return { data: result, error: result.error };
    },
    [shopId, period],
    { enabled: !!shopId },
  );

  const data = (chartResult as { data: { label: string; revenue: number; bookings: number }[] })?.data ?? [];

  const periodLabels: Record<Period, string> = {
    week: t.dashboard.weekly,
    month: t.dashboard.monthly,
    year: t.dashboard.yearly,
  };

  return (
    <GlassCard hoverable={false} padding="lg" className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)] font-light tracking-wide uppercase">
            {t.dashboard.revenueOverview}
          </p>
          <p className="text-lg text-[var(--text-primary)] font-light mt-0.5">
            {periodLabels[period]}
          </p>
        </div>

        {/* Period Toggles */}
        <div className="flex items-center bg-[var(--bg-surface)] rounded-[var(--radius-sm)] p-0.5">
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "relative px-3 py-1.5 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer z-10",
                period === p
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              {period === p && (
                <motion.div
                  layoutId="chart-period-pill"
                  className="absolute inset-0 bg-[var(--bg-surface-active)] rounded-[var(--radius-sm)] border border-[var(--border-primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{periodLabels[p]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <motion.div
        key={period}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="h-64"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={24} className="text-[var(--accent-mint)] animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[13px] text-[var(--text-muted)] font-light">
              No revenue data for this period
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent-mint)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent-mint)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="bookingsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent-lavender)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent-lavender)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-primary)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--accent-mint)"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "var(--accent-mint)",
                  stroke: "var(--bg-primary)",
                  strokeWidth: 2,
                }}
              />
              <Area
                type="monotone"
                dataKey="bookings"
                stroke="var(--accent-lavender)"
                strokeWidth={1.5}
                fill="url(#bookingsGradient)"
                dot={false}
                activeDot={{
                  r: 3,
                  fill: "var(--accent-lavender)",
                  stroke: "var(--bg-primary)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </GlassCard>
  );
}
