"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import { GripVertical, Phone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";
import type { LeadStage } from "@/store/leads-store";
import { useTranslation } from "@/hooks/use-translation";
import { Pill } from "@/components/ui/pill";
import { initialsOf } from "@/components/calendar/calendar-utils";
import { STAGE_COLORS } from "./stages";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  /** Drag is disabled for read-only viewers (barbers). */
  draggable?: boolean;
}

/** Initials avatar tinted with the lead's stage hue (text stays ink for AA). */
function LeadAvatar({ lead, size = "md" }: { lead: Lead; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-ink ring-1 ring-inset ring-line",
        size === "lg" ? "size-12 text-sm" : "size-10 text-[13px]",
      )}
      style={{ background: `color-mix(in srgb, ${STAGE_COLORS[lead.stage]} 16%, var(--color-card))` }}
    >
      {initialsOf(lead.name)}
    </span>
  );
}

/** Stage badge: neutral pill + stage-coloured dot (colour is never the only signal). */
export function StagePill({ stage, label, className }: { stage: LeadStage; label: string; className?: string }) {
  return (
    <Pill
      tone="neutral"
      size="sm"
      className={className}
      icon={<span className="block size-1.5 rounded-full" style={{ background: STAGE_COLORS[stage] }} />}
    >
      {label}
    </Pill>
  );
}

/**
 * Pipeline card. The whole card is the drag source (pointer: 5px move,
 * touch: long-press, keyboard: Space) and Enter opens the lead.
 */
export function LeadCard({ lead, onClick, draggable = true }: LeadCardProps) {
  const { t, formatCurrency, formatDate } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled: !draggable,
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !isDragging) {
      e.preventDefault();
      onClick();
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={onClick}
      aria-label={lead.name}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative cursor-pointer select-none rounded-xl border border-line bg-card p-3.5 text-start shadow-xs",
        "transition-[border-color,box-shadow] duration-150 ease-standard motion-reduce:transition-none",
        "hover:border-line-strong/60 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        draggable && "touch-manipulation",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-3">
        <LeadAvatar lead={lead} />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{lead.name}</span>
          {lead.notes ? (
            <span className="mt-0.5 line-clamp-2 text-[13px] leading-[18px] text-ink-muted">{lead.notes}</span>
          ) : (
            <span className="mt-0.5 block text-[13px] tabular-nums text-ink-muted">{formatDate(lead.createdAt, "dayMonth")}</span>
          )}
        </span>
        {draggable && (
          <GripVertical
            size={16}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-ink-disabled transition-colors group-hover:text-ink-muted"
          />
        )}
      </div>

      {(lead.phone || lead.value) && (
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-xs">
          {lead.phone && (
            <span className="flex items-center gap-1 font-medium text-ink-soft">
              <Phone size={12} aria-hidden="true" className="text-ink-muted" />
              <span className="sr-only">{t.leads.phone}</span>
              <span dir="ltr" className="tabular-nums">
                ···{lead.phone.slice(-4)}
              </span>
            </span>
          )}
          {!!lead.value && (
            <span className="flex items-center gap-1 font-semibold text-ink">
              <Wallet size={12} aria-hidden="true" className="text-ink-muted" />
              <span className="tabular-nums">{formatCurrency(lead.value)}</span>
            </span>
          )}
          {lead.notes && <span className="ms-auto text-[11px] tabular-nums text-ink-muted">{formatDate(lead.createdAt, "dayMonth")}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Drag Overlay Card (the "lifted" version) ───
export function LeadCardOverlay({ lead }: { lead: Lead }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={reduce ? { scale: 1, rotate: 0 } : { scale: 1.02, rotate: 1.5 }}
      transition={reduce ? { duration: 0 } : { duration: 0.15 }}
      className="w-[min(288px,82vw)] cursor-grabbing rounded-xl border border-line bg-card p-3.5 shadow-float ring-2 ring-brand"
    >
      <div className="flex items-start gap-3">
        <LeadAvatar lead={lead} />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{lead.name}</span>
          {lead.notes && <span className="mt-0.5 block truncate text-[13px] text-ink-muted">{lead.notes}</span>}
        </span>
      </div>
    </motion.div>
  );
}

export { LeadAvatar };
