import React from "react";
import { cn } from "@/lib/utils";

/**
 * Small text pill for badges (Top rated, Deals, New, Verified, Quiet hours)
 * and statuses. Tones map to Ink & Brass tokens, so dark mode follows the theme.
 *
 * Colour is never the only signal: pass an `icon` (or rely on the label) for
 * statuses. Brass is reserved for promotional emphasis; the primary CTA owns
 * the solid brass fill.
 *
 *   <Pill tone="brass" icon={<BadgeCheck aria-hidden className="size-3.5" />}>{t.x.verified}</Pill>
 *   <Pill tone="danger" icon={<XCircle aria-hidden />}>{t.calendar.cancelled}</Pill>
 */
export const PILL_TONES = ["ink", "brass", "success", "danger", "neutral"] as const;
export type PillTone = (typeof PILL_TONES)[number];

const TONE_CLASS: Record<PillTone, string> = {
  ink: "bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent",
  brass: "bg-[var(--accent-blue-muted)] text-[var(--accent-text)] border-[var(--accent-brass)]",
  success: "bg-[var(--accent-mint-muted)] text-[var(--text-primary)] border-[var(--accent-mint)]",
  danger: "bg-[var(--accent-rose-muted)] text-[var(--accent-rose)] border-[var(--accent-rose)]",
  neutral: "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
};

const SIZE_CLASS = {
  sm: "h-5 px-2 text-[11px] gap-1",
  md: "h-6 px-2.5 text-xs gap-1.5",
} as const;

export interface PillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  tone?: PillTone;
  size?: keyof typeof SIZE_CLASS;
  /** Leading icon; mark it aria-hidden (the label carries the meaning). */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Pill({ tone = "neutral", size = "md", icon, className, children, ...rest }: PillProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center whitespace-nowrap rounded-full border font-semibold leading-none",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center [&>svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export default Pill;
