import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AnalyticsPeriod,
  DEFAULT_TIMEZONE,
  bucketKeyOf,
  getPeriodRange,
  inclusiveEnd,
  pctChange,
  zonedParts,
} from "./analytics-period";

export type { AnalyticsPeriod } from "./analytics-period";

// ═══════════════════════════════════════════════════════
// Analytics page data.
//
// Definitions (kept identical to the dashboard_metrics RPC so the Overview
// and Analytics pages never disagree):
//   • Revenue  = sum of daily_sales.amount (money actually taken), by sale time.
//   • Bookings = appointments that are not cancelled, by start time.
//   • New clients = client records created in the period.
//   • Repeat-client rate = share of the period's distinct clients who booked
//     two or more times in the period.
//
// Queries are bounded: every read is limited to the selected period and is
// paged with .range() (PostgREST silently caps a single response at 1000
// rows), up to MAX_ROWS per dataset; `truncated` tells the UI when the cap
// was hit. Long-term this aggregation belongs in SQL (see handoffs).
// ═══════════════════════════════════════════════════════

export const PAGE_SIZE = 1000;
export const MAX_ROWS = 20_000;

/** Booking sources (lib/types BOOKING_SOURCES); unknown/legacy values fold into "other". */
export const SOURCE_KEYS = ["online", "instagram", "google", "word_of_mouth", "walk_in", "whatsapp", "other"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export interface MetricDelta {
  current: number;
  previous: number;
  change: number;
}

export interface AnalyticsData {
  period: AnalyticsPeriod;
  timeZone: string;
  currency: string;
  range: { start: string; end: string };
  summary: {
    revenue: MetricDelta;
    bookings: MetricDelta;
    newClients: MetricDelta;
    /** 0–100, null when there are no clients in the period */
    repeatRate: { current: number | null; previous: number | null; change: number | null };
    averageTicket: MetricDelta;
  };
  /** Full, gap-free series: key is yyyy-MM-dd (week/month) or yyyy-MM (year). */
  revenueSeries: { key: string; revenue: number; bookings: number }[];
  bucket: "day" | "month";
  /** Top 5 staff by revenue; name null = sale without a barber. */
  barbers: { name: string | null; revenue: number; sales: number; pct: number }[];
  sources: { source: SourceKey; count: number; pct: number }[];
  /** Bookings per weekday (0=Sun…6=Sat) × hour, in shop time. */
  heatmap: { hours: number[]; counts: Record<number, number[]>; max: number; total: number };
  truncated: boolean;
}

type Row = Record<string, unknown>;
type Builder = PromiseLike<{ data: Row[] | null; error: { message: string } | null; count?: number | null }> & {
  range: (from: number, to: number) => Builder;
};

/** Pages through a query until exhausted or MAX_ROWS is reached. */
export async function fetchAllRows(
  makeQuery: () => Builder,
  maxRows = MAX_ROWS,
): Promise<{ rows: Row[]; error: { message: string } | null; truncated: boolean }> {
  const rows: Row[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, maxRows) - 1;
    const { data, error } = await makeQuery().range(from, to);
    if (error) return { rows, error, truncated: false };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < to - from + 1) return { rows, error: null, truncated: false };
  }
  return { rows, error: null, truncated: true };
}

