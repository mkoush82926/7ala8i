"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Legacy card API kept for compatibility; renders the v2 generic panel
 * surface (§5.4): white card, hairline border, 16px radius, no blur, no glow.
 * `elevated` → resting shadow-card; `hoverable` → lifts to shadow-raised.
 * `glow` is accepted but ignored (v2 has no glows).
 * New code: import { Card, Panel } from "@/components/ui/card".
 */
interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  glow?: "mint" | "lavender" | "blue" | "rose" | "none";
  hoverable?: boolean;
  padding?: "sm" | "md" | "lg" | "xl";
}

const paddingSizes = {
  sm: "p-4",
  md: "p-4 lg:p-5",
  lg: "p-5 lg:p-6",
  xl: "p-8 lg:p-10",
};

export function GlassCard({
  children,
  className,
  elevated = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  glow = "none",
  hoverable = true,
  padding = "lg",
  ...motionProps
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "relative rounded-xl border border-line bg-card text-ink",
        elevated && "shadow-card",
        paddingSizes[padding],
        hoverable &&
          "transition-[box-shadow,border-color] duration-200 ease-standard hover:border-line-strong/50 hover:shadow-raised motion-reduce:transition-none",
        className,
      )}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
