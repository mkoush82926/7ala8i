"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    icon?: React.ReactNode;
    loading?: boolean;
}

const variants = {
    primary:
        "bg-[var(--accent-mint)] text-[#0A0A0A] hover:bg-[var(--accent-mint)]/90 shadow-[0_0_20px_rgba(110,231,183,0.15)]",
    secondary:
        "bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-hover)]",
    ghost:
        "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]",
    danger:
        "bg-[var(--accent-rose-muted)] text-[var(--accent-rose)] border border-[var(--accent-rose)]/20 hover:bg-[var(--accent-rose)]/20",
};

const sizes = {
    sm: "h-7 px-3 text-xs gap-1.5 rounded-[var(--radius-sm)]",
    md: "h-9 px-4 text-sm gap-2 rounded-[var(--radius-md)]",
    lg: "h-11 px-6 text-sm gap-2.5 rounded-[var(--radius-md)]",
};

export function GlassButton({
    children,
    className,
    variant = "secondary",
    size = "md",
    icon,
    loading,
    disabled,
    ...props
}: GlassButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "inline-flex items-center justify-center font-medium transition-all duration-[var(--transition-fast)] cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-mint)]/50",
                "disabled:opacity-40 disabled:pointer-events-none",
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || loading}
            {...(props as React.ComponentProps<typeof motion.button>)}
        >
            {loading ? (
                <motion.div
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
            ) : (
                icon
            )}
            {children}
        </motion.button>
    );
}
