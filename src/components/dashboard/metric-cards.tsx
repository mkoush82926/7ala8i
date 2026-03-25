"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Confetti } from "@/components/ui/confetti";
import {
  CalendarDays,
  DollarSign,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getDashboardMetrics } from "@/lib/queries/analytics";

interface MetricCardData {
  id: string;
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  isDark?: boolean;
}

function AnimatedNumber({ value }: { value: string }) {
  const [displayed, setDisplayed] = useState("0");

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <motion.span
      key={displayed}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {displayed}
    </motion.span>
  );
}

export function MetricCards() {
  const { t } = useTranslation();
  const { shopId } = useWorkspaceStore();
  const supabase = createClient();

  const { data: metrics, loading } = useSupabaseQuery(
    async () => {
      const result = await getDashboardMetrics(supabase, shopId);
      return { data: result, error: null };
    },
    [shopId],
    { enabled: !!shopId },
  );

  const m = metrics ?? {
    todayBookings: 0,
    todayBookingsChange: 0,
    todaySales: 0,
    todaySalesChange: 0,
    weeklyTrajectory: 0,
    weeklyTrajectoryChange: 0,
    monthlyRevenue: 0,
    monthlyRevenueChange: 0,
    dailyGoal: 120,
    dailyProgress: 0,
  };

  const goalPct = m.dailyGoal > 0 ? Math.min((m.dailyProgress / m.dailyGoal) * 100, 100) : 0;

  const cards: MetricCardData[] = [
    {
      id: "bookings",
      label: t.dashboard.todaysBookings,
      value: m.todayBookings.toString(),
      change: m.todayBookingsChange,
      icon: <CalendarDays size={22} />,
    },
    {
      id: "sales",
      label: t.dashboard.todaysSales,
      value: `${m.todaySales.toFixed(1)} ${t.common.jod}`,
      change: m.todaySalesChange,
      icon: <DollarSign size={22} />,
    },
    {
      id: "weekly",
      label: t.dashboard.weeklyRevenue,
      value: `${m.weeklyTrajectory.toFixed(0)} ${t.common.jod}`,
      change: m.weeklyTrajectoryChange,
      icon: <TrendingUp size={22} />,
    },
    {
      id: "goal",
      label: t.dashboard.dailyGoal,
      value: `${goalPct.toFixed(0)}%`,
      change: m.monthlyRevenueChange,
      icon: <Target size={22} />,
      isDark: true,
    },
  ];

  const goalMet = m.dailyProgress >= m.dailyGoal;
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (goalMet) {
      const timer = setTimeout(() => setShowConfetti(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [goalMet]);

  if (loading) {
    return (
      <div className="card-grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            padding: 28, borderRadius: 16,
            border: "1px solid #eceef0",
            background: "#fff",
            minHeight: 152,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}>
            {/* Label + icon row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ height: 10, width: 80, borderRadius: 6, background: "#f0f2f5" }} />
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0f2f5" }} />
            </div>
            {/* Value placeholder */}
            <div style={{ height: 36, width: 110, borderRadius: 8, background: "#f0f2f5" }} />
            {/* Change badge placeholder */}
            <div style={{ height: 14, width: 90, borderRadius: 6, background: "#f0f2f5" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card-grid-4">
      {cards.map((metric, index) => (
        <motion.div
          key={metric.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, type: "spring", stiffness: 300, damping: 25 }}
          style={{
            position: "relative", overflow: "hidden",
            borderRadius: 16, display: "flex", flexDirection: "column",
            justifyContent: "space-between",
            // Practice #3 — 28px padding (7×4 base unit)
            padding: 28,
            // Practice #5 — fixed min-height for visual consistency
            minHeight: 152,
            background: metric.isDark ? "#191c1e" : "#ffffff",
            border: metric.isDark ? "none" : "1px solid #eceef0",
            // Practice #1 — contrasting shadow and border
            boxShadow: metric.isDark
              ? "0 8px 32px rgba(0,0,0,0.18)"
              : "0 1px 4px rgba(0,0,0,0.05)",
            // Practice #8 — transitions for interactive states
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
            cursor: "default",
          }}
          // Practice #8 — hover + active states
          onMouseEnter={(e) => {
            if (!metric.isDark) {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.09)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
            } else {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.24)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = metric.isDark
              ? "0 8px 32px rgba(0,0,0,0.18)"
              : "0 1px 4px rgba(0,0,0,0.05)";
            (e.currentTarget as HTMLDivElement).style.transform = "";
          }}
        >
          {metric.id === "goal" && (
            <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
          )}

          {/* Top row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{
              fontSize: 9, fontWeight: 800, textTransform: "uppercase",
              letterSpacing: "0.2em", lineHeight: 1.5,
              color: metric.isDark ? "rgba(255,255,255,0.6)" : "#76777d"
            }}>
              {metric.label}
            </span>
            {metric.isDark ? (
              <span style={{ fontSize: 14, fontWeight: 800, color: "#ffffff" }}>
                {metric.value}
              </span>
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "#f8fafc", border: "1px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#191c1e",
              }}>
                {metric.icon}
              </div>
            )}
          </div>

          {/* Value */}
          <div style={{ marginTop: 32 }}>
            {!metric.isDark && (
              <>
                <div
                  style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "#191c1e", lineHeight: 1, fontFamily: "Manrope, sans-serif" }}
                >
                  <AnimatedNumber value={metric.value} />
                </div>

                {/* Change badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, color: metric.change >= 0 ? "#10b981" : "#ef4444" }}>
                    {metric.change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {metric.change >= 0 ? "+" : ""}{metric.change}% vs yesterday
                  </span>
                </div>
              </>
            )}

            {/* Goal progress bar (dark card) */}
            {metric.isDark && (
              <div style={{ marginTop: 32 }}>
                <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
                  <motion.div
                    style={{ height: "100%", background: "#ffffff", borderRadius: 999, boxShadow: "0 0 12px rgba(255,255,255,0.4)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${goalPct}%` }}
                    transition={{ delay: 0.5, duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
                  />
                </div>
                <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.18em" }}>
                  {m.dailyProgress.toFixed(1)} of {m.dailyGoal} JOD target
                </p>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
