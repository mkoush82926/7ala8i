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
        "flex flex-col items-center justify-center py-24 px-8 text-center",
        "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-primary)]",
        "bg-[var(--bg-surface)]/30",
        className,
      )}
    >
      <div
        className="w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center mb-6"
        style={{
          background: "color-mix(in srgb, var(--text-muted) 10%, transparent)",
        }}
      >
        <Icon size={24} className="text-[var(--text-muted)]" />
      </div>
      <h3 className="text-[16px] text-[var(--text-secondary)] font-medium mb-3">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-[var(--text-tertiary)] font-light max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-8 btn btn-primary"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
