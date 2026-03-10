"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Confetti } from "@/components/ui/confetti";
import { cn } from "@/lib/utils";
import {
    CalendarDays,
    DollarSign,
    TrendingUp,
    Target,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { dashboardMetrics } from "@/lib/mock-data";
import { useTranslation } from "@/hooks/use-translation";

interface MetricCardData {
    id: string;
    label: string;
    value: string;
    change: number;
    icon: React.ReactNode;
    glow: "mint" | "lavender" | "blue" | "rose";
    accentColor: string;
}

function useMetrics(): MetricCardData[] {
    const t = useTranslation();
    return [
        {
            id: "bookings",
            label: t.dashboard.todaysBookings,
            value: dashboardMetrics.todayBookings.toString(),
            change: dashboardMetrics.todayBookingsChange,
            icon: <CalendarDays size={18} />,
            glow: "blue",
            accentColor: "var(--accent-blue)",
        },
        {
            id: "sales",
            label: t.dashboard.todaysSales,
            value: `${dashboardMetrics.todaySales.toFixed(1)} ${t.common.jod}`,
            change: dashboardMetrics.todaySalesChange,
            icon: <DollarSign size={18} />,
            glow: "mint",
            accentColor: "var(--accent-mint)",
        },
        {
            id: "weekly",
            label: t.dashboard.weeklyRevenue,
            value: `${dashboardMetrics.weeklyTrajectory.toFixed(0)} ${t.common.jod}`,
            change: dashboardMetrics.weeklyTrajectoryChange,
            icon: <TrendingUp size={18} />,
            glow: "lavender",
            accentColor: "var(--accent-lavender)",
        },
        {
            id: "goal",
            label: t.dashboard.dailyGoal,
            value: `${((dashboardMetrics.dailyProgress / dashboardMetrics.dailyGoal) * 100).toFixed(0)}%`,
            change: dashboardMetrics.monthlyRevenueChange,
            icon: <Target size={18} />,
            glow: "mint",
            accentColor: "var(--accent-mint)",
        },
    ];
}

function AnimatedNumber({ value }: { value: string }) {
    const [displayed, setDisplayed] = useState("0");

    useEffect(() => {
        // Simple animation: reveal the value after mount
        const timer = setTimeout(() => setDisplayed(value), 100);
        return () => clearTimeout(timer);
    }, [value]);

    return (
        <motion.span
            key={displayed}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
            {displayed}
        </motion.span>
    );
}

export function MetricCards() {
    const metrics = useMetrics();
    const goalMet =
        dashboardMetrics.dailyProgress >= dashboardMetrics.dailyGoal;
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (goalMet) {
            const timer = setTimeout(() => setShowConfetti(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [goalMet]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {metrics.map((metric, index) => (
                <motion.div
                    key={metric.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, type: "spring", stiffness: 300, damping: 25 }}
                >
                    <GlassCard
                        glow={metric.glow}
                        padding="lg"
                        className="relative overflow-hidden"
                    >
                        {/* Goal confetti */}
                        {metric.id === "goal" && (
                            <Confetti
                                trigger={showConfetti}
                                onComplete={() => setShowConfetti(false)}
                            />
                        )}

                        <div className="flex flex-col gap-1 mb-4">
                            <p className="text-[12px] text-[var(--text-secondary)] font-medium tracking-wide uppercase flex items-center gap-2">
                                <span style={{ color: metric.accentColor }}>{metric.icon}</span>
                                {metric.label}
                            </p>
                            <p className="text-[32px] text-[var(--text-primary)] font-light tracking-tight mt-1">
                                <AnimatedNumber value={metric.value} />
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div
                                className={cn(
                                    "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                                    metric.change >= 0
                                        ? "text-[var(--accent-mint)] bg-[var(--accent-mint-muted)]"
                                        : "text-[var(--accent-rose)] bg-[var(--accent-rose-muted)]"
                                )}
                            >
                                {metric.change >= 0 ? (
                                    <ArrowUpRight size={12} />
                                ) : (
                                    <ArrowDownRight size={12} />
                                )}
                                {Math.abs(metric.change)}%
                            </div>
                            <span className="text-[11px] text-[var(--text-tertiary)]">
                                vs last month
                            </span>
                        </div>

                        {/* Goal progress bar */}
                        {metric.id === "goal" && (
                            <div className="mt-3">
                                <div className="h-1 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{
                                            background: `linear-gradient(90deg, ${metric.accentColor}, var(--accent-lavender))`,
                                        }}
                                        initial={{ width: 0 }}
                                        animate={{
                                            width: `${Math.min(
                                                (dashboardMetrics.dailyProgress / dashboardMetrics.dailyGoal) * 100,
                                                100
                                            )}%`,
                                        }}
                                        transition={{
                                            delay: 0.5,
                                            duration: 1.2,
                                            ease: [0.25, 1, 0.5, 1],
                                        }}
                                    />
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                                    {dashboardMetrics.dailyProgress.toFixed(1)} / {dashboardMetrics.dailyGoal} {metrics[0] && metrics[0].value.includes('د.أ') ? 'د.أ' : 'JOD'}
                                </p>
                            </div>
                        )}
                    </GlassCard>
                </motion.div>
            ))}
        </div>
    );
}
