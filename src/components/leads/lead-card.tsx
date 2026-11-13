"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Phone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { initialsOf } from "@/components/calendar/calendar-utils";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  /** Drag is disabled for read-only viewers (barbers). */
  draggable?: boolean;
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
        "group relative min-h-[72px] cursor-pointer select-none rounded-[12px] border p-4 text-start",
        "border-[var(--border-subtle)] bg-[var(--bg-primary)] transition-[border-color,box-shadow] duration-150",
        "hover:border-[var(--border-primary)] hover:shadow-sm focus-ring",
        draggable && "touch-manipulation",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[12px] font-bold text-[var(--text-primary)]"
        >
          {initialsOf(lead.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold leading-snug text-[var(--text-primary)]">
            {lead.name}
          </span>
          {lead.notes && (
            <span className="mt-0.5 block truncate text-[12px] text-[var(--text-secondary)]">{lead.notes}</span>
          )}
        </span>
        {draggable && (
          <GripVertical
            size={16}
            aria-hidden="true"
            className="shrink-0 text-[var(--text-muted)] opacity-60 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>

      {(lead.phone || lead.value) && (
        <div className="mt-3 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-3 text-[12px]">
          {lead.phone && (
            <span className="flex items-center gap-1 font-medium text-[var(--text-secondary)]">
              <Phone size={11} aria-hidden="true" />
              <span className="sr-only">{t.leads.phone}</span>
              <span dir="ltr" className="tabular-nums">
                ···{lead.phone.slice(-4)}
              </span>
            </span>
          )}
          {!!lead.value && (
            <span className="flex items-center gap-1 font-bold text-[var(--text-primary)]">
              <Wallet size={11} aria-hidden="true" />
              <span className="tabular-nums">{formatCurrency(lead.value)}</span>
            </span>
          )}
          <span className="ms-auto text-[11px] text-[var(--text-muted)]">
            {formatDate(lead.createdAt, "dayMonth")}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Drag Overlay Card (the "lifted" version) ───
export function LeadCardOverlay({ lead }: { lead: Lead }) {
  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ scale: 0.97, rotate: 1.5 }}
      className="w-[min(284px,82vw)] rounded-[12px] border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[12px] font-bold text-[var(--bg-primary)]"
        >
          {initialsOf(lead.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-[var(--text-primary)]">{lead.name}</span>
          {lead.notes && (
            <span className="mt-0.5 block truncate text-[12px] text-[var(--text-secondary)]">{lead.notes}</span>
          )}
        </span>
      </div>
    </motion.div>
  );
}
