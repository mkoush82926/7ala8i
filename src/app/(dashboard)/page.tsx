"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { DailyReceipt } from "@/components/dashboard/daily-receipt";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import {
    CalendarPlus,
    UserPlus,
    FileDown,
    Clock,
    User,
    Scissors,
} from "lucide-react";

// ─── Quick Actions Widget ───
function QuickActions() {
    const t = useTranslation();

    const actions = [
        {
            icon: CalendarPlus,
            label: t.calendar.newBooking,
            color: "var(--accent-mint)",
            href: "/calendar",
        },
        {
            icon: UserPlus,
            label: t.leads.addNewLead,
            color: "var(--accent-lavender)",
            href: "/leads",
        },
        {
            icon: FileDown,
            label: `${t.common.export} ${t.common.pdf}`,
            color: "var(--accent-blue)",
            href: "#",
        },
    ];

    return (
        <div className="flex gap-3">
            {actions.map((action, i) => (
                <motion.a
                    key={action.label}
                    href={action.href}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                    className="flex-1 glass-card-premium p-4 flex items-center gap-3 cursor-pointer group"
                >
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: `color-mix(in srgb, ${action.color} 15%, transparent)` }}
                    >
                        <action.icon size={16} style={{ color: action.color }} />
                    </div>
                    <span className="text-[13px] text-[var(--text-secondary)] font-light group-hover:text-[var(--text-primary)] transition-colors relative z-10">
                        {action.label}
                    </span>
                </motion.a>
            ))}
        </div>
    );
}

// ─── Upcoming Appointments Widget ───
function UpcomingAppointments() {
    const t = useTranslation();
    const { direction } = useThemeStore();
    const isRTL = direction === "rtl";

    const appointments = [
        {
            client: "Tariq Mansour",
            service: isRTL ? "قص شعر بريميوم" : "Premium Haircut",
            barber: "Ahmad",
            time: "3:30 PM",
            color: "var(--accent-mint)",
        },
        {
            client: "Sami Khalil",
            service: isRTL ? "تشذيب اللحية" : "Beard Trim & Shape",
            barber: "Khalid",
            time: "4:00 PM",
            color: "var(--accent-lavender)",
        },
        {
            client: "Nabil Darwish",
            service: isRTL ? "حلاقة بالمنشفة الساخنة" : "Hot Towel Shave",
            barber: "Omar",
            time: "4:30 PM",
            color: "var(--accent-blue)",
        },
    ];

    return (
        <div className="glass-card-premium p-5">
            <div className="flex items-center gap-2 mb-4 relative z-10">
                <Clock size={14} className="text-[var(--text-muted)]" />
                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-light">
                    {isRTL ? "المواعيد القادمة" : "Upcoming"}
                </span>
            </div>
            <div className="space-y-3 relative z-10">
                {appointments.map((apt, i) => (
                    <motion.div
                        key={apt.client}
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + i * 0.1 }}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] hover:border-[var(--border-hover)] transition-all group cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${apt.color} 12%, transparent)` }}
                            >
                                <User size={14} style={{ color: apt.color }} />
                            </div>
                            <div>
                                <p className="text-[13px] text-[var(--text-primary)] font-light">{apt.client}</p>
                                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                    <Scissors size={10} />
                                    <span>{apt.service}</span>
                                    <span className="opacity-50">·</span>
                                    <span>{apt.barber}</span>
                                </div>
                            </div>
                        </div>
                        <span className="text-[12px] text-[var(--text-tertiary)] font-light tabular-nums">
                            {apt.time}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    if (loading) return <DashboardSkeleton />;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
            className="space-y-8"
        >
            {/* Metric Cards */}
            <MetricCards />

            {/* Quick Actions */}
            <QuickActions />

            {/* Charts + Receipt + Upcoming */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <SalesChart />
                </div>
                <div className="space-y-6">
                    <DailyReceipt />
                    <UpcomingAppointments />
                </div>
            </div>
        </motion.div>
    );
}
