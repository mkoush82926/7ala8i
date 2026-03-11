"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-primary)]",
        "bg-[var(--bg-surface)]/30",
        className,
      )}
    >
      <div
        className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center mb-4"
        style={{
          background: "color-mix(in srgb, var(--text-muted) 10%, transparent)",
        }}
      >
        <Icon size={20} className="text-[var(--text-muted)]" />
      </div>
      <h3 className="text-[14px] text-[var(--text-secondary)] font-light mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-[12px] text-[var(--text-tertiary)] font-light max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 h-9 px-5 rounded-[var(--radius-md)] bg-[var(--accent-mint)] text-[#0A0A0A] text-[12px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
