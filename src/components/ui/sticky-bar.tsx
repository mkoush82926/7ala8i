import React from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom bar for mobile booking / summary / actions (§5.8).
 * One per screen; hidden from `lg` (where the sticky side card takes over)
 * unless `hideAt` is "never". Give the page content `pb-28 lg:pb-0`.
 * Marks itself with [data-sticky-bar] so toasts lift above it.
 *
 *   <StickyBar label={t.primitives.bookingSummaryLabel}
 *              title="45.000 JD" subtitle="2 services · 60 min"
 *              action={<Button size="xl" className="flex-1 max-w-[220px]">Continue</Button>} />
 */
export interface StickyBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Accessible name of the region (required: it is a landmark). */
  label: string;
  /** Line 1 — e.g. the total (tabular). */
  title?: React.ReactNode;
  /** Line 2 — meta, truncates. */
  subtitle?: React.ReactNode;
  /** The CTA (a primary Button / Link). */
  action?: React.ReactNode;
  /** Breakpoint from which the bar hides (default "lg"). */
  hideAt?: "md" | "lg" | "never";
  /** Inner width (default "3xl"). */
  maxWidth?: "sm" | "3xl" | "7xl";
  /** Replace the title/subtitle block with custom content. */
  children?: React.ReactNode;
  innerClassName?: string;
}

const HIDE = { md: "md:hidden", lg: "lg:hidden", never: "" } as const;
const MAX = { sm: "max-w-screen-sm", "3xl": "max-w-3xl", "7xl": "max-w-7xl" } as const;

export function StickyBar({
  label,
  title,
  subtitle,
  action,
  hideAt = "lg",
  maxWidth = "3xl",
  children,
  className,
  innerClassName,
  ...rest
}: StickyBarProps) {
  return (
    <div
      role="region"
      aria-label={label}
      data-sticky-bar=""
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 shadow-bar backdrop-blur supports-[backdrop-filter]:bg-card/85",
        "px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]",
        HIDE[hideAt],
        className,
      )}
      {...rest}
    >
      <div className={cn("mx-auto flex items-center gap-4", MAX[maxWidth], innerClassName)}>
        {children ?? (
          <div className="min-w-0 flex-1">
            {title != null && <p className="truncate text-sm font-semibold tabular-nums text-ink">{title}</p>}
            {subtitle != null && <p className="text-meta truncate text-ink-muted">{subtitle}</p>}
          </div>
        )}
        {action}
      </div>
    </div>
  );
}

export default StickyBar;
