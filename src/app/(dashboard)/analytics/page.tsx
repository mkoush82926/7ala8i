"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";

const revenueData = [
  { name: "JAN", revenue: 2400 },
  { name: "FEB", revenue: 3100 },
  { name: "MAR", revenue: 2800 },
  { name: "APR", revenue: 3600 },
  { name: "MAY", revenue: 4200 },
  { name: "JUN", revenue: 3900 },
];

const barberData = [
  { name: "Ahmad Al-Fayed", revenue: 3420, pct: 92 },
  { name: "Zaid Khalil", revenue: 2850, pct: 78 },
  { name: "Omar S.", revenue: 2100, pct: 62 },
  { name: "Sami Haddad", revenue: 1940, pct: 55 },
];

const acquisitionData = [
  { name: "Instagram (45%)", value: 45, color: "#000000" },
  { name: "Google (25%)", value: 25, color: "#45464c" },
  { name: "Word of Mouth (15%)", value: 15, color: "#76777d" },
  { name: "Walk-in (10%)", value: 10, color: "#c6c6cc" },
  { name: "Other (5%)", value: 5, color: "#eceef0" },
];

const peakHoursData = [
  { hour: "09 AM", vals: [0.2, 0.3, 0.1, 0.2, 0.4, 0.7, 0.1] },
  { hour: "12 PM", vals: [0.4, 0.7, 0.4, 0.7, 1.0, 1.0, 0.2] },
  { hour: "03 PM", vals: [0.7, 0.4, 0.7, 0.7, 1.0, 0.7, 0.4] },
  { hour: "06 PM", vals: [1.0, 1.0, 1.0, 1.0, 0.7, 0.4, 0.1] },
];

const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const summaryMetrics = [
  { id: "revenue", label: "Revenue", value: "12,450 JOD", sub: "vs. 11,066 JOD last month", change: 12.5, dir: "up" },
  { id: "bookings", label: "Bookings", value: "842", sub: "Total appointments scheduled", change: 8.2, dir: "up" },
  { id: "clients", label: "New Clients", value: "124", sub: "First-time visitors this month", change: -1.4, dir: "down" },
  { id: "retention", label: "Retention Rate", value: "68.2%", sub: "Returning client frequency", change: 4.1, dir: "up" },
];

