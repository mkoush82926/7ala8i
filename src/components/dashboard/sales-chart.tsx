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
import { useTranslation } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useDashboardVersion } from "@/hooks/use-pos";
import { useShopSettings } from "@/hooks/use-dashboard-data";
import { createClient } from "@/lib/supabase/client";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
    <div className="rounded-lg bg-inverse px-3 py-2 text-on-inverse shadow-raised">
      <p className="m-0 mb-0.5 text-xs text-on-inverse/75">{formatLabel(label)}</p>
      <p className="m-0 text-[15px] font-semibold tabular-nums">{formatValue(payload[0].value)}</p>
    </div>
  );
}

export function SalesChart() {
  const [period, setPeriod] = useState<Period>("week");
  const { t, isRTL, formatCurrency, formatDate } = useTranslation();
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
    <Panel
      aria-labelledby="sales-chart-title"
      className="flex flex-col"
      bodyClassName="flex flex-col gap-4"
      title={<span id="sales-chart-title">{t.dashboard.revenueOverview}</span>}
      description={
        hasData ? (
          <>
            {t.dashboard.periodTotal}: <bdi className="font-semibold tabular-nums text-ink">{money(total)}</bdi>
          </>
        ) : (
          t.dashboard.revenueSubtitle
        )
      }
      action={
        <SegmentedControl
          ariaLabel={t.dashboard.chartPeriod}
          value={period}
          onChange={setPeriod}
          size="sm"
          options={periods.map((p) => ({ value: p.id, label: p.label }))}
          className="hidden sm:inline-flex"
        />
      }
    >
      {/* Phones: the period switch gets its own full-width row */}
      <SegmentedControl
        ariaLabel={t.dashboard.chartPeriod}
        value={period}
        onChange={setPeriod}
        size="sm"
        fullWidth
        options={periods.map((p) => ({ value: p.id, label: p.label }))}
        className="sm:hidden"
      />

      <div
        className={cn("grid min-h-[240px] [&>*]:self-center transition-opacity duration-200 motion-reduce:transition-none", refreshing && "opacity-60")}
        aria-busy={refreshing || undefined}
      >
        {initialLoading ? (
          <ChartSkeleton bare height={240} />
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
              <AreaChart data={series} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="key"
                  reversed={isRTL}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tickFormatter={tickLabel}
                  tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }}
                />
                <YAxis
                  orientation={isRTL ? "right" : "left"}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  allowDecimals={false}
                  tickFormatter={axisMoney}
                  tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }}
                />
                <Tooltip
                  content={<ChartTooltip formatLabel={tooltipLabel} formatValue={money} />}
                  cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name={t.dashboard.revenue}
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--color-chart-1)", stroke: "var(--color-card)", strokeWidth: 2.5 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </figure>
        )}
      </div>
    </Panel>
  );
}

export default SalesChart;
