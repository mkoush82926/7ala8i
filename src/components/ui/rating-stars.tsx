"use client";

import React, { useRef, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rating stars (§5.16). Amber fills are for icons only and are always paired
 * with the number; the group exposes one accessible label.
 *
 *   <RatingStars rating={4.6} label={t.x.ratedOutOf.replace("{rating}", "4.6")} />
 *   <RatingStars rating={4.9} value="4.9" count="(312)" size="sm" />       // stars + number
 *   <RatingStars rating={4.9} value="4.9" count="(312)" compact />          // ★ 4.9 (312) for meta lines
 *   <RatingInput value={v} onChange={setV} label={t.x.yourRating}
 *                getStarLabel={(n) => t.x.starsLabel.replace("{n}", String(n))} />
 *
 * Half stars are drawn with a clip that mirrors in RTL. Digits: pass
 * `value` / `count` already localised (formatLocalizedNumber).
 */
export type RatingStarsSize = "xs" | "sm" | "md" | "lg";

const SIZE: Record<RatingStarsSize, string> = {
  xs: "size-3.5", // meta lines
  sm: "size-4", // cards, review rows
  md: "size-5", // summary block
  lg: "size-6",
};

const TEXT: Record<RatingStarsSize, string> = {
  xs: "text-[13px]",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export interface RatingStarsProps {
  /** 0 – max; rounded to the nearest half star. */
  rating: number;
  max?: number;
  size?: RatingStarsSize;
  /**
   * Accessible label for the whole group ("Rated 4.9 out of 5"). When set,
   * the group is role="img" and the visible number/count are hidden from
   * assistive tech so nothing is read twice. Without it the stars are
   * decorative (aria-hidden) — make sure the number is visible.
   */
  label?: string;
  /** Visible number, already localised (e.g. "4.9"). */
  value?: React.ReactNode;
  /** Visible count, already localised (e.g. "(312)" or "312 reviews"). */
  count?: React.ReactNode;
  /** One star + value + count: the compact meta-line form. */
  compact?: boolean;
  className?: string;
}

function StarIcon({ fill, sizeClass }: { fill: "full" | "half" | "empty"; sizeClass: string }) {
  const empty = "fill-sunken-2 text-sunken-2 dark:fill-line dark:text-line";
  const full = "fill-accent text-accent";
  if (fill === "half") {
    return (
      <span className={cn("relative inline-block shrink-0", sizeClass)}>
        <Star aria-hidden="true" strokeWidth={1.5} className={cn("absolute inset-0 size-full", empty)} />
        <Star
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn("absolute inset-0 size-full [clip-path:inset(0_50%_0_0)] rtl:[clip-path:inset(0_0_0_50%)]", full)}
        />
      </span>
    );
  }
  return <Star aria-hidden="true" strokeWidth={1.5} className={cn("shrink-0", sizeClass, fill === "full" ? full : empty)} />;
}

export function RatingStars({
  rating,
  max = 5,
  size = "sm",
  label,
  value,
  count,
  compact = false,
  className,
}: RatingStarsProps) {
  const safe = Number.isFinite(rating) ? Math.min(Math.max(rating, 0), max) : 0;
  const halves = Math.round(safe * 2);
  const sizeClass = SIZE[size];
  const textHidden = label ? true : undefined;

  const stars = compact ? (
    <StarIcon fill={safe > 0 ? "full" : "empty"} sizeClass={sizeClass} />
  ) : (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const fill = halves >= (i + 1) * 2 ? "full" : halves === i * 2 + 1 ? "half" : "empty";
        return <StarIcon key={i} fill={fill} sizeClass={sizeClass} />;
      })}
    </span>
  );

  return (
    <span
      className={cn("inline-flex items-center gap-1", TEXT[size], className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label || value != null ? undefined : true}
    >
      <span aria-hidden="true" className="inline-flex items-center">
        {stars}
      </span>
      {value != null && (
        <span aria-hidden={textHidden} className="font-semibold tabular-nums text-ink">
          <bdi>{value}</bdi>
        </span>
      )}
      {count != null && (
        <span aria-hidden={textHidden} className="tabular-nums text-ink-muted">
          <bdi>{count}</bdi>
        </span>
      )}
    </span>
  );
}

export interface RatingInputProps {
  /** Current rating (0 = none). */
  value: number;
  onChange: (value: number) => void;
  max?: number;
  /** Group label ("Your rating"). */
  label: string;
  /** Per-star accessible name, e.g. (n) => `${n} stars`. */
  getStarLabel: (n: number) => string;
  disabled?: boolean;
  className?: string;
}

/** Review-form input: 44px star buttons, hover preview, arrow keys (RTL-aware). */
export function RatingInput({ value, onChange, max = 5, label, getStarLabel, disabled = false, className }: RatingInputProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = preview ?? value;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const inc = e.key === "ArrowUp" || e.key === (rtl ? "ArrowLeft" : "ArrowRight");
    const dec = e.key === "ArrowDown" || e.key === (rtl ? "ArrowRight" : "ArrowLeft");
    let next: number | null = null;
    if (inc) next = Math.min(max, (value || 0) + 1);
    else if (dec) next = Math.max(1, (value || 1) - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = max;
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setPreview(null)}
      className={cn("inline-flex items-center", className)}
    >
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const on = n <= shown;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            disabled={disabled}
            aria-pressed={n === value}
            aria-label={getStarLabel(n)}
            tabIndex={n === (value || 1) ? 0 : -1}
            onClick={() => onChange(n)}
            onMouseEnter={() => setPreview(n)}
            className={cn(
              "grid size-11 cursor-pointer place-items-center rounded-full transition-transform duration-150 ease-standard",
              "hover:scale-110 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              "disabled:pointer-events-none disabled:opacity-45",
            )}
          >
            <Star
              aria-hidden="true"
              strokeWidth={1.5}
              className={cn(
                "size-7",
                on ? "fill-accent text-accent" : "fill-transparent text-line-strong",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export default RatingStars;
