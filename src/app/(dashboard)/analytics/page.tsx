"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  ArrowUpRight,
  Star,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";

// ─── Mock Data ───
const revenueData = [
  { name: "Jan", revenue: 2400 },
  { name: "Feb", revenue: 3100 },
  { name: "Mar", revenue: 2800 },
  { name: "Apr", revenue: 3600 },
  { name: "May", revenue: 4200 },
  { name: "Jun", revenue: 3900 },
  { name: "Jul", revenue: 4800 },
  { name: "Aug", revenue: 5200 },
  { name: "Sep", revenue: 4700 },
  { name: "Oct", revenue: 5100 },
  { name: "Nov", revenue: 5600 },
  { name: "Dec", revenue: 6100 },
];

const barberData = [
  { name: "Ahmad", revenue: 1850, bookings: 42 },
  { name: "Khalid", revenue: 1620, bookings: 38 },
  { name: "Omar", revenue: 1480, bookings: 35 },
  { name: "Faris", revenue: 1320, bookings: 31 },
  { name: "Yousef", revenue: 1100, bookings: 26 },
];

const acquisitionData = [
  { name: "Instagram", value: 35, color: "#E1306C" },
  { name: "Google", value: 25, color: "#4285F4" },
  { name: "Word of Mouth", value: 22, color: "#6EE7B7" },
  { name: "Walk-in", value: 12, color: "#A78BFA" },
  { name: "Other", value: 6, color: "#666666" },
];

const peakHours = [
  { hour: "9AM", mon: 2, tue: 3, wed: 1, thu: 4, fri: 5, sat: 6 },
  { hour: "10AM", mon: 4, tue: 5, wed: 3, thu: 5, fri: 7, sat: 8 },
  { hour: "11AM", mon: 6, tue: 7, wed: 5, thu: 6, fri: 8, sat: 9 },
  { hour: "12PM", mon: 5, tue: 6, wed: 4, thu: 7, fri: 6, sat: 7 },
  { hour: "1PM", mon: 3, tue: 4, wed: 3, thu: 5, fri: 4, sat: 5 },
  { hour: "2PM", mon: 4, tue: 5, wed: 4, thu: 6, fri: 5, sat: 6 },
  { hour: "3PM", mon: 6, tue: 7, wed: 5, thu: 7, fri: 7, sat: 8 },
  { hour: "4PM", mon: 8, tue: 8, wed: 7, thu: 8, fri: 9, sat: 9 },
  { hour: "5PM", mon: 7, tue: 7, wed: 6, thu: 7, fri: 8, sat: 8 },
  { hour: "6PM", mon: 5, tue: 5, wed: 4, thu: 6, fri: 6, sat: 7 },
  { hour: "7PM", mon: 3, tue: 4, wed: 3, thu: 4, fri: 5, sat: 4 },
];

// ─── Summary Metrics ───
const summaryMetrics = [
  {
    id: "revenue",
    icon: TrendingUp,
    value: "5,620",
    unit: "JOD",
    change: 12.5,
    color: "var(--accent-mint)",
  },
  {
    id: "bookings",
    icon: BarChart3,
    value: "172",
    unit: "",
    change: 8.3,
    color: "var(--accent-lavender)",
  },
  {
    id: "clients",
    icon: Users,
    value: "89",
    unit: "",
    change: 15.2,
    color: "var(--accent-blue)",
  },
  {
    id: "retention",
    icon: Star,
    value: "78%",
    unit: "",
    change: 3.1,
    color: "var(--accent-amber)",
  },
];