function normalizeSource(src: unknown): SourceKey {
  const s = String(src ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return "walk_in";
  if (s === "walkin") return "walk_in";
  if (s === "wordofmouth" || s === "referral") return "word_of_mouth";
  return (SOURCE_KEYS as readonly string[]).includes(s) ? (s as SourceKey) : "other";
}

function repeatRate(rows: Row[]): number | null {
  const visits = new Map<string, number>();
  for (const r of rows) {
    const id = r.client_id as string | null;
    if (!id) continue;
    visits.set(id, (visits.get(id) ?? 0) + 1);
  }
  if (visits.size === 0) return null;
  let repeat = 0;
  visits.forEach((n) => {
    if (n >= 2) repeat += 1;
  });
  return +((repeat / visits.size) * 100).toFixed(1);
}

const sum = (rows: Row[]) => rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

export async function getFullAnalytics(
  supabase: SupabaseClient,
  shopId: string,
  period: AnalyticsPeriod,
  now: Date = new Date(),
): Promise<AnalyticsData> {
  // Shop settings drive the period boundaries and money formatting.
  const { data: shop } = await supabase.from("shops").select("timezone, currency").eq("id", shopId).maybeSingle();
  const timeZone = (shop as { timezone?: string | null } | null)?.timezone || DEFAULT_TIMEZONE;
  const currency = (shop as { currency?: string | null } | null)?.currency || "JOD";
  const range = getPeriodRange(period, timeZone, now);
  const curr = { from: range.start.toISOString(), to: inclusiveEnd(range.end) };
  const prev = { from: range.prevStart.toISOString(), to: inclusiveEnd(range.prevEnd) };

  const appts = (r: { from: string; to: string }, cols: string) => () =>
    supabase
      .from("appointments")
      .select(cols)
      .eq("shop_id", shopId)
      .neq("status", "cancelled")
      .gte("start_time", r.from)
      .lte("start_time", r.to)
      .order("start_time", { ascending: true }) as unknown as Builder;

  const sales = (r: { from: string; to: string }, cols: string) => () =>
    supabase
      .from("daily_sales")
      .select(cols)
      .eq("shop_id", shopId)
      .gte("created_at", r.from)
      .lte("created_at", r.to)
      .order("created_at", { ascending: true }) as unknown as Builder;

  const newClients = (r: { from: string; to: string }) =>
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .gte("created_at", r.from)
      .lte("created_at", r.to);

  const [currAppts, prevAppts, currSales, prevSales, currClients, prevClients] = await Promise.all([
    fetchAllRows(appts(curr, "id, start_time, source, client_id")),
    fetchAllRows(appts(prev, "id, client_id")),
    fetchAllRows(sales(curr, "amount, barber_name, created_at")),
    fetchAllRows(sales(prev, "amount")),
    newClients(curr),
    newClients(prev),
  ]);

  const firstError =
    currAppts.error ?? prevAppts.error ?? currSales.error ?? prevSales.error ?? currClients.error ?? prevClients.error;
  if (firstError) throw new Error(firstError.message);

  // ── Summary ──
  const revenue = sum(currSales.rows);
  const prevRevenue = sum(prevSales.rows);
  const bookings = currAppts.rows.length;
  const prevBookings = prevAppts.rows.length;
  const clientsNow = currClients.count ?? 0;
  const clientsPrev = prevClients.count ?? 0;
  const rr = repeatRate(currAppts.rows);
  const rrPrev = repeatRate(prevAppts.rows);
  const avg = currSales.rows.length ? revenue / currSales.rows.length : 0;
  const avgPrev = prevSales.rows.length ? prevRevenue / prevSales.rows.length : 0;

  // ── Revenue series (gap-free) ──
  const series = new Map(range.buckets.map((k) => [k, { key: k, revenue: 0, bookings: 0 }]));
  for (const s of currSales.rows) {
    const key = bucketKeyOf(String(s.created_at ?? ""), range.bucket, range.timeZone);
    const b = key ? series.get(key) : undefined;
    if (b) b.revenue += Number(s.amount) || 0;
  }
  for (const a of currAppts.rows) {
    const key = bucketKeyOf(String(a.start_time ?? ""), range.bucket, range.timeZone);
    const b = key ? series.get(key) : undefined;
    if (b) b.bookings += 1;
  }
  const revenueSeries = range.buckets.map((k) => {
    const b = series.get(k)!;
    return { key: b.key, revenue: +b.revenue.toFixed(3), bookings: b.bookings };
  });

  // ── Staff (from the same sales as Revenue) ──
  const byBarber = new Map<string, { revenue: number; sales: number }>();
  for (const s of currSales.rows) {
    const name = String(s.barber_name ?? "").trim();
    const entry = byBarber.get(name) ?? { revenue: 0, sales: 0 };
    entry.revenue += Number(s.amount) || 0;
    entry.sales += 1;
    byBarber.set(name, entry);
  }
  const barbers = [...byBarber.entries()]
    .map(([name, v]) => ({
      name: name || null,
      revenue: +v.revenue.toFixed(3),
      sales: v.sales,
      pct: revenue > 0 ? Math.round((v.revenue / revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Booking sources ──
  const bySource = new Map<SourceKey, number>();
  for (const a of currAppts.rows) {
    const k = normalizeSource(a.source);
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
  }
  const sources = [...bySource.entries()]
    .map(([source, count]) => ({ source, count, pct: bookings ? Math.round((count / bookings) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // ── Peak hours (all 7 days; hours span the data, min 9–20) ──
  const counts: Record<number, number[]> = {};
  const hourly: { weekday: number; hour: number }[] = [];
  let minHour = 9;
  let maxHour = 20;
  for (const a of currAppts.rows) {
    const d = new Date(String(a.start_time ?? ""));
    if (Number.isNaN(d.getTime())) continue;
    const p = zonedParts(d, range.timeZone);
    hourly.push({ weekday: p.weekday, hour: p.hour });
    minHour = Math.min(minHour, p.hour);
    maxHour = Math.max(maxHour, p.hour);
  }
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
  for (let day = 0; day < 7; day++) counts[day] = hours.map(() => 0);
  let max = 0;
  for (const { weekday, hour } of hourly) {
    const v = ++counts[weekday][hour - minHour];
    if (v > max) max = v;
  }

  return {
    period,
    timeZone: range.timeZone,
    currency,
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    summary: {
      revenue: { current: revenue, previous: prevRevenue, change: pctChange(revenue, prevRevenue) },
      bookings: { current: bookings, previous: prevBookings, change: pctChange(bookings, prevBookings) },
      newClients: { current: clientsNow, previous: clientsPrev, change: pctChange(clientsNow, clientsPrev) },
      repeatRate: {
        current: rr,
        previous: rrPrev,
        change: rr !== null && rrPrev !== null ? +(rr - rrPrev).toFixed(1) : null,
      },
      averageTicket: { current: avg, previous: avgPrev, change: pctChange(avg, avgPrev) },
    },
    revenueSeries,
    bucket: range.bucket,
    barbers,
    sources,
    heatmap: { hours, counts, max, total: hourly.length },
    truncated: currAppts.truncated || prevAppts.truncated || currSales.truncated || prevSales.truncated,
  };
}

// ─── CSV export ───

export interface ExportRow {
  start_time: string;
  client_name: string | null;
  service_name: string | null;
  barber_id: string | null;
  price: number | null;
  currency: string | null;
  status: string | null;
  payment_method: string | null;
  source: string | null;
}

/** Appointments of the selected period with curated columns (paged). */
export async function getAppointmentsForExport(
  supabase: SupabaseClient,
  shopId: string,
  period: AnalyticsPeriod,
  timeZone: string,
  now: Date = new Date(),
) {
  const range = getPeriodRange(period, timeZone, now);
  const result = await fetchAllRows(
    () =>
      supabase
        .from("appointments")
        .select("start_time, client_name, service_name, barber_id, price, currency, status, payment_method, source")
        .eq("shop_id", shopId)
        .gte("start_time", range.start.toISOString())
        .lte("start_time", inclusiveEnd(range.end))
        .order("start_time", { ascending: true }) as unknown as Builder,
  );
  return { rows: result.rows as unknown as ExportRow[], error: result.error, truncated: result.truncated, range };
}

/**
 * One CSV cell: quoted, quotes doubled, and spreadsheet formulas neutralised
 * (values starting with = + - @ or a tab/CR get a leading apostrophe), since
 * client names are user-supplied.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (Arabic names) correctly.
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
