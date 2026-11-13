"use client";

// Shared presentational pieces for the booking steps (no data access).

import React, { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { headingTracking } from "@/hooks/use-translation";
import { STEPS } from "./booking-state";

export const C = {
  ink: "var(--text-primary)",
  paper: "var(--bg-primary)",
  cream: "var(--bg-secondary)",
  border: "var(--border-subtle)",
  borderStrong: "var(--border-primary)",
  slate: "var(--text-secondary)",
  muted: "var(--text-muted)",
  brass: "var(--accent-brass)",
  brassText: "var(--accent-text)",
  cta: "var(--accent-mint)",
  onAccent: "var(--on-accent)",
  red: "var(--accent-rose)",
  redBg: "var(--accent-rose-muted)",
};

/** Replaces {key} placeholders with React nodes (used for inline links). */
export function renderTemplate(template: string, nodes: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in nodes ? <React.Fragment key={i}>{nodes[m[1]]}</React.Fragment> : part;
  });
}

export function StepHeader({
  stepIndex, title, label, isRTL, FF, headingRef, onBack, backLabel, progressLabel,
}: {
  stepIndex: number; title: string; label: string; isRTL: boolean; FF: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack?: () => void; backLabel: string; progressLabel: string;
}) {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, marginBottom: 12 }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label={backLabel} className="bk-icon-btn">
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
          style={{ flex: 1, display: "flex", gap: 4 }}
        >
          {STEPS.map((s, i) => (
            <span
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 9999,
                background: i <= stepIndex ? C.cta : C.border,
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>
      </div>
      <p className="eyebrow" style={{ margin: "0 0 6px" }}>{label}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 900, lineHeight: 1.15,
          letterSpacing: headingTracking(isRTL, "0.014em"), color: C.ink, fontFamily: FF,
          margin: 0, outline: "none",
        }}
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
      <p style={{ fontSize: 20, fontWeight: 900, color: C.ink, margin: 0, whiteSpace: "nowrap" }}>{amount}</p>
      {meta && <p style={{ fontSize: 12, color: C.slate, margin: "2px 0 0" }}>{meta}</p>}
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
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

export function InlineAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, textAlign: "start",
        padding: "12px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
        background: tone === "error" ? C.redBg : C.cream,
        color: tone === "error" ? C.red : C.slate,
        border: `1px solid ${tone === "error" ? "transparent" : C.border}`,
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

export function BarberAvatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        background: C.ink, color: C.onAccent, display: "inline-flex", alignItems: "center",
        justifyContent: "center", fontSize: size * 0.38, fontWeight: 700,
      }}
    >
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : initial}
    </span>
  );
}

export function SelectedMark({ label }: { label: string }) {
  return (
    <span className="bk-selected-mark">
      <Check size={12} aria-hidden="true" /> {label}
    </span>
  );
}
