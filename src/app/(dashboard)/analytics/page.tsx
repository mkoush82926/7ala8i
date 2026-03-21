"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import { getFullAnalytics } from "@/lib/queries/analytics-page";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export default function AnalyticsPage() {
  const { direction } = useThemeStore();
  const { shopId } = useWorkspaceStore();
  const isRTL = direction === "rtl";
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  
  // Data state
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!shopId) return;
      setLoading(true);
      const supabase = createClient();
      const res = await getFullAnalytics(supabase, shopId, period);
      setData(res);
      setLoading(false);
    }
    fetchData();
  }, [shopId, period]);

  async function handleExport() {
    if (!shopId) return;
    setExporting(true);
    const supabase = createClient();
    const { data: appts } = await supabase.from('appointments').select('*').eq('shop_id', shopId).order('start_time', { ascending: false });
    
    if (appts && appts.length > 0) {
      const headers = Object.keys(appts[0]).join(",");
      const rows = appts.map(obj => Object.values(obj).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(",")).join("\n");
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appointments_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  if (loading && !data) return <DashboardSkeleton />;

  const { summaryMetrics, revenueData, barberData, acquisitionData, peakHoursData } = data ? {
    summaryMetrics: data.summary,
    revenueData: data.revenueChart,
    barberData: data.barberChart,
    acquisitionData: data.acquisitionChart,
    peakHoursData: data.peakChart
  } : { summaryMetrics: [], revenueData: [], barberData: [], acquisitionData: [], peakHoursData: [] };

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

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

        {/* Period Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-[12px] bg-[#f2f4f6]">
          {(["week", "month", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex items-center justify-center px-5 min-h-[36px] rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                period === p
                  ? "bg-white text-[#191c1e] shadow-sm"
                  : "text-[#76777d] hover:text-[#191c1e]"
              }`}
            >
              {p === "week" ? (isRTL ? "أسبوعي" : "Weekly") : p === "month" ? (isRTL ? "شهري" : "Monthly") : (isRTL ? "سنوي" : "Yearly")}
            </button>
          ))}
        </div>
      </div>

      {loading && data ? (
        <div style={{ position: "fixed", top: 16, right: 16, background: "#191c1e", color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, zIndex: 50, display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={14} className="animate-spin" /> Updating...
        </div>
      ) : null}

      {/* ── Summary Metric Cards ── */}
      <div className="card-grid-4">
        {summaryMetrics.map((m: any, i: number) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            style={{
              background: "#ffffff",
              border: "1px solid #eceef0",
              borderRadius: 16,
              padding: 28,
              minHeight: 152,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              transition: "box-shadow 0.2s ease, transform 0.2s ease",
              cursor: "default",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
              (e.currentTarget as HTMLDivElement).style.transform = "";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#76777d", textTransform: "uppercase", letterSpacing: "0.12em" }}>{m.label}</span>
              <div
                style={{
                  display: "flex", alignItems: "center", padding: "3px 8px",
                  borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: m.dir === "up" ? "#f0fdf4" : m.dir === "down" ? "#fef2f2" : "#fffbeb",
                  color: m.dir === "up" ? "#16a34a" : m.dir === "down" ? "#dc2626" : "#d97706",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 2 }}>
                  {m.dir === "up" ? "trending_up" : m.dir === "down" ? "trending_down" : "trending_flat"}
                </span>
                {m.change > 0 ? "+" : ""}{m.change}%
              </div>
            </div>
            <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 32, fontWeight: 800, color: "#191c1e", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {m.value}
            </div>
            <div style={{ fontSize: 12, color: "#b0b3b8", marginTop: 8 }}>{m.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts 2×2 Grid ── */}
      <div className="card-grid-2">

        {/* 1. Revenue Trend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            background: "#ffffff", border: "1px solid #eceef0",
            borderRadius: 16, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            transition: "box-shadow 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; }}
        >
          <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, fontWeight: 700, color: "#191c1e", margin: "0 0 24px" }}>
            {isRTL ? "اتجاه الإيرادات" : "Revenue Trend"}
          </h3>
          <div style={{ height: 220 }}>
            {revenueData.length > 0 ? (
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
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#b0b3b8", fontSize: 13 }}>No revenue data</div>
            )}
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
            <span style={{ fontSize: 10, fontWeight: 700, color: "#b0b3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>This {period}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {barberData.length > 0 ? barberData.map((b: any, i: number) => (
              <div key={b.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: 6,
                    background: i === 0 ? "#191c1e" : "#f4f6f8",
                    color: i === 0 ? "#fff" : "#76777d",
                    fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#191c1e", flex: 1 }}>{b.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#b0b3b8" }}>{b.pct}%</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#191c1e", fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "right" }}>
                    {b.revenue.toLocaleString()} JOD
                  </span>
                </div>
                <div style={{ height: 6, background: "#f0f2f5", borderRadius: 999, width: "100%" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i, ease: [0.25, 1, 0.5, 1] }}
                    style={{ height: "100%", background: i === 0 ? "#191c1e" : "#c6c6cc", borderRadius: 999 }}
                  />
                </div>
              </div>
            )) : (
              <div style={{ color: "#b0b3b8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No barber data</div>
            )}
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
                    {acquisitionData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {acquisitionData.map((ch: any) => (
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
            {peakHoursData.map((row: any) => (
              <React.Fragment key={row.hour}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#76777d", paddingRight: 8, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>{row.hour}</div>
                {row.vals.map((v: number, di: number) => (
                  <div
                    key={di}
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
        <p className="text-xs">© 2026 Halaqy Digital Atelier. All rights reserved.</p>
        <div className="flex gap-4">
          <button onClick={handleExport} disabled={exporting} className="nav-link text-xs flex items-center gap-2">
            {exporting ? <Loader2 size={12} className="animate-spin" /> : null} Export Report
          </button>
          <button className="nav-link text-xs">Data Privacy</button>
        </div>
      </footer>
    </motion.div>
  );
}
