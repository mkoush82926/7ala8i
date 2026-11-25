"use client";

import React, { useId, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Copies text, falling back to a hidden textarea when the Clipboard API is blocked. */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export const BUTTON =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const BUTTON_SECONDARY = cn(
  BUTTON,
  "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
);
export const BUTTON_PRIMARY = cn(BUTTON, "border-transparent bg-[var(--cta-bg)] text-[var(--cta-fg)] hover:opacity-90");

export function CopyButton({ value, label, copiedMessage, className }: {
  value: string;
  label: string;
  copiedMessage?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cn(BUTTON_SECONDARY, className)}
      aria-label={label}
      onClick={async () => {
        const ok = await copyText(value);
        if (ok) {
          setCopied(true);
          toast.success(copiedMessage ?? t.links.share.copied);
          setTimeout(() => setCopied(false), 1800);
        } else {
          toast.error(t.links.share.copyFailed);
        }
      }}
    >
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span>{copied ? t.links.share.copiedShort : t.links.share.copy}</span>
    </button>
  );
}

/** Read-only value (URL or code snippet) with a copy button. */
export function CopyField({ label, value, hint, multiline = false, copyLabel }: {
  label: string;
  value: string;
  hint?: string;
  multiline?: boolean;
  copyLabel?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const field =
    "w-full min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 text-sm text-[var(--text-primary)] focus-ring";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-[var(--text-primary)]">{label}</label>
      <div className={cn("flex gap-2", multiline ? "flex-col" : "flex-col sm:flex-row")}>
        {multiline ? (
          <textarea
            id={id}
            readOnly
            dir="ltr"
            value={value}
            rows={Math.min(8, value.split("\n").length + 1)}
            aria-describedby={hint ? hintId : undefined}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(field, "resize-none py-2 font-mono text-xs leading-relaxed")}
          />
        ) : (
          <input
            id={id}
            readOnly
            dir="ltr"
            value={value}
            aria-describedby={hint ? hintId : undefined}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(field, "min-h-11 flex-1 text-start")}
          />
        )}
        <CopyButton value={value} label={copyLabel ?? label} className={multiline ? "self-start" : "shrink-0"} />
      </div>
      {hint && <p id={hintId} className="m-0 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
