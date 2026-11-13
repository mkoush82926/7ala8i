"use client";

// Small form building blocks shared by the wizard steps. They reuse the
// global .field-input / .field-label / .field-error styles and tokens.

import React, { useId } from "react";
import { cn } from "@/lib/utils";
import { headingTracking, useTranslation } from "@/hooks/use-translation";

export function StepHeader({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  const { isRTL, FFD } = useTranslation();
  return (
    <header className="mb-6">
      {eyebrow && (
        <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--accent-text)" }}>
          {eyebrow}
        </p>
      )}
      <h1
        tabIndex={-1}
        data-step-heading
        className="text-[26px] font-bold leading-tight outline-none sm:text-[30px]"
        style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "-0.01em"), color: "var(--text-primary)" }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      )}
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
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={cn("field-input", trailing ? "has-action" : null, inputClassName)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined}
          {...props}
        />
        {trailing}
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="field-error" role="alert">
          {error}
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
      <label htmlFor={id} className={hideLabel ? "sr-only" : "field-label"}>
        {label}
      </label>
      <select
        id={id}
        className="field-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Accessible on/off switch (role="switch"). */
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
        <label htmlFor={id} className="block text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={
          {
            background: checked ? "var(--cta-bg)" : "var(--border-primary)",
            "--tw-ring-color": "var(--focus-ring)",
          } as React.CSSProperties
        }
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-5 w-5 rounded-full shadow transition-transform",
            checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1",
          )}
          style={{ background: "var(--bg-primary)" }}
        />
      </button>
    </div>
  );
}

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
  const color = tone === "error" ? "var(--accent-rose)" : tone === "success" ? "var(--accent-mint)" : "var(--text-secondary)";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-[var(--radius-lg)] border px-4 py-3 text-[14px] leading-relaxed", className)}
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)", color }}
    >
      {children}
    </div>
  );
}

export const cardClass = "rounded-[var(--radius-lg)] border";
export const cardStyle: React.CSSProperties = { borderColor: "var(--border-subtle)", background: "var(--bg-surface)" };
