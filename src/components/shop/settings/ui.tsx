"use client";

import React, { useId } from "react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-base font-bold text-[var(--text-primary)]">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
  multiline = false,
  dir,
  maxLength,
  type = "text",
  placeholder,
  disabled,
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: string;
  error?: string | null;
  multiline?: boolean;
  dir?: "ltr" | "rtl" | "auto";
  maxLength?: number;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
}) {
  const id = useId();
  const describedBy = [hint && !error ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    dir,
    maxLength,
    placeholder,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onBlur,
  } as const;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {multiline ? (
        <textarea {...common} className="field-input min-h-[96px] resize-y" onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} inputMode={inputMode} className="field-input" onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
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
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={`${id}-l`} className="text-sm font-bold text-[var(--text-primary)]">
          {label}
        </p>
        {description && (
          <p id={`${id}-d`} className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "focus-ring relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-[var(--cta-bg)]" : "bg-[var(--border-primary)]",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
