"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Download, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart3 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import {
  getFullAnalytics,
  getAppointmentsForExport,
  toCsv,
  type AnalyticsData,
  type AnalyticsPeriod,
  type SourceKey,
} from "@/lib/queries/analytics-page";
import { AnalyticsSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { SLICE_COLORS } from "./analytics-charts";

// recharts is only needed on this route — load it after first paint.
const RevenueTrendChart = dynamic(() => import("./analytics-charts").then((m) => m.RevenueTrendChart), {
  ssr: false,
  loading: () => <ChartSkeleton bare height={240} />,
});
const SourcesDonut = dynamic(() => import("./analytics-charts").then((m) => m.SourcesDonut), {
  ssr: false,
  loading: () => <div className="skeleton size-[168px] shrink-0 rounded-full" aria-hidden />,
});

const PERIODS: AnalyticsPeriod[] = ["week", "month", "year"];
/** Heatmap column order: Saturday-first in Arabic (Jordan), Monday-first in English. */
const DAY_ORDER: Record<"ar" | "en", number[]> = { ar: [6, 0, 1, 2, 3, 4, 5], en: [1, 2, 3, 4, 5, 6, 0] };

const card = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5 sm:p-7";

export default function AnalyticsPage() {
  const { t, isRTL, FF, locale, href, formatCurrency, formatNumber, formatDate, formatTime, formatRelative } =
    useTranslation();
  const a = t.analytics;
  const { shopId, hydrated } = useWorkspaceStore();
  const [period, setPeriod] = useState<AnalyticsPeriod>("month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!shopId) {
      if (hydrated) setLoading(false);
      return;
    }
    const id = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    try {
      const res = await getFullAnalytics(createClient(), shopId, period);
      if (id !== requestRef.current) return; // a newer period was requested
      setData(res);
      setLastUpdated(new Date());
    } catch {
      if (id !== requestRef.current) return;
      setFailed(true);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [shopId, hydrated, period]);

  useEffect(() => {
    // Data fetch on mount / period change.
    void load();
  }, [load]);

  // Keep the "updated x minutes ago" note fresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const currency = data?.currency ?? "JOD";
  const money = useCallback(
    (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 2, trimZeros: true }),
    [formatCurrency, currency],
  );

  const periodLabel: Record<AnalyticsPeriod, string> = {
    week: t.dashboard.weekly,
    month: t.dashboard.monthly,
    year: t.dashboard.yearly,
  };

  const sourceLabel = useCallback(
    (s: SourceKey | string | null): string => {
      switch (s) {
        case "online": return a.sourceOnline;
        case "instagram": return t.booking.instagram;
        case "google": return t.booking.google;
        case "word_of_mouth": return t.booking.wordOfMouth;
        case "walk_in": return t.booking.walkIn;
        case "whatsapp": return a.sourceWhatsapp;
        default: return t.booking.other;
      }
    },
    [a, t.booking],
  );

  // ── Revenue series with localized labels ──
  const series = useMemo(() => {
    if (!data) return [];
    return data.revenueSeries.map((p) => {
      const [y, m, d] = p.key.split("-").map(Number);
      const date = new Date(y, m - 1, d || 1, 12);
      const label =
        data.bucket === "month"
          ? formatDate(date, { month: "short" })
          : data.period === "week"
            ? formatDate(date, { weekday: "short" })
            : formatDate(date, { day: "numeric" });
      const fullLabel = data.bucket === "month" ? formatDate(date, "monthYear") : formatDate(date, "long");
      return { key: p.key, label, fullLabel, revenue: p.revenue };
    });
  }, [data, formatDate]);
  const hasRevenue = series.some((p) => p.revenue > 0);

  // ── CSV export of the selected period ──
  async function handleExport() {
    if (!shopId || exporting) return;
    setExporting(true);
    try {
      const supabase = createClient();
      const tz = data?.timeZone ?? "Asia/Amman";
      const [{ rows, error, truncated }, { data: staff }] = await Promise.all([
        getAppointmentsForExport(supabase, shopId, period, tz),
        supabase.from("profiles").select("id, full_name").eq("shop_id", shopId),
      ]);
      if (error) throw new Error(error.message);
      if (rows.length === 0) {
        toast.info(a.exportEmpty);
        return;
      }
      const names = new Map(((staff ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? ""]));
      const statusLabel: Record<string, string> = {
        pending: t.calendar.pending,
        confirmed: t.calendar.confirmed,
        completed: t.calendar.completed,
        no_show: t.calendar.noShow,
        "no-show": t.calendar.noShow,
        cancelled: a.statusCancelled,
      };
      const paymentLabel: Record<string, string> = {
        cash: t.dashboard.cash,
        card: t.dashboard.card,
        online: a.sourceOnline,
        mixed: a.paymentMixed,
      };
      const zoned = (iso: string, opts: Intl.DateTimeFormatOptions) =>
        formatDate(iso, { ...opts, timeZone: tz });
      const csv = toCsv(
        [a.csvDate, t.calendar.time, t.calendar.client, t.calendar.service, t.calendar.barber, t.services.price, t.settings.currency, t.calendar.status, a.csvPayment, a.csvSource],
        rows.map((r) => [
          zoned(r.start_time, { year: "numeric", month: "2-digit", day: "2-digit" }),
          formatTime(r.start_time, { timeZone: tz }),
          r.client_name ?? "",
          r.service_name ?? "",
          r.barber_id ? names.get(r.barber_id) ?? "" : "",
          r.price ?? 0,
          r.currency ?? currency,
          r.status ? statusLabel[r.status] ?? r.status : "",
          r.payment_method ? paymentLabel[r.payment_method] ?? r.payment_method : "",
          sourceLabel(r.source ? r.source.toLowerCase() : "walk_in"),
        ]),
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `appointments-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(interpolate(a.exportDone, { count: rows.length }));
      if (truncated) toast.info(a.truncated);
    } catch {
      toast.error(a.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  // ── Loading / empty / error ──
  if (!data && (loading || (!hydrated && !shopId))) return <AnalyticsSkeleton />;

  if (!shopId) {
    return <EmptyState icon={BarChart3} size="lg" title={a.noShopTitle} description={a.noShopDesc} />;
  }

  if (!data) {
    return (
      <EmptyState
        tone="error"
        size="lg"
        icon={AlertTriangle}
        title={a.loadFailed}
        description={t.error.message}
        action={{ label: t.common.retry, onClick: () => void load(), icon: RefreshCw }}
      />
    );
  }

  const s = data.summary;
  const summaryCards: { id: string; label: string; value: string; change: number | null; sub: string; unit?: "pts" }[] = [
    {
      id: "revenue",
      label: a.revenue,
      value: money(s.revenue.current),
      change: s.revenue.change,
      sub: interpolate(a.vsPrevious, { value: money(s.revenue.previous) }),
    },
    {
      id: "bookings",
      label: a.bookings,
      value: formatNumber(s.bookings.current),
      change: s.bookings.change,
      sub: interpolate(a.vsPrevious, { value: formatNumber(s.bookings.previous) }),
    },
    {
      id: "clients",
      label: a.newClients,
      value: formatNumber(s.newClients.current),
      change: s.newClients.change,
      sub: interpolate(a.vsPrevious, { value: formatNumber(s.newClients.previous) }),
    },
    {
      id: "repeat",
      label: a.repeatRate,
      value: s.repeatRate.current === null ? "—" : `${formatNumber(s.repeatRate.current, { maximumFractionDigits: 1 })}%`,
      change: s.repeatRate.change,
      sub: s.repeatRate.current === null ? a.notEnoughData : a.repeatRateHint,
      unit: "pts",
    },
  ];

  const dayOrder = DAY_ORDER[locale === "ar" ? "ar" : "en"];
  // 2026-01-04 is a Sunday → index = weekday
  const dayName = (wd: number, style: "short" | "long") => formatDate(new Date(2026, 0, 4 + wd, 12), { weekday: style });
  const hourLabel = (h: number) => formatTime(`${String(h).padStart(2, "0")}:00`, { hour: "numeric" });
  const heat = data.heatmap;
  const topSources = data.sources.slice(0, 6);
  const otherCount = data.sources.slice(6).reduce((n, x) => n + x.count, 0);
  const slices = [
    ...topSources.map((x) => ({ key: x.source, name: sourceLabel(x.source), count: x.count, pct: x.pct })),
    ...(otherCount
      ? [{ key: "rest", name: t.booking.other, count: otherCount, pct: Math.round((otherCount / s.bookings.current) * 100) }]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.4, 1] }}
      className="flex flex-col gap-6 sm:gap-8"
    >
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            className="font-extrabold text-[var(--text-primary)]"
            style={{ fontFamily: FF, fontSize: 28, letterSpacing: headingTracking(isRTL, "0.014em") }}
          >
            {a.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{a.subtitle}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]" aria-live="polite">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" aria-hidden /> {a.updating}
              </span>
            ) : lastUpdated ? (
              interpolate(a.updatedAgo, { time: formatRelative(lastUpdated, now) })
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={a.periodLabel} className="flex items-center gap-1 rounded-lg bg-[var(--bg-secondary)] p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={cn(
                  "min-h-10 cursor-pointer rounded-md px-4 text-[13px] font-semibold transition-colors sm:px-5",
                  period === p
                    ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {periodLabel[p]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            aria-busy={exporting || undefined}
            className="btn btn-secondary min-h-11 text-[13px] font-semibold"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Download size={15} aria-hidden />}
            {a.exportCsv}
          </button>
        </div>
      </div>

      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--accent-rose)] bg-[var(--accent-rose-muted)] px-4 py-3 text-sm text-[var(--text-primary)]">
          <AlertTriangle size={16} className="text-[var(--accent-rose)]" aria-hidden />
          <span className="flex-1">{a.loadFailed}</span>
          <button type="button" className="btn btn-secondary min-h-9 text-[13px]" onClick={() => void load()}>
            {t.common.retry}
          </button>
        </div>
      )}
      {data.truncated && (
        <p role="status" className="rounded-lg bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          {a.truncated}
        </p>
      )}

      <div className={cn("flex flex-col gap-6 sm:gap-8 transition-opacity", loading && "opacity-60")} aria-busy={loading || undefined}>
        {/* ── Summary ── */}
        <div className="card-grid-4">
          {summaryCards.map((m) => (
            <div key={m.id} className={cn(card, "flex min-h-[148px] flex-col justify-between gap-3")}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-bold text-[var(--text-secondary)]">{m.label}</h3>
                <ChangePill change={m.change} unit={m.unit} label={a.changeVsPrevious} formatNumber={formatNumber} />
              </div>
              <p
                className="text-[28px] font-extrabold leading-none text-[var(--text-primary)] tabular-nums sm:text-[32px]"
                style={{ fontFamily: "var(--font-intervar), sans-serif" }}
              >
                {m.value}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{m.sub}</p>
            </div>
          ))}
        </div>

        <div className="card-grid-2">
          {/* 1. Revenue trend */}
          <section className={card} aria-labelledby="an-rev">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="an-rev" className="m-0 text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: FF }}>
                {a.revenueTrend}
              </h3>
              <span className="text-xs text-[var(--text-muted)]">{periodLabel[period]}</span>
            </div>
            {hasRevenue ? (
              <RevenueTrendChart
                data={series}
                isRTL={isRTL}
                formatValue={money}
                formatAxis={(n) => formatNumber(n, { notation: "compact", maximumFractionDigits: 1 })}
                caption={a.revenueTrend}
                columnLabels={{ period: a.csvDate, value: a.revenue }}
              />
            ) : (
              <EmptyState bare size="sm" icon={BarChart3} title={a.noRevenue} description={a.noRevenueHint} />
            )}
          </section>

          {/* 2. Top staff */}
          <section className={card} aria-labelledby="an-staff">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="an-staff" className="m-0 text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: FF }}>
                {a.topStaff}
              </h3>
              <Link href={href("/team")} className="text-xs font-semibold text-[var(--accent-text)] hover:underline">
                {a.viewTeam}
              </Link>
            </div>
            {data.barbers.length > 0 ? (
              <ol className="flex flex-col gap-5">
                {data.barbers.map((b, i) => (
                  <li key={`${b.name}-${i}`}>
                    <div className="mb-2.5 flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                          i === 0 ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
                        )}
                        aria-hidden
                      >
                        {formatNumber(i + 1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--text-primary)]">
                        {b.name ?? a.unassigned}
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">{b.pct}%</span>
                      <span className="min-w-[72px] text-end text-[13px] font-extrabold text-[var(--text-primary)] tabular-nums">
                        {money(b.revenue)}
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full rounded-full bg-[var(--border-subtle)]"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={b.pct}
                      aria-label={`${b.name ?? a.unassigned}: ${b.pct}%`}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${b.pct}%`, background: i === 0 ? "var(--text-primary)" : "var(--accent-brass)" }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState bare size="sm" title={a.noStaffData} />
            )}
          </section>

          {/* 3. Booking sources */}
          <section className={card} aria-labelledby="an-src">
            <h3 id="an-src" className="mb-5 mt-0 text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: FF }}>
              {a.sources}
            </h3>
            {slices.length > 0 ? (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
                <SourcesDonut data={slices} />
                <ul className="flex w-full flex-1 flex-col gap-2.5">
                  {slices.map((ch, i) => (
                    <li key={ch.key} className="flex items-center gap-2.5 text-[13px]">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{ch.name}</span>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums">{formatNumber(ch.count)}</span>
                      <span className="w-10 text-end text-[var(--text-muted)] tabular-nums">{ch.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState bare size="sm" title={a.noBookings} />
            )}
          </section>

          {/* 4. Peak hours (all 7 days, shop time) */}
          <section className={card} aria-labelledby="an-peak">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 id="an-peak" className="m-0 text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: FF }}>
                {a.peakHours}
              </h3>
              <div className="flex items-center gap-2" aria-hidden>
                <span className="text-[11px] text-[var(--text-muted)]">{a.low}</span>
                <div className="flex gap-[3px]">
                  {[0.12, 0.3, 0.5, 0.75, 1].map((o) => (
                    <span key={o} className="size-3 rounded-[3px]" style={{ background: heatColor(o) }} />
                  ))}
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">{a.high}</span>
              </div>
            </div>
            {heat.total === 0 ? (
              <EmptyState bare size="sm" title={a.noBookings} />
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[320px] border-separate" style={{ borderSpacing: 4 }}>
                  <caption className="sr-only">{a.peakHoursCaption}</caption>
                  <thead>
                    <tr>
                      <td />
                      {dayOrder.map((wd) => (
                        <th key={wd} scope="col" className="text-center text-[11px] font-bold text-[var(--text-secondary)]">
                          <abbr title={dayName(wd, "long")} className="no-underline">
                            {dayName(wd, "short")}
                          </abbr>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heat.hours.map((h, hi) => (
                      <tr key={h}>
                        <th scope="row" className="whitespace-nowrap pe-2 text-start text-[11px] font-semibold text-[var(--text-secondary)]">
                          {hourLabel(h)}
                        </th>
                        {dayOrder.map((wd) => {
                          const v = heat.counts[wd]?.[hi] ?? 0;
                          const label = `${dayName(wd, "long")} ${hourLabel(h)}: ${interpolate(a.bookingsCount, { count: formatNumber(v) })}`;
                          return (
                            <td
                              key={wd}
                              title={label}
                              className="h-6 rounded-[4px] p-0"
                              style={{ background: v ? heatColor(heat.max ? v / heat.max : 0) : "var(--bg-secondary)" }}
                            >
                              <span className="sr-only">{label}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </motion.div>
  );
}

/** Ink tint that works in light and dark themes. */
function heatColor(ratio: number) {
  const pct = Math.round(15 + Math.max(0, Math.min(1, ratio)) * 85);
  return `color-mix(in srgb, var(--text-primary) ${pct}%, transparent)`;
}

function ChangePill({
  change, unit, label, formatNumber,
}: {
  change: number | null;
  unit?: "pts";
  label: string;
  formatNumber: (n: number, o?: Intl.NumberFormatOptions) => string;
}) {
  if (change === null) return null;
  const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const text = `${change > 0 ? "+" : ""}${formatNumber(change, { maximumFractionDigits: 1 })}${unit === "pts" ? "" : "%"}`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        dir === "up" && "bg-[color-mix(in_srgb,var(--accent-brass)_14%,transparent)] text-[var(--accent-text)]",
        dir === "down" && "bg-[var(--accent-rose-muted)] text-[var(--accent-rose)]",
        dir === "flat" && "bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
      )}
    >
      <Icon size={12} aria-hidden className="rtl:-scale-x-100" />
      <span className="sr-only">{label}: </span>
      <span dir="ltr">{text}</span>
    </span>
  );
}
