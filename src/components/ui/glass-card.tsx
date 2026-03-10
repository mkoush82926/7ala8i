"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  glow?: "mint" | "lavender" | "blue" | "rose" | "none";
  hoverable?: boolean;
  padding?: "sm" | "md" | "lg" | "xl";
}

const glowColors = {
  mint: "hover:shadow-[0_0_20px_rgba(110,231,183,0.15)]",
  lavender: "hover:shadow-[0_0_20px_rgba(167,139,250,0.15)]",
  blue: "hover:shadow-[0_0_20px_rgba(96,165,250,0.15)]",
  rose: "hover:shadow-[0_0_20px_rgba(251,113,133,0.15)]",
  none: "",
};

const paddingSizes = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
  xl: "p-12",
};

export function GlassCard({
  children,
  className,
  elevated = false,
  glow = "none",
  hoverable = true,
  padding = "lg",
  ...motionProps
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "relative rounded-[var(--radius-lg)] border border-[var(--border-primary)]",
        elevated
          ? "bg-[var(--glass-bg-elevated)] backdrop-blur-[20px]"
          : "bg-[var(--glass-bg)] backdrop-blur-[20px]",
        paddingSizes[padding],
        hoverable && [
          "transition-all duration-[250ms]",
          "hover:bg-[var(--bg-surface-hover)]",
          "hover:border-[var(--border-hover)]",
          "hover:-translate-y-0.5",
          glowColors[glow],
        ],
        className,
      )}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
