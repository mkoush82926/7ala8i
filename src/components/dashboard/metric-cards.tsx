"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Wallet, TrendingUp, Target, AlertTriangle, RefreshCw } from "lucide-react";
import { Confetti } from "@/components/ui/confetti";
import { MetricCardsSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard, type StatCardProps } from "@/components/ui/card";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useDashboardMetrics } from "@/hooks/use-dashboard-data";
import { cn } from "@/lib/utils";

/** Long currency values shrink a step on two-up phone grids instead of overflowing. */
const compactValue = "h-full max-sm:[&_.text-stat]:text-[22px] max-sm:[&_.text-stat]:leading-7";

/**
 * Overview KPI row (v2 §5.4 stat cards): bookings, sales, weekly revenue and
 * the daily goal. Values are never coloured; only the delta row is.
 */
export function MetricCards() {
  const { t, formatCurrency, formatNumber } = useTranslation();
  const { metrics: m, loading, error, refetch } = useDashboardMetrics();
  const reduceMotion = useReducedMotion();

  const goalPct = m.dailyGoal > 0 ? Math.min((m.dailyProgress / m.dailyGoal) * 100, 100) : 0;
  const goalMet = m.dailyGoal > 0 && m.dailyProgress >= m.dailyGoal;

  // Fire the confetti once per page view when the goal is reached.
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!goalMet) return;
    const timer = setTimeout(() => setShowConfetti(true), 800);
    return () => clearTimeout(timer);
  }, [goalMet]);

  if (loading) return <MetricCardsSkeleton />;

  if (error) {
    return (
      <EmptyState
        tone="error"
        size="sm"
        icon={AlertTriangle}
        title={t.dashboard.metricsError}
        description={t.error.message}
        action={{ label: t.common.retry, onClick: refetch, icon: RefreshCw }}
      />
    );
  }

  const money = (n: number) => formatCurrency(n, m.currency, { maximumFractionDigits: 2, trimZeros: true });
  const delta = (change: number, caption: string): StatCardProps["delta"] => ({
    value: `${change > 0 ? "+" : change < 0 ? "−" : ""}${formatNumber(Math.abs(change), { maximumFractionDigits: 1 })}%`,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    caption,
  });

  const cards: (StatCardProps & { id: string })[] = [
    {
      id: "bookings",
      label: t.dashboard.kpiBookingsToday,
      value: formatNumber(m.todayBookings),
      icon: <CalendarDays />,
      delta: delta(m.todayBookingsChange, t.dashboard.vsYesterday),
    },
    {
      id: "sales",
      label: t.dashboard.kpiSalesToday,
      value: money(m.todaySales),
      icon: <Wallet />,
      delta: delta(m.todaySalesChange, t.dashboard.vsYesterday),
    },
    {
      id: "weekly",
      label: t.dashboard.kpiWeeklyRevenue,
      value: money(m.weeklyTrajectory),
      icon: <TrendingUp />,
      delta: delta(m.weeklyTrajectoryChange, t.dashboard.vsLastWeek),
    },
  ];

  const enter = (index: number) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.12 } }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: Math.min(index, 3) * 0.04, duration: 0.28, ease: [0.05, 0.7, 0.1, 1] as const },
        };

  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-4">
      {cards.map(({ id, ...card }, index) => (
        <motion.li key={id} {...enter(index)} className="min-w-0">
          <StatCard {...card} className={compactValue} />
        </motion.li>
      ))}

      {/* Daily goal: same card grammar, with a teal progress bar */}
      <motion.li {...enter(cards.length)} className="min-w-0">
        <StatCard
          label={t.dashboard.kpiDailyGoal}
          value={`${formatNumber(Math.round(goalPct))}%`}
          icon={<Target />}
          className={cn(compactValue, "relative overflow-hidden")}
          footer={
            <div className="mt-auto flex flex-col gap-2 pt-1">
              <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
              <div
                role="progressbar"
                aria-label={t.dashboard.kpiDailyGoal}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(goalPct)}
                className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
              >
                <motion.div
                  className={cn("h-full rounded-full", goalMet ? "bg-success" : "bg-brand")}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${goalPct}%` }}
                  transition={reduceMotion ? { duration: 0 } : { delay: 0.2, duration: 0.5, ease: [0.05, 0.7, 0.1, 1] }}
                />
              </div>
              <p className={cn("m-0 text-xs font-semibold", goalMet ? "text-success-text" : "text-ink-muted")}>
                <bdi>
                  {goalMet
                    ? t.dashboard.goalReached
                    : interpolate(t.dashboard.goalProgress, {
                        current: money(m.dailyProgress),
                        goal: money(m.dailyGoal),
                      })}
                </bdi>
              </p>
            </div>
          }
        />
      </motion.li>
    </ul>
  );
}