export default function AnalyticsPage() {
  const t = useTranslation();
  const { direction } = useThemeStore();
  const isRTL = direction === "rtl";
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  const metricLabels: Record<string, string> = {
    revenue: isRTL ? "الإيرادات" : "Revenue",
    bookings: isRTL ? "الحجوزات" : "Bookings",
    clients: isRTL ? "عملاء جدد" : "New Clients",
    retention: isRTL ? "معدل الاحتفاظ" : "Retention",
  };

  const periods = [
    { key: "week" as const, label: t.dashboard.weekly },
    { key: "month" as const, label: t.dashboard.monthly },
    { key: "year" as const, label: t.dashboard.yearly },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.4, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-[20px] tracking-tight text-[var(--text-primary)] font-light">
          {t.sidebar.analytics}
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface)]">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-[var(--radius-sm)] text-[12px] font-medium transition-all cursor-pointer ${
                period === p.key
                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryMetrics.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card-premium p-6"
          >
            <div className="flex items-center justify-between mb-4 relative z-10">
              <p className="text-[12px] text-[var(--text-secondary)] font-medium tracking-wide uppercase flex items-center gap-2">
                <span style={{ color: m.color }}>
                  <m.icon size={14} />
                </span>
                {metricLabels[m.id]}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--accent-mint)] bg-[var(--accent-mint-muted)] px-2 py-0.5 rounded-full">
                <ArrowUpRight size={12} />
                {m.change}%
              </div>
            </div>
            <p className="text-[32px] text-[var(--text-primary)] font-light tracking-tight relative z-10 mt-1">
              {m.value}{" "}
              <span className="text-[14px] text-[var(--text-tertiary)]">
                {m.unit}
              </span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card-premium p-5"
        >
          <h3 className="text-[13px] text-[var(--text-primary)] font-light mb-4 relative z-10">
            {isRTL ? "اتجاه الإيرادات" : "Revenue Trend"}
          </h3>
          <div className="h-[240px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6EE7B7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6EE7B7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#666", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#666", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#999" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6EE7B7"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Barbers */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass-card-premium p-5"
        >
          <h3 className="text-[13px] text-[var(--text-primary)] font-light mb-4 relative z-10">
            {isRTL ? "أفضل الحلاقين" : "Top Barbers"}
          </h3>
          <div className="h-[240px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barberData} layout="vertical" barSize={16}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#666", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "#999", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {barberData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0
                          ? "#6EE7B7"
                          : i === 1
                            ? "#A78BFA"
                            : i === 2
                              ? "#60A5FA"
                              : "#444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Acquisition Channels */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass-card-premium p-5"
        >
          <h3 className="text-[13px] text-[var(--text-primary)] font-light mb-4 relative z-10">
            {isRTL ? "مصادر العملاء" : "Acquisition Channels"}
          </h3>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-[160px] h-[160px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={acquisitionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {acquisitionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 flex-1">
              {acquisitionData.map((ch) => (
                <div
                  key={ch.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: ch.color }}
                    />
                    <span className="text-[12px] text-[var(--text-secondary)] font-light">
                      {ch.name}
                    </span>
                  </div>
                  <span className="text-[12px] text-[var(--text-primary)] font-light tabular-nums">
                    {ch.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Peak Hours Heatmap */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="glass-card-premium p-5"
        >
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <Clock size={14} className="text-[var(--text-muted)]" />
            <h3 className="text-[13px] text-[var(--text-primary)] font-light">
              {isRTL ? "ساعات الذروة" : "Peak Hours"}
            </h3>
          </div>
          <div className="relative z-10 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-[10px] text-[var(--text-muted)] font-light text-start pb-2 w-12"></th>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <th
                      key={d}
                      className="text-[10px] text-[var(--text-muted)] font-light pb-2 text-center"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peakHours.map((row) => (
                  <tr key={row.hour}>
                    <td className="text-[10px] text-[var(--text-muted)] font-light py-0.5 pe-2">
                      {row.hour}
                    </td>
                    {["mon", "tue", "wed", "thu", "fri", "sat"].map((day) => {
                      const val = row[day as keyof typeof row] as number;
                      const opacity = Math.min(val / 9, 1);
                      return (
                        <td key={day} className="p-0.5">
                          <div
                            className="w-full h-5 rounded-sm transition-colors"
                            style={{
                              background: `rgba(110, 231, 183, ${opacity * 0.5})`,
                              border: `1px solid rgba(110, 231, 183, ${opacity * 0.15})`,
                            }}
                            title={`${row.hour} ${day}: ${val} bookings`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
