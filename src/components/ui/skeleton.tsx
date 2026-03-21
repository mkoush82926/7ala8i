"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "circle" | "chart" | "button";
}

/*
 * Practice #4 — Loading state should resemble the content layout as closely as possible.
 * Each skeleton variant is carefully sized to mimic the actual component it replaces,
 * reducing user uncertainty while content loads.
 */
export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  const variantStyles = {
    text:    "h-4 w-full rounded",
    card:    "h-32 w-full",
    circle:  "h-10 w-10 rounded-full",
    chart:   "h-48 w-full",
    button:  "h-10 w-24 rounded-lg",
  };

  return (
    <div
      className={cn("skeleton", variantStyles[variant], className)}
      style={{ borderRadius: variant === "card" ? 16 : undefined }}
    />
  );
}

/*
 * DashboardSkeleton — matches the EXACT layout of the real dashboard:
 * - 4 metric cards with title + value + sub-label placeholder
 * - 2/3 chart + 1/3 daily receipt (matches actual grid proportions)
 */
export function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "8px 0" }}>
      {/* Metric card skeletons — match real 4-col grid with 24px gap */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid #eceef0",
              borderRadius: 16,
              padding: 28,
              minHeight: 152,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}
          >
            {/* Top row: label + trend badge */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Skeleton className="h-3 w-20" variant="text" />
              <div className="skeleton" style={{ height: 16, width: 44, borderRadius: 6 }} />
            </div>
            {/* Value */}
            <Skeleton className="h-8 w-28" variant="text" />
            {/* Sub-label */}
            <Skeleton className="h-3 w-36" variant="text" />
          </div>
        ))}
      </div>

      {/* Chart + Receipt skeletons — match the real 2/3 + 1/3 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Chart card skeleton */}
        <div
          style={{
            background: "#fff", border: "1px solid #eceef0",
            borderRadius: 16, padding: 28, minHeight: 320,
            display: "flex", flexDirection: "column", gap: 20,
          }}
        >
          {/* Card header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton className="h-4 w-32" variant="text" />
            <div style={{ display: "flex", gap: 8 }}>
              {[1,2,3].map(i => <Skeleton key={i} className="h-6 w-14 rounded-md" variant="text" />)}
            </div>
          </div>
          {/* Chart area */}
          <Skeleton variant="chart" className="flex-1 h-52 rounded-xl" />
        </div>

        {/* Receipt card skeleton */}
        <div
          style={{
            background: "#fff", border: "1px solid #eceef0",
            borderRadius: 16, padding: 28, minHeight: 320,
            display: "flex", flexDirection: "column", gap: 20,
          }}
        >
          <Skeleton className="h-4 w-24" variant="text" />
          {[1,2].map(i => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Skeleton variant="circle" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Skeleton className="h-3 w-20" variant="text" />
                  <Skeleton className="h-2 w-14" variant="text" />
                </div>
              </div>
              <Skeleton className="h-4 w-12" variant="text" />
            </div>
          ))}
          {/* Total row */}
          <div style={{ marginTop: "auto", borderTop: "1px solid #f2f4f6", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Skeleton className="h-3 w-16" variant="text" />
              <Skeleton className="h-6 w-20" variant="text" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
