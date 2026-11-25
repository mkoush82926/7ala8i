"use client";

// Shared presentational pieces for the booking steps (no data access).

import React, { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { placeholderFill, placeholderInitials } from "@/components/ui/photo-frame";
import { headingTracking } from "@/hooks/use-translation";
import { STEPS } from "./booking-state";

// v2 semantic tokens (Deep Teal & Sand) for the few inline styles left.
export const C = {
  ink: "var(--color-ink)",
  paper: "var(--color-card)",
  cream: "var(--color-sunken)",
  border: "var(--color-line)",
  borderStrong: "var(--color-line-strong)",
  slate: "var(--color-ink-soft)",
  muted: "var(--color-ink-muted)",
  brand: "var(--color-brand)",
  brandText: "var(--color-brand-text)",
  cta: "var(--color-brand)",
  onAccent: "var(--color-on-brand)",
  red: "var(--color-danger-text)",
  redBg: "var(--color-danger-soft)",
};

/** Replaces {key} placeholders with React nodes (used for inline links). */
export function renderTemplate(template: string, nodes: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in nodes ? <React.Fragment key={i}>{nodes[m[1]]}</React.Fragment> : part;
  });
}

export function StepHeader({
  stepIndex, title, label, isRTL, FF, headingRef, onBack, backLabel, progressLabel, stepLabels,
}: {
  stepIndex: number; title: string; label: string; isRTL: boolean; FF: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack?: () => void; backLabel: string; progressLabel: string;
  /** Short step names for the stepper (Services · Barber · Time · Confirm). */
  stepLabels?: readonly string[];
}) {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label={backLabel} className="bk-icon-btn" style={{ marginTop: -14 }}>
            <BackIcon size={20} aria-hidden="true" />
          </button>
        )}
        <div
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-valuetext={label}
          className="bk-steps"
        >
          {STEPS.map((s, i) => (
            <span key={s} className="bk-step" data-state={i < stepIndex ? "done" : i === stepIndex ? "current" : "todo"}>
              <span className="bk-step-bar"><span /></span>
              {stepLabels?.[i] && <span className="bk-step-label" aria-hidden="true">{stepLabels[i]}</span>}
            </span>
          ))}
        </div>
      </div>
      <p className="text-meta" style={{ margin: "0 0 6px", color: C.muted }}>{label}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-h1"
        style={{ color: C.ink, fontFamily: FF, margin: 0, outline: "none", letterSpacing: headingTracking(isRTL, "-0.02em") }}
      >
        {title}
      </h1>
    </div>
  );
}

export function BottomBar({ children }: { children: React.ReactNode }) {
  return <div className="bk-bottom-bar">{children}</div>;
}

export function Totals({
  amount, meta, extra,
}: { amount: string; meta: string | null; extra?: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }} aria-live="polite">
      <p style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{amount}</p>
      {meta && <p className="text-meta" style={{ color: C.muted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</p>}
      {extra}
    </div>
  );
}

export function NextButton({
  onClick, disabled, label, isRTL, describedBy,
}: { onClick: () => void; disabled: boolean; label: string; isRTL: boolean; describedBy?: string }) {
  const Icon = isRTL ? ArrowLeft : ArrowRight;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="bk-cta bk-cta-pill" aria-describedby={describedBy}>
      {label}
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

export function InlineAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, textAlign: "start",
        padding: "12px 16px", borderRadius: 16, fontSize: 14, lineHeight: 1.5,
        background: tone === "error" ? C.redBg : "var(--color-brand-soft)",
        color: tone === "error" ? C.red : C.ink,
        border: `1px solid ${tone === "error" ? "transparent" : "var(--color-brand-soft-line)"}`,
      }}
    >
      <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function ChipsSkeleton({ count = 8, label }: { count?: number; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="bk-slot-grid">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="button" style={{ height: 44, width: "100%" }} />
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4, label, height = 120 }: { count?: number; label: string; height?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="bk-grid-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="card" style={{ height, width: "100%" }} />
      ))}
    </div>
  );
}

export function BarberAvatar({ name, url, size = 56, seed }: { name: string; url: string | null; size?: number; seed?: string }) {
  const [broken, setBroken] = useState(false);
  const fill = placeholderFill(seed ?? name);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        backgroundImage: `repeating-linear-gradient(135deg, ${fill.hatch} 0 2px, transparent 2px 12px), ${fill.bg}`,
        color: fill.fg, display: "inline-flex", alignItems: "center",
        justifyContent: "center", fontSize: Math.round(size * 0.36), fontWeight: 800,
      }}
    >
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : placeholderInitials(name)}
    </span>
  );
}

export function SelectedMark({ label }: { label: string }) {
  return (
    <span className="bk-selected-mark">
      <Check size={14} strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
