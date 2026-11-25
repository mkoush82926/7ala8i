"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control and tab lists (§5.6) with one keyboard model:
 * arrow keys move (mirrored in RTL), Home/End jump, selection follows focus.
 *
 *   // Value picker (Day/Week/Month, List/Map, 7d/30d/90d) — radio semantics
 *   <SegmentedControl ariaLabel={t.calendar.view} value={view} onChange={setView}
 *     options={[{ value: "day", label: t.calendar.day }, { value: "week", label: t.calendar.week }]} />
 *
 *   // Tabs that switch panels — tab semantics; give each panel
 *   // id={`${idPrefix}-panel-${value}`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${value}`}
 *   <SegmentedControl semantics="tabs" idPrefix="explore" variant="pill" … />
 *
 * Variants: "segmented" (sunken track, white selected thumb) · "underline"
 * (section tabs, ink indicator) · "pill" (category chips, ink selected).
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Leading icon (decorative). */
  icon?: React.ReactNode;
  /** Accessible name when the label is icon-only. */
  ariaLabel?: string;
  disabled?: boolean;
  /** Trailing count etc. */
  badge?: React.ReactNode;
}

export type SegmentedVariant = "segmented" | "underline" | "pill";

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group / tab list. */
  ariaLabel: string;
  variant?: SegmentedVariant;
  /** "radio" (default) for value pickers, "tabs" when it switches panels. */
  semantics?: "radio" | "tabs";
  /** Required for tabs semantics: ids become `${idPrefix}-tab-${value}` / `-panel-`. */
  idPrefix?: string;
  size?: "sm" | "md";
  /** Stretch segments to fill the width (segmented variant). */
  fullWidth?: boolean;
  className?: string;
}

const LIST: Record<SegmentedVariant, string> = {
  segmented: "inline-flex rounded-full bg-sunken p-1",
  underline: "no-scrollbar flex gap-6 overflow-x-auto border-b border-line",
  pill: "no-scrollbar flex gap-2 overflow-x-auto",
};

const ITEM: Record<SegmentedVariant, string> = {
  segmented:
    "rounded-full px-4 font-semibold text-ink-muted hover:text-ink data-[selected=true]:bg-card data-[selected=true]:text-ink data-[selected=true]:shadow-xs",
  underline:
    "relative h-12 shrink-0 px-0 text-[15px] font-medium text-ink-muted hover:text-ink data-[selected=true]:font-semibold data-[selected=true]:text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink after:opacity-0 after:transition-opacity data-[selected=true]:after:opacity-100",
  pill:
    "h-10 shrink-0 rounded-full border border-line bg-card px-4 font-semibold text-ink-soft hover:border-ink-soft data-[selected=true]:border-inverse data-[selected=true]:bg-inverse data-[selected=true]:text-on-inverse",
};

const SIZE: Record<"sm" | "md", string> = {
  sm: "h-8 text-[13px]",
  md: "h-9 text-sm",
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = "segmented",
  semantics = "radio",
  idPrefix,
  size = "md",
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const isTabs = semantics === "tabs";
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const hasSelection = options.some((o) => o.value === value);

  const move = (from: number, delta: number | "home" | "end") => {
    if (enabled.length === 0) return;
    let target: number;
    if (delta === "home") target = enabled[0];
    else if (delta === "end") target = enabled[enabled.length - 1];
    else {
      const pos = enabled.indexOf(from);
      target = enabled[(pos + delta + enabled.length) % enabled.length];
    }
    onChange(options[target].value);
    refs.current[target]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const prev = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === next || e.key === "ArrowDown") move(index, 1);
    else if (e.key === prev || e.key === "ArrowUp") move(index, -1);
    else if (e.key === "Home") move(index, "home");
    else if (e.key === "End") move(index, "end");
    else return;
    e.preventDefault();
  };

  return (
    <div
      role={isTabs ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      data-variant={variant}
      className={cn(LIST[variant], fullWidth && variant === "segmented" && "flex w-full", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role={isTabs ? "tab" : "radio"}
            id={isTabs && idPrefix ? `${idPrefix}-tab-${option.value}` : undefined}
            aria-controls={isTabs && idPrefix ? `${idPrefix}-panel-${option.value}` : undefined}
            aria-selected={isTabs ? selected : undefined}
            aria-checked={isTabs ? undefined : selected}
            aria-label={option.ariaLabel}
            data-selected={selected}
            disabled={option.disabled}
            tabIndex={selected || (!hasSelection && index === enabled[0]) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap select-none [&_svg]:size-4",
              "transition-[background-color,color,border-color,box-shadow] duration-150 ease-standard motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              "disabled:pointer-events-none disabled:opacity-45",
              variant !== "underline" && SIZE[size],
              ITEM[variant],
              fullWidth && variant === "segmented" && "flex-1",
            )}
          >
            {option.icon ? <span aria-hidden="true" className="inline-flex">{option.icon}</span> : null}
            {option.label}
            {option.badge}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
