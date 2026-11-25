import React from "react";
import { cn } from "@/lib/utils";
import { cardClasses, type CardElevation } from "./recipes";

/**
 * Surfaces (§5.4). Server-safe.
 *
 *   <Card elevation="card" interactive>…</Card>              // marketplace card
 *   <Panel title="Up next" action={<Button variant="ghost" size="sm">…</Button>}>…</Panel>
 *   <StatCard label="Bookings today" value="18" icon={<CalendarDays />}
 *             delta={{ value: "+12%", direction: "up", caption: "vs last week" }} />
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** flat (dashboard, default) · card (marketplace resting) · raised · float */
  elevation?: CardElevation;
  /** Lift to shadow-raised on hover / focus-within. */
  interactive?: boolean;
  /** Padding preset (default "md": p-4 → lg:p-5). */
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "section" | "article" | "li" | "aside";
}

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4 lg:p-5",
  lg: "p-5 lg:p-6",
} as const;

export function Card({ elevation = "flat", interactive = false, padding = "md", as: Tag = "div", className, ...rest }: CardProps) {
  return <Tag className={cardClasses({ elevation, interactive, className: cn(PADDING[padding], className) })} {...rest} />;
}

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  /** Supporting line under the title. */
  description?: React.ReactNode;
  /** Header end slot (ghost sm button, link, menu). */
  action?: React.ReactNode;
  headingLevel?: 2 | 3 | 4;
  elevation?: CardElevation;
  /** Drop body padding (tables, edge-to-edge lists). */
  flush?: boolean;
  bodyClassName?: string;
  as?: "section" | "div" | "article";
}

/** Dashboard / settings panel: header (title + action) over a padded body. */
export function Panel({
  title,
  description,
  action,
  headingLevel = 2,
  elevation = "flat",
  flush = false,
  bodyClassName,
  as: Tag = "section",
  className,
  children,
  ...rest
}: PanelProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const hasHeader = Boolean(title || action);
  return (
    <Tag className={cardClasses({ elevation, className: cn("overflow-hidden", className) })} {...rest}>
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 lg:px-5">
          <div className="min-w-0">
            {title && <Heading className="text-h3 truncate text-ink">{title}</Heading>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-4 lg:p-5", bodyClassName)}>{children}</div>
    </Tag>
  );
}

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: React.ReactNode;
  /** Pre-formatted value (use formatJOD / formatLocalizedNumber). */
  value: React.ReactNode;
  /** 16px icon shown in a brand-soft tile before the label (decorative). */
  icon?: React.ReactNode;
  delta?: {
    /** Pre-formatted change, e.g. "+12%". */
    value: React.ReactNode;
    direction: "up" | "down" | "flat";
    /** e.g. "vs last week". */
    caption?: React.ReactNode;
    /** Set when "down" is good (e.g. no-shows): flips the colour. */
    invert?: boolean;
  };
  /** Optional 32px-high sparkline / footer. */
  footer?: React.ReactNode;
}

/** KPI tile. The value itself is never coloured; only the delta row is. */
export function StatCard({ label, value, icon, delta, footer, className, ...rest }: StatCardProps) {
  const good = delta ? (delta.direction === "up") !== Boolean(delta.invert) : false;
  const deltaTone =
    !delta || delta.direction === "flat" ? "text-ink-muted" : good ? "text-success-text" : "text-danger-text";
  return (
    <div className={cardClasses({ className: cn("flex flex-col gap-2 p-4 lg:p-5", className) })} {...rest}>
      <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        {icon && (
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text [&_svg]:size-4">
            {icon}
          </span>
        )}
        <span className="min-w-0 leading-snug line-clamp-2">{label}</span>
      </p>
      <p className="text-stat text-ink">
        <bdi>{value}</bdi>
      </p>
      {delta && (
        <p className={cn("flex flex-wrap items-center gap-x-1.5 text-xs font-semibold", deltaTone)}>
          {delta.direction !== "flat" && (
            <span aria-hidden="true">{delta.direction === "up" ? "▲" : "▼"}</span>
          )}
          <bdi className="tabular-nums">{delta.value}</bdi>
          {delta.caption && <span className="font-normal text-ink-muted">{delta.caption}</span>}
        </p>
      )}
      {footer}
    </div>
  );
}

export default Card;
