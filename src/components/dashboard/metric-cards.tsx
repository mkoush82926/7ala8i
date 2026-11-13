"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Confetti } from "@/components/ui/confetti";
import { MetricCardsSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CalendarDays,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { useDashboardMetrics } from "@/hooks/use-dashboard-data";
import { cn } from "@/lib/utils";

interface StatCard {
  id: string;
  label: string;
  value: string;
  change: number;
  comparison: string;
  icon: React.ReactNode;
}

function ChangeBadge({ change, comparison }: { change: number; comparison: string }) {
  const { formatNumber } = useTranslation();
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const pct = `${up ? "+" : "−"}${formatNumber(Math.abs(change), { maximumFractionDigits: 1 })}%`;
  return (
    <p className="m-0 mt-2.5 flex flex-wrap items-center gap-1 text-[12px] font-bold">
      <span
        className={cn("inline-flex items-center gap-0.5", up ? "text-[var(--accent-text)]" : "text-[var(--accent-rose)]")}
      >
        <Icon size={13} aria-hidden="true" className="rtl:-scale-x-100" />
        <span dir="ltr">{pct}</span>
      </span>
      <span className="font-semibold text-[var(--text-muted)]">{comparison}</span>
    </p>
  );
}

export function MetricCards() {
  const { t, isRTL, FFD, formatCurrency, formatNumber } = useTranslation();
  const { metrics: m, loading, error, refetch } = useDashboardMetrics();

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

  const cards: StatCard[] = [
    {
      id: "bookings",
      label: t.dashboard.todaysBookings,
      value: formatNumber(m.todayBookings),
      change: m.todayBookingsChange,
      comparison: t.dashboard.vsYesterday,
      icon: <CalendarDays size={22} aria-hidden="true" />,
    },
    {
      id: "sales",
      label: t.dashboard.todaysSales,
      value: money(m.todaySales),
      change: m.todaySalesChange,
      comparison: t.dashboard.vsYesterday,
      icon: <Wallet size={22} aria-hidden="true" />,
    },
    {
      id: "weekly",
      label: t.dashboard.weeklyRevenue,
      value: money(m.weeklyTrajectory),
      change: m.weeklyTrajectoryChange,
      comparison: t.dashboard.vsLastWeek,
      icon: <TrendingUp size={22} aria-hidden="true" />,
    },
  ];

  const labelCls = cn("text-[11px] font-bold leading-normal", !isRTL && "uppercase tracking-[0.14em]");

  return (
    <div className="card-grid-4">
      {cards.map((card, index) => (
        <motion.section
          key={card.id}
          aria-label={card.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06, type: "spring", stiffness: 300, damping: 25 }}
          className="relative flex min-h-[152px] flex-col justify-between overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6 sm:p-7"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className={cn(labelCls, "m-0 text-[var(--text-secondary)]")}>{card.label}</h2>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)]">
              {card.icon}
            </span>
          </div>
          <div className="mt-6">
            <p
              className="m-0 text-[30px] font-extrabold leading-none tabular-nums text-[var(--text-primary)] sm:text-[34px]"
              style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.012em") }}
            >
              {card.value}
            </p>
            <ChangeBadge change={card.change} comparison={card.comparison} />
          </div>
        </motion.section>
      ))}

      {/* Daily goal — inverted brand card */}
      <motion.section
        aria-label={t.dashboard.dailyGoal}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: cards.length * 0.06, type: "spring", stiffness: 300, damping: 25 }}
        className="relative flex min-h-[152px] flex-col justify-between overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--brand-primary)] p-6 text-[var(--brand-on-primary)] sm:p-7"
      >
        <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
        <div className="flex items-start justify-between gap-3">
          <h2 className={cn(labelCls, "m-0 opacity-75")}>{t.dashboard.dailyGoal}</h2>
          <span className="text-[15px] font-extrabold tabular-nums">
            {formatNumber(Math.round(goalPct))}%
          </span>
        </div>
        <div className="mt-8">
          <div
            role="progressbar"
            aria-label={t.dashboard.dailyGoal}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(goalPct)}
            className="mb-4 h-1 w-full overflow-hidden rounded-full"
            style={{ background: "color-mix(in srgb, var(--brand-on-primary) 18%, transparent)" }}
          >
            <motion.div
              className="h-full rounded-full bg-[var(--brand-on-primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${goalPct}%` }}
              transition={{ delay: 0.3, duration: 1, ease: [0.25, 1, 0.5, 1] }}
            />
          </div>
          <p className="m-0 text-[12px] font-semibold opacity-80">
            {goalMet
              ? t.dashboard.goalReached
              : interpolate(t.dashboard.goalProgress, {
                  current: money(m.dailyProgress),
                  goal: money(m.dailyGoal),
                })}
          </p>
        </div>
      </motion.section>
    </div>
  );
}
