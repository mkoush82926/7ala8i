import React from "react";
import { cn } from "@/lib/utils";
import { filterChipClasses } from "./recipes";

/**
 * Small text pill for badges (Top rated, Deals, New, Verified, Quiet hours)
 * and statuses (§5.5). v2 pills are fill-only (no border).
 *
 * Colour is never the only signal: pass an `icon` (or rely on the label) for
 * statuses. Teal is for selected/info; amber `accent` is for "Top rated" /
 * "Popular" emphasis; the primary CTA owns the solid teal fill.
 *
 *   <Pill tone="brand" icon={<BadgeCheck aria-hidden />}>{t.x.verified}</Pill>
 *   <Pill tone="accent" icon={<Star aria-hidden />}>{t.x.topRated}</Pill>
 *   <Pill tone="danger" icon={<XCircle aria-hidden />}>{t.calendar.cancelled}</Pill>
 *   <Pill tone="on-photo">1.2 km</Pill>                      // on top of images
 *   <FilterChip pressed={open} onClick={toggle}>Open now</FilterChip>
 *
 * `brass` is kept as an alias of `brand` for existing call sites.
 */
export const PILL_TONES = [
  "ink",
  "brand",
  "brass",
  "accent",
  "success",
  "warning",
  "danger",
  "neutral",
  "on-photo",
] as const;
export type PillTone = (typeof PILL_TONES)[number];

const TONE_CLASS: Record<PillTone, string> = {
  ink: "bg-inverse text-on-inverse",
  brand: "bg-brand-soft text-brand-pressed",
  brass: "bg-brand-soft text-brand-pressed",
  accent: "bg-accent-soft text-warning-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  neutral: "bg-sunken text-ink-soft",
  // Photos don't theme: fixed white chip with ink text in both modes.
  "on-photo": "bg-white/92 text-[#0F172A] shadow-xs backdrop-blur-sm",
};

const SIZE_CLASS = {
  sm: "h-5 px-2 text-[11px] gap-1",
  md: "h-6 px-2.5 text-xs gap-1",
  lg: "h-9 px-3.5 text-sm font-medium gap-1.5",
} as const;

export type PillSize = keyof typeof SIZE_CLASS;

export interface PillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  tone?: PillTone;
  size?: PillSize;
  /** Leading icon; mark it aria-hidden (the label carries the meaning). */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Pill({ tone = "neutral", size = "md", icon, className, children, ...rest }: PillProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center whitespace-nowrap rounded-full font-semibold leading-none",
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

export interface FilterChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Selected state → aria-pressed; selected chips render ink-filled. */
  pressed?: boolean;
  icon?: React.ReactNode;
  /** Optional trailing count/badge or chevron. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

/** Toggle chip for filter bars (§5.5): h-9 outline pill; selected = ink. */
export function FilterChip({ pressed, icon, trailing, className, type = "button", children, ...rest }: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed === undefined ? undefined : pressed}
      className={cn(filterChipClasses, className)}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
      {trailing}
    </button>
  );
}

export default Pill;
