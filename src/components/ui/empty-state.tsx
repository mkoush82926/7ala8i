"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  /** Button action. Provide either onClick or href. */
  onClick?: () => void;
  /** Link target (use the hook's href() for locale-prefixed paths). */
  href?: string;
  /** Optional leading icon. */
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  /** Lucide icon component, or any node (e.g. a Material Symbols span). */
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Primary call to action. */
  action?: EmptyStateAction;
  /** Optional secondary (ghost) action. */
  secondaryAction?: EmptyStateAction;
  /** sm: inside cards/drawers · md (default): page sections · lg: full-page. */
  size?: "sm" | "md" | "lg";
  /** Error flavour: rose icon tint; pair with a retry action. */
  tone?: "neutral" | "error";
  /** Drop the dashed border/background (when already inside a card). */
  bare?: boolean;
  /** Heading level for the title (default 3). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
  children?: React.ReactNode;
}

function isComponent(icon: unknown): icon is LucideIcon {
  return (
    typeof icon === "function" ||
    (typeof icon === "object" && icon !== null && "$$typeof" in icon && "render" in icon)
  );
}

function ActionControl({ action, primary }: { action: EmptyStateAction; primary: boolean }) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon size={16} aria-hidden="true" />}
      <span>{action.label}</span>
    </>
  );
  const className = cn("btn text-[14px]", primary ? "btn-primary" : "btn-ghost");
  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

const sizeStyles = {
  sm: { wrap: "py-10 px-6", icon: "w-12 h-12 mb-4", iconSize: 22, title: "text-[15px]" },
  md: { wrap: "py-16 px-6 sm:px-10", icon: "w-16 h-16 mb-6", iconSize: 28, title: "text-[17px]" },
  lg: { wrap: "py-24 px-6 sm:py-32 sm:px-12", icon: "w-20 h-20 mb-8", iconSize: 32, title: "text-[18px]" },
} as const;

export function EmptyState({
  icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  tone = "neutral",
  bare = false,
  headingLevel = 3,
  className,
  children,
}: EmptyStateProps) {
  const s = sizeStyles[size];
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const iconNode = isComponent(icon) ? (
    React.createElement(icon, {
      size: s.iconSize,
      "aria-hidden": true,
      className: tone === "error" ? "text-[var(--accent-rose)]" : "text-[var(--text-muted)]",
    })
  ) : (
    icon
  );

  return (
    <div
      className={cn(
        "fade-slide-up flex flex-col items-center justify-center text-center",
        s.wrap,
        !bare && "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)]",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-full",
          s.icon,
          tone === "error" ? "bg-[var(--accent-rose-muted)]" : "bg-[var(--bg-secondary)]",
        )}
      >
        {iconNode}
      </div>
      <Heading className={cn(s.title, "font-semibold tracking-tight text-[var(--text-primary)]")}>{title}</Heading>
      {description && (
        <div className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-secondary)]">{description}</div>
      )}
      {children && <div className="mt-6 w-full max-w-sm">{children}</div>}
      {(action || secondaryAction) && (
        <div className="mt-7 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
          {secondaryAction && <ActionControl action={secondaryAction} primary={false} />}
          {action && <ActionControl action={action} primary />}
        </div>
      )}
    </div>
  );
}
