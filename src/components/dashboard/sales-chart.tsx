"use client";

import React, { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useDashboardVersion } from "@/hooks/use-pos";
import { useShopSettings } from "@/hooks/use-dashboard-data";
import { createClient } from "@/lib/supabase/client";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type Period = "week" | "month" | "year";

export interface RevenuePoint {
  /** yyyy-MM-dd (day buckets) or yyyy-MM (month buckets). */
  key: string;
  date: Date;
  revenue: number;
}

/**
 * Builds a continuous series for the period (empty days/months included, so
 * the area does not jump over gaps) and sums sales into it. Weeks start on
 * Monday to match the dashboard_metrics RPC. Pure, exported for tests.
 */
export function buildRevenueSeries(
  sales: { amount: number | string | null; created_at: string | null }[],
  period: Period,
  now: Date = new Date(),
): RevenuePoint[] {
  const points: RevenuePoint[] = [];
  if (period === "year") {
    for (let d = startOfYear(now); d <= endOfYear(now); d = addMonths(d, 1)) {
      points.push({ key: format(d, "yyyy-MM"), date: d, revenue: 0 });
    }
  } else {
    const start = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
    const end = period === "week" ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      points.push({ key: format(d, "yyyy-MM-dd"), date: d, revenue: 0 });
    }
  }
  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const s of sales) {
    if (!s.created_at) continue;
    const at = new Date(s.created_at);
    if (Number.isNaN(at.getTime())) continue;
    const key = format(at, period === "year" ? "yyyy-MM" : "yyyy-MM-dd");
    const i = index.get(key);
    if (i !== undefined) points[i].revenue += Number(s.amount) || 0;
  }
  return points.map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }));
}

function periodRange(period: Period, now = new Date()): [Date, Date] {
  if (period === "week") return [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })];
  if (period === "month") return [startOfMonth(now), endOfMonth(now)];
  return [startOfYear(now), endOfYear(now)];
}

function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  formatLabel: (key: string) => string;
  formatValue: (n: number) => string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-[var(--brand-on-primary)] shadow-lg">
      <p className="m-0 mb-1 text-[11px] font-semibold opacity-70">{formatLabel(label)}</p>
      <p className="m-0 text-[15px] font-extrabold tabular-nums">{formatValue(payload[0].value)}</p>
    </div>
  );
}

export function SalesChart() {
  const [period, setPeriod] = useState<Period>("week");
  const { t, isRTL, FFD, formatCurrency, formatDate } = useTranslation();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const version = useDashboardVersion();
  const { currency } = useShopSettings();
  const [supabase] = useState(() => createClient());

  const { data: sales, initialLoading, refreshing, error, refetch } = useSupabaseQuery<
    { amount: number; created_at: string | null }[]
  >(
    async () => {
      const [from, to] = periodRange(period);
      const { data, error } = await supabase
        .from("daily_sales")
        .select("amount, created_at")
        .eq("shop_id", shopId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) return { data: null, error: { message: error.message } };
      return { data: (data ?? []) as { amount: number; created_at: string | null }[], error: null };
    },
    [shopId, period, version],
    { enabled: !!shopId },
  );

  const series = useMemo(() => buildRevenueSeries(sales ?? [], period), [sales, period]);
  const total = series.reduce((s, p) => s + p.revenue, 0);
  const hasData = total > 0;

  // Dates for axis labels are reconstructed from the bucket key.
  const byKey = useMemo(() => new Map(series.map((p) => [p.key, p.date])), [series]);
  const tickLabel = (key: string) => {
    const d = byKey.get(key);
    if (!d) return key;
    if (period === "week") return formatDate(d, { weekday: "short" });
    if (period === "month") return formatDate(d, { day: "numeric" });
    return formatDate(d, { month: "short" });
  };
  const tooltipLabel = (key: string) => {
    const d = byKey.get(key);
    if (!d) return key;
    return period === "year" ? formatDate(d, "monthYear") : formatDate(d, "long");
  };
  const money = (n: number) => formatCurrency(n, currency);
  const axisMoney = (n: number) =>
    formatCurrency(n, currency, { maximumFractionDigits: 0, minimumFractionDigits: 0, hideCurrency: true });

  const periods: { id: Period; label: string }[] = [
    { id: "week", label: t.dashboard.weekly },
    { id: "month", label: t.dashboard.monthly },
    { id: "year", label: t.dashboard.yearly },
  ];

  return (
    <section
      aria-labelledby="sales-chart-title"
      className="flex h-full flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5 sm:p-7 lg:px-9 lg:py-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="sales-chart-title"
            className="m-0 mb-1 text-[18px] font-extrabold text-[var(--text-primary)]"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.01em") }}
          >
            {t.dashboard.revenueOverview}
          </h2>
          <p className="m-0 text-[13px] text-[var(--text-muted)]">
            {hasData ? `${t.dashboard.periodTotal}: ${money(total)}` : t.dashboard.revenueSubtitle}
          </p>
        </div>

        <div
          role="group"
          aria-label={t.dashboard.chartPeriod}
          className="flex gap-0.5 rounded-lg bg-[var(--bg-secondary)] p-1"
        >
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "min-h-9 rounded-md px-3.5 text-[12px] font-bold transition-colors",
                !isRTL && "uppercase tracking-[0.06em]",
                period === p.id
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn("min-h-[220px] flex-1 transition-opacity", refreshing && "opacity-60")}
        aria-busy={refreshing || undefined}
      >
        {initialLoading ? (
          <ChartSkeleton bare height={220} />
        ) : error ? (
          <EmptyState
            bare
            size="sm"
            tone="error"
            icon={AlertTriangle}
            title={t.dashboard.revenueError}
            description={t.error.message}
            action={{ label: t.common.retry, onClick: refetch, icon: RefreshCw }}
          />
        ) : !hasData ? (
          <EmptyState
            bare
            size="sm"
            icon={TrendingUp}
            title={t.dashboard.noRevenue}
            description={t.dashboard.noRevenueHint}
          />
        ) : (
          <figure className="m-0 h-[240px] w-full" aria-label={`${t.dashboard.revenueOverview}: ${money(total)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--text-primary)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="var(--text-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="key"
                  reversed={isRTL}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tickFormatter={tickLabel}
                  tick={{ fontSize: 11, fill: "var(--text-secondary)", fontWeight: 600 }}
                />
                <YAxis
                  orientation={isRTL ? "right" : "left"}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  allowDecimals={false}
                  tickFormatter={axisMoney}
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                />
                <Tooltip
                  content={<ChartTooltip formatLabel={tooltipLabel} formatValue={money} />}
                  cursor={{ stroke: "var(--border-primary)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name={t.dashboard.revenue}
                  stroke="var(--text-primary)"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--text-primary)", stroke: "var(--bg-primary)", strokeWidth: 2.5 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </figure>
        )}
      </div>
    </section>
  );
}

export default SalesChart;
