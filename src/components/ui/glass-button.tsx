"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { buttonClasses, spinnerClasses, type ButtonVariant } from "./recipes";

/**
 * Legacy button API kept for compatibility; renders the v2 <Button/> recipe.
 * New code: import { Button } from "@/components/ui/button".
 * Variant map: primary → primary · secondary → secondary · ghost → ghost
 * · danger → destructive-soft. (The old framer hover scale is replaced by
 * the shared press feedback.)
 */
interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
}

const VARIANT_MAP: Record<NonNullable<GlassButtonProps["variant"]>, ButtonVariant> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive-soft",
};

export function GlassButton({
  children,
  className,
  variant = "secondary",
  size = "md",
  icon,
  loading,
  disabled,
  type = "button",
  ...props
}: GlassButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant: VARIANT_MAP[variant], size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span aria-hidden="true" className={spinnerClasses} /> : icon}
      {children}
    </button>
  );
}
