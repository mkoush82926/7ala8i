"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getRevenueChart } from "@/lib/queries/analytics";
import { TrendingUp, Loader2 } from "lucide-react";

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
    <div style={{
      background: "#091135",
      border: "none",
      borderRadius: 12,
      padding: "10px 16px",
    }}>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "var(--font-intervar), sans-serif" }}>
        {payload[0].value.toFixed(1)} JOD
      </p>
    </div>
  );
}

export function SalesChart() {
  const [period, setPeriod] = useState<Period>("week");
  const { t } = useTranslation();
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
    week:  t.dashboard.weekly  || "Weekly",
    month: t.dashboard.monthly || "Monthly",
    year:  t.dashboard.yearly  || "Yearly",
  };

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e1e9f0",
      borderRadius: 12,
      padding: "32px 36px",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h3 style={{
            fontFamily: "var(--font-intervar), sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#091135",
            letterSpacing: "0.01em",
            margin: "0 0 4px",
          }}>
            {t.dashboard.revenueOverview || "Revenue Overview"}
          </h3>
          <p style={{ fontSize: 12, color: "#b1bbcd", margin: 0 }}>Track your earnings over time</p>
        </div>

        {/* Period toggle — pill style */}
        <div style={{
          display: "flex",
          background: "#e1e9f0",
          borderRadius: 8,
          padding: 4,
          gap: 2,
        }}>
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.08em",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                transition: "all 0.18s ease",
                background: period === p ? "#f5f3ff" : "transparent",
                color: period === p ? "#091135" : "#36394a",
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <motion.div
        key={period}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ flex: 1, minHeight: 220 }}
      >
        {loading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={24} style={{ color: "#b1bbcd", animation: "spin 1s linear infinite" }} />
          </div>
        ) : data.length === 0 ? (
          <div style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "#e1e9f0",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrendingUp size={22} style={{ color: "#b1bbcd" }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#b1bbcd", margin: 0 }}>No revenue data for this period</p>
            <p style={{ fontSize: 11, color: "#b1bbcd", margin: 0 }}>Bookings will appear here once completed</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#091135" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#091135" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e9f0" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#b1bbcd", fontWeight: 700 }}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#b1bbcd" }} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e1e9f0", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#091135"
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "#091135", stroke: "#ffffff", strokeWidth: 2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </div>
  );
}