export default function AnalyticsPage() {
  const t = useTranslation();
  const { direction } = useThemeStore();
  const isRTL = direction === "rtl";
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.4, 1] }}
      className="space-y-8"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2
            className="font-extrabold tracking-tight text-on-surface"
            style={{ fontFamily: "Manrope, sans-serif", fontSize: 28 }}
          >
            {isRTL ? "التحليلات" : "Analytics"}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {isRTL ? "نظرة عامة على أداء المشغل" : "A comprehensive view of your atelier performance"}
          </p>
        </div>

        {/* Period Toggle — exactly like Stitch */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-container-low">
          {(["week", "month", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all cursor-pointer ${
                period === p
                  ? "bg-white text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {p === "week" ? (isRTL ? "أسبوعي" : "Weekly") : p === "month" ? (isRTL ? "شهري" : "Monthly") : (isRTL ? "سنوي" : "Yearly")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      {/* Practice #6 — 4-column grid with 20px gap (5×4 base unit) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
        {summaryMetrics.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            style={{
              // Practice #1 — contrast: white card, border, shadow
              background: "#ffffff",
              border: "1px solid #eceef0",
              borderRadius: 16,
              // Practice #3 — 32px = 8×4 base unit
              padding: 28,
              // Practice #5 — fixed min-height for consistency
              minHeight: 152,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              transition: "box-shadow 0.2s ease, transform 0.2s ease",
              cursor: "default",
            }}
            // Practice #8 — hover state
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
              (e.currentTarget as HTMLDivElement).style.transform = "";
            }}
          >
            {/* Top row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              {/* Practice #2 — label 11px UPPERCASE with strong tracking */}
              <span style={{ fontSize: 11, fontWeight: 700, color: "#76777d", textTransform: "uppercase", letterSpacing: "0.12em" }}>{m.label}</span>
              <div
                style={{
                  display: "flex", alignItems: "center", padding: "3px 8px",
                  borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: m.dir === "up" ? "#f0fdf4" : "#fffbeb",
                  color: m.dir === "up" ? "#16a34a" : "#d97706",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 2 }}>
                  {m.dir === "up" ? "trending_up" : "trending_flat"}
                </span>
                {m.change > 0 ? "+" : ""}{m.change}%
              </div>
            </div>
            {/* Practice #2 — 32px value = large enough for primary data */}
            <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 32, fontWeight: 800, color: "#191c1e", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {m.value}
            </div>
            {/* Practice #2 — sub text 12px */}
            <div style={{ fontSize: 12, color: "#b0b3b8", marginTop: 8 }}>{m.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts 2×2 Grid ── */}
      {/* Practice #6 — consistent 2-column grid with 20px gap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* 1. Revenue Trend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            // Practice #1 — white on #f7f9fb, border + shadow
            background: "#ffffff", border: "1px solid #eceef0",
            borderRadius: 16, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            transition: "box-shadow 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; }}
        >
          {/* Practice #2 — card title 16px bold */}
          <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, fontWeight: 700, color: "#191c1e", margin: "0 0 24px" }}>
            {isRTL ? "اتجاه الإيرادات" : "Revenue Trend"}
          </h3>
          {/* Practice #5 — fixed chart height */}
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000000" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#000000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#b0b3b8", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#b0b3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#191c1e", border: "none", borderRadius: 8, fontSize: 12, color: "#fff" }} labelStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }} />
                <Area type="monotone" dataKey="revenue" stroke="#191c1e" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "#191c1e", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 2. Top Barbers */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            background: "#ffffff", border: "1px solid #eceef0",
            borderRadius: 16, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            transition: "box-shadow 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, fontWeight: 700, color: "#191c1e", margin: 0 }}>
              {isRTL ? "أفضل الحلاقين" : "Top Barbers"}
            </h3>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#b0b3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>This Month</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {barberData.map((b, i) => (
              <div key={b.name}>
                {/* Top row: rank + name + amount */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  {/* Rank badge */}
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: 6,
                    background: i === 0 ? "#191c1e" : "#f4f6f8",
                    color: i === 0 ? "#fff" : "#76777d",
                    fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>#{i + 1}</span>
                  {/* Name */}
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#191c1e", flex: 1 }}>{b.name}</span>
                  {/* Percentage */}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#b0b3b8" }}>{b.pct}%</span>
                  {/* Amount */}
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#191c1e", fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "right" }}>
                    {b.revenue.toLocaleString()} JOD
                  </span>
                </div>
                {/* Progress bar — properly bounded */}
                <div style={{ height: 6, background: "#f0f2f5", borderRadius: 999, width: "100%" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i, ease: [0.25, 1, 0.5, 1] }}
                    style={{ height: "100%", background: i === 0 ? "#191c1e" : "#c6c6cc", borderRadius: 999 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 3. Acquisition Channels */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            background: "#ffffff", border: "1px solid #eceef0",
            borderRadius: 16, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            transition: "box-shadow 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; }}
        >
          <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, fontWeight: 700, color: "#191c1e", margin: "0 0 24px" }}>
            {isRTL ? "مصادر العملاء" : "Acquisition Channels"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, height: 200 }}>
            <div style={{ width: 180, height: 180, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={acquisitionData} cx="50%" cy="50%" innerRadius={56} outerRadius={82} paddingAngle={2} dataKey="value">
                    {acquisitionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {acquisitionData.map((ch) => (
                <div key={ch.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: ch.color, flexShrink: 0, border: ch.color === "#eceef0" ? "1px solid #c6c6cc" : undefined }} />
                  <span style={{ fontSize: 12, color: "#45464c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 4. Peak Hours Heatmap */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            background: "#ffffff", border: "1px solid #eceef0",
            borderRadius: 16, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            transition: "box-shadow 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, fontWeight: 700, color: "#191c1e", margin: 0 }}>
              {isRTL ? "ساعات الذروة" : "Peak Hours Heatmap"}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: "#b0b3b8" }}>Low</span>
              <div style={{ display: "flex", gap: 3 }}>
                {[0.1, 0.25, 0.5, 0.75, 1].map((o, i) => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: `rgba(0,0,0,${o})` }} />
                ))}
              </div>
              <span style={{ fontSize: 10, color: "#b0b3b8" }}>High</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "auto repeat(7, 1fr)" }}>
            <div />
            {days.map((d) => (
              <div key={d} style={{ fontSize: 9, fontWeight: 700, textAlign: "center", color: "#b0b3b8", letterSpacing: "0.05em" }}>{d}</div>
            ))}
            {peakHoursData.map((row) => (
              <React.Fragment key={row.hour}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#76777d", paddingRight: 8, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>{row.hour}</div>
                {row.vals.map((v, di) => (
                  <div
                    key={di}
                    // Practice #8 — heatmap cells have hover state
                    style={{
                      height: 28, borderRadius: 4,
                      background: `rgba(25,28,30,${v})`,
                      transition: "transform 0.15s", cursor: "default",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.1)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="pt-8 border-t border-surface-container-low flex justify-between items-center text-on-surface-variant">
        <p className="text-xs">© 2026 Lumina Digital Atelier. All rights reserved.</p>
        <div className="flex gap-4">
          <button className="text-xs hover:text-on-surface transition-colors cursor-pointer">Export Report</button>
          <button className="text-xs hover:text-on-surface transition-colors cursor-pointer">Data Privacy</button>
        </div>
      </footer>
    </motion.div>
  );
}
