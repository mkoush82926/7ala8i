"use client";

// Small form building blocks shared by the wizard steps, built on the
// Design System v2 recipes (labels, inputs, switch, callouts, cards).

import React, { useId } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  errorTextClasses,
  focusRing,
  helperClasses,
  inputClasses,
  labelClasses,
  selectClasses,
} from "@/components/ui/recipes";

export function StepHeader({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="mb-2 text-sm font-semibold text-brand-text">{eyebrow}</p>}
      <h1 tabIndex={-1} data-step-heading className="text-h1 text-ink outline-none">
        {title}
      </h1>
      {subtitle && <p className="text-body mt-2 text-ink-muted">{subtitle}</p>}
    </header>
  );
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  inputClassName?: string;
  trailing?: React.ReactNode;
}

export function TextField({ label, hint, error, className, inputClassName, trailing, ...props }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={inputClasses({ className: cn(trailing ? "pe-12" : null, inputClassName) })}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined}
          {...props}
        />
        {trailing}
      </div>
      {hint && !error && (
        <p id={hintId} className={helperClasses}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className={errorTextClasses} role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: React.ReactNode;
  error?: string | null;
  hideLabel?: boolean;
}

export function SelectField({ label, error, className, hideLabel, children, ...props }: SelectFieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : labelClasses}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={selectClasses()}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-ink-muted"
        />
      </div>
      {error && (
        <p id={errId} className={errorTextClasses} role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Accessible on/off switch (role="switch"), §5.2 switch recipe. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[15px] font-semibold text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? "on" : "off"}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full bg-line-strong transition-colors duration-150 ease-standard data-[state=on]:bg-brand motion-reduce:transition-none",
          focusRing,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-xs transition-transform duration-150 ease-standard motion-reduce:transition-none",
            checked && "translate-x-5 rtl:-translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

const NOTICE = {
  info: { box: "bg-sunken text-ink-soft", icon: Info, iconClass: "text-ink-muted" },
  error: { box: "bg-danger-soft text-danger-text", icon: AlertCircle, iconClass: "" },
  success: { box: "bg-success-soft text-success-text", icon: CheckCircle2, iconClass: "" },
} as const;

/** Inline status/alert box. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const n = NOTICE[tone];
  const Icon = n.icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-[22px]", n.box, className)}
    >
      <Icon size={18} aria-hidden="true" className={cn("mt-0.5 shrink-0", n.iconClass)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** v2 card surface for wizard blocks (white, hairline border, 16px radius). */
export const cardClass = "rounded-xl border border-line bg-card";
/** Kept for call sites that spread it; v2 styling lives in `cardClass`. */
export const cardStyle: React.CSSProperties = {};
