"use client";

// Recharts-based charts for the Analytics page. This module is loaded with
// next/dynamic (ssr: false) so recharts stays out of the route's first-load JS.
// Colours come from CSS tokens, so the charts follow the light/dark theme.

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

const tick = { fill: "var(--text-secondary)", fontSize: 11 } as const;

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
                <stop offset="0%" style={{ stopColor: "var(--accent-brass)", stopOpacity: 0.28 }} />
                <stop offset="100%" style={{ stopColor: "var(--accent-brass)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
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
              cursor={{ stroke: "var(--border-primary)" }}
              contentStyle={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text-primary)",
                direction: isRTL ? "rtl" : "ltr",
              }}
              labelStyle={{ color: "var(--text-secondary)", fontSize: 11 }}
              labelFormatter={(_label, payload) =>
                (payload?.[0]?.payload as RevenuePoint | undefined)?.fullLabel ?? String(_label)
              }
              formatter={(value) => [formatValue(Number(value)), columnLabels.value]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--text-primary)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: "var(--text-primary)", stroke: "var(--bg-primary)", strokeWidth: 2 }}
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

/** Token palette for categorical slices (light + dark aware). */
export const SLICE_COLORS = [
  "var(--text-primary)",
  "var(--accent-brass)",
  "var(--accent-mint)",
  "var(--text-secondary)",
  "var(--border-primary)",
  "var(--accent-rose)",
  "var(--text-muted)",
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
            stroke="var(--bg-primary)"
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
