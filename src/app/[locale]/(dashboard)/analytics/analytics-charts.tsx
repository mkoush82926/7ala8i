"use client";

// Recharts-based charts for the Analytics page. This module is loaded with
// next/dynamic (ssr: false) so recharts stays out of the route's first-load JS.
// Colours come from the v2 chart tokens (--color-chart-1..5, DESIGN_SYSTEM_V2
// §2.2/§2.3), so the charts follow the light/dark theme. chart-1 (teal) is
// always "this shop / this period".

import React, { useId } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export interface RevenuePoint {
  key: string;
  label: string;
  /** Long, accessible label (e.g. "Monday, 5 January 2026") */
  fullLabel: string;
  revenue: number;
}

export interface RevenueTrendChartProps {
  data: RevenuePoint[];
  isRTL: boolean;
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  /** Caption for the screen-reader data table */
  caption: string;
  columnLabels: { period: string; value: string };
  height?: number;
}

const tick = { fill: "var(--color-ink-muted)", fontSize: 12 } as const;

export function RevenueTrendChart({
  data, isRTL, formatValue, formatAxis, caption, columnLabels, height = 240,
}: RevenueTrendChartProps) {
  const gradientId = `rev-${useId().replace(/:/g, "")}`;
  return (
    <figure className="m-0">
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--color-chart-1)", stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: "var(--color-chart-1)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              reversed={isRTL}
              tick={tick}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              orientation={isRTL ? "right" : "left"}
              tick={tick}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => formatAxis(v)}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-line-strong)", strokeDasharray: "4 4" }}
              contentStyle={{
                background: "var(--color-inverse)",
                border: "none",
                borderRadius: 8,
                boxShadow: "var(--shadow-raised)",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-on-inverse)",
                direction: isRTL ? "rtl" : "ltr",
              }}
              itemStyle={{ color: "var(--color-on-inverse)" }}
              labelStyle={{ color: "var(--color-on-inverse)", opacity: 0.75, fontSize: 12, fontWeight: 500 }}
              labelFormatter={(_label, payload) =>
                (payload?.[0]?.payload as RevenuePoint | undefined)?.fullLabel ?? String(_label)
              }
              formatter={(value) => [formatValue(Number(value)), columnLabels.value]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-chart-1)"
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 5, fill: "var(--color-chart-1)", stroke: "var(--color-card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Same data for assistive tech */}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{columnLabels.period}</th>
            <th scope="col">{columnLabels.value}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.fullLabel}</th>
              <td>{formatValue(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface SourceSlice {
  key: string;
  name: string;
  count: number;
  pct: number;
}

/** Categorical slices: the v2 chart series, then neutrals (light + dark aware). */
export const SLICE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-ink-soft)",
  "var(--color-line-strong)",
];

export function SourcesDonut({ data, size = 168 }: { data: SourceSlice[]; size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.32}
            outerRadius={size * 0.48}
            paddingAngle={data.length > 1 ? 2 : 0}
            dataKey="count"
            nameKey="name"
            stroke="var(--color-card)"
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.key} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
