"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { buttonClasses } from "./recipes";

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
  const className = buttonClasses({ variant: primary ? "primary" : "secondary", size: "md" });
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
  sm: { wrap: "py-8 px-6 gap-3", icon: "size-12 rounded-xl", iconSize: 22, title: "text-title" },
  md: { wrap: "py-12 px-6 sm:px-10 gap-3", icon: "size-16 rounded-2xl", iconSize: 28, title: "text-h3" },
  lg: { wrap: "py-20 px-6 sm:py-24 sm:px-12 gap-4", icon: "size-20 rounded-2xl", iconSize: 32, title: "text-h2" },
} as const;

/**
 * Empty state (§5.13): always offers a next step. Art is an icon in a
 * brand-soft tile with the sand-stripe hatch (no illustrations).
 * `bare` = inline variant for use inside a panel (no border/background).
 */
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
  const iconNode = isComponent(icon)
    ? React.createElement(icon, { size: s.iconSize, "aria-hidden": true })
    : icon;

  return (
    <div
      className={cn(
        "fade-slide-up flex flex-col items-center justify-center text-center",
        s.wrap,
        !bare && "rounded-xl border border-dashed border-line bg-card",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "bg-hatch-ink mb-1 grid shrink-0 place-items-center",
          s.icon,
          tone === "error" ? "bg-danger-soft text-danger-text" : "bg-brand-soft text-brand-text",
        )}
      >
        {iconNode}
      </div>
      <Heading className={cn(s.title, "text-ink")}>{title}</Heading>
      {description && <div className="max-w-sm text-sm leading-6 text-ink-muted">{description}</div>}
      {children && <div className="mt-3 w-full max-w-sm">{children}</div>}
      {(action || secondaryAction) && (
        <div className="mt-3 flex w-full flex-col-reverse items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {secondaryAction && <ActionControl action={secondaryAction} primary={false} />}
          {action && <ActionControl action={action} primary />}
        </div>
      )}
    </div>
  );
}
