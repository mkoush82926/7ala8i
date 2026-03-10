"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "circle" | "chart";
}

export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  const variantStyles = {
    text: "h-4 w-full",
    card: "h-32 w-full rounded-[var(--radius-lg)]",
    circle: "h-10 w-10 rounded-full",
    chart: "h-48 w-full rounded-[var(--radius-lg)]",
  };

  return <div className={cn("skeleton", variantStyles[variant], className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-8 page-enter">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-28" />
        ))}
      </div>
      {/* Chart + Receipt */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton variant="chart" className="lg:col-span-2 h-72" />
        <Skeleton variant="card" className="h-72" />
      </div>
    </div>
  );
}
