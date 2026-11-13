"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

/* ═══════════════════════════════════════════════════════════════════════════
   Skeletons — loading placeholders shaped like the content they replace.
   - <Skeleton/> is the decorative primitive (aria-hidden).
   - Composites (SkeletonText, CardSkeleton, TableRowsSkeleton, ChartSkeleton,
     ListSkeleton, MetricCardsSkeleton, DashboardSkeleton) wrap themselves in
     a role="status" region with a translated "Loading…" label, so screen
     readers hear one announcement instead of silence.
   - No artificial delays: render these only while data is actually loading.
   - Colours come from --skeleton-base / --skeleton-highlight (dark-mode aware);
     the shimmer stops under prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SkeletonVariant = "text" | "card" | "circle" | "chart" | "button" | "avatar" | "pill";

interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;
  style?: React.CSSProperties;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: "h-4 w-full rounded-[4px]",
  card: "h-32 w-full rounded-[12px]",
  circle: "h-10 w-10 rounded-full",
  avatar: "h-10 w-10 rounded-full",
  chart: "h-48 w-full rounded-[12px]",
  button: "h-10 w-24 rounded-[8px]",
  pill: "h-6 w-16 rounded-full",
};

export function Skeleton({ className, variant = "text", style }: SkeletonProps) {
  return <div aria-hidden="true" className={cn("skeleton", variantStyles[variant], className)} style={style} />;
}

/** Accessible wrapper used by every composite skeleton. */
export function SkeletonGroup({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Screen-reader label; defaults to t.common.loading */
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label ?? t.common.loading}</span>
      {children}
    </div>
  );
}

const surface = "rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-primary)]";

/** Paragraph placeholder; the last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </SkeletonGroup>
  );
}

/** Generic content card: header line, value, sub-label. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonGroup className={cn(surface, "flex min-h-[152px] flex-col justify-between gap-4 p-6 sm:p-7", className)}>
      <CardSkeletonInner />
    </SkeletonGroup>
  );
}

function CardSkeletonInner() {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton variant="pill" className="h-4 w-11" />
      </div>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3 w-36 max-w-full" />
    </>
  );
}

/** Row of metric cards using the real .card-grid-4 breakpoints. */
export function MetricCardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("card-grid-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(surface, "flex min-h-[152px] flex-col justify-between gap-4 p-6 sm:p-7")}>
          <CardSkeletonInner />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * Table body placeholder. Render inside <tbody> with `asRows`, or standalone
 * (default) as a div-based list that mimics table rows on any width.
 */
export function TableRowsSkeleton({
  rows = 5,
  columns = 4,
  asRows = false,
  className,
}: {
  rows?: number;
  columns?: number;
  /** Emit <tr>/<td> so it can live inside an existing <tbody>. */
  asRows?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  if (asRows) {
    return (
      <>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r} aria-hidden={r > 0 ? true : undefined} className={className}>
            {Array.from({ length: columns }).map((_, c) => (
              <td key={c} className="px-4 py-3.5">
                {r === 0 && c === 0 && <span className="sr-only">{t.common.loading}</span>}
                <Skeleton className={cn("h-3.5", c === 0 ? "w-32" : c === columns - 1 ? "w-12" : "w-20")} />
              </td>
            ))}
          </tr>
        ))}
      </>
    );
  }
  return (
    <SkeletonGroup className={cn("divide-y divide-[var(--border-subtle)]", className)}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton variant="avatar" className="h-9 w-9 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5 max-w-[180px]" />
            <Skeleton className="h-3 w-1/4 max-w-[120px]" />
          </div>
          {Array.from({ length: Math.max(0, columns - 2) }).map((_, c) => (
            <Skeleton key={c} className="hidden h-3.5 w-16 sm:block" />
          ))}
          <Skeleton variant="pill" className="shrink-0" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** List of rows: leading icon, two text lines, trailing pill (services, clients, leads). */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn(surface, "flex items-center gap-4 p-4")}>
          <Skeleton className="h-11 w-11 shrink-0 rounded-[10px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2 max-w-[220px]" />
            <Skeleton className="h-3 w-1/3 max-w-[140px]" />
          </div>
          <Skeleton variant="pill" className="shrink-0" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** Chart card: title, period tabs and a bar-ish plot area. */
export function ChartSkeleton({
  className,
  height = 220,
  bare = false,
}: {
  className?: string;
  /** Plot-area height in px (default 220). */
  height?: number;
  /** Render only the plot area (no card chrome), e.g. inside an existing card. */
  bare?: boolean;
}) {
  const bars = [45, 70, 55, 85, 60, 95, 75];
  const plot = (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }} aria-hidden="true">
      {bars.map((h, i) => (
        <div key={i} className="skeleton flex-1 rounded-t-[6px] rounded-b-none" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
  if (bare) return <SkeletonGroup className={className}>{plot}</SkeletonGroup>;
  return (
    <SkeletonGroup className={cn(surface, "flex flex-col gap-5 p-6 sm:p-7", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-14 rounded-[6px]" />
          ))}
        </div>
      </div>
      {plot}
    </SkeletonGroup>
  );
}

/*
 * DashboardSkeleton — mirrors the Overview page: metric cards in the real
 * .card-grid-4 (4 → 2 → 1 columns) and the 2/3 + 1/3 .dashboard-main-grid
 * (stacks under 1024px). Token colours, so it also works in dark mode.
 */
export function DashboardSkeleton() {
  return (
    <SkeletonGroup className="flex flex-col gap-6 py-2">
      <div className="card-grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(surface, "flex min-h-[152px] flex-col justify-between gap-4 p-6 sm:p-7")}>
            <CardSkeletonInner />
          </div>
        ))}
      </div>

      <div className="dashboard-main-grid">
        {/* Chart card */}
        <div className={cn(surface, "flex min-h-[320px] flex-col gap-5 p-6 sm:p-7")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-14 rounded-[6px]" />
              ))}
            </div>
          </div>
          <Skeleton variant="chart" className="h-52 flex-1" />
        </div>

        {/* Receipt card */}
        <div className={cn(surface, "flex min-h-[320px] flex-col gap-5 p-6 sm:p-7")}>
          <Skeleton className="h-4 w-24" />
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
          <div className="mt-auto border-t border-[var(--border-subtle)] pt-5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}

/** Analytics page: metric cards + two chart cards. */
export function AnalyticsSkeleton() {
  return (
    <SkeletonGroup className="flex flex-col gap-6 py-2">
      <div className="card-grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(surface, "flex min-h-[152px] flex-col justify-between gap-4 p-6 sm:p-7")}>
            <CardSkeletonInner />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={cn(surface, "flex flex-col gap-5 p-6 sm:p-7")}>
            <Skeleton className="h-4 w-36" />
            <Skeleton variant="chart" className="h-56" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
