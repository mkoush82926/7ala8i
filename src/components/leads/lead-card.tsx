"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GripVertical, Phone, DollarSign } from "lucide-react";
import type { Lead } from "@/lib/types";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-[var(--radius-md)] p-3 cursor-pointer",
        "bg-[var(--glass-bg)] border border-[var(--border-primary)]",
        "hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-hover)]",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
        "transition-all duration-200",
        isDragging && "opacity-40 scale-[0.98] shadow-[var(--shadow-lg)]",
      )}
      onClick={onClick}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="text-[var(--text-muted)]" />
      </div>

      {/* Lead Info */}
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[9px] font-medium text-[#0A0A0A]">
            {lead.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[var(--text-primary)] font-light truncate leading-tight">
            {lead.name}
          </p>
          {lead.notes && (
            <p className="text-[10px] text-[var(--text-muted)] font-light truncate mt-0.5">
              {lead.notes}
            </p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-2.5">
        {lead.phone && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
            <Phone size={10} />
            <span className="tabular-nums">{lead.phone.slice(-4)}</span>
          </div>
        )}
        {lead.value && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--accent-mint)]">
            <DollarSign size={10} />
            <span className="font-medium tabular-nums">{lead.value}</span>
          </div>
        )}
        <span className="text-[9px] text-[var(--text-muted)] ms-">
          {lead.createdAt}
        </span>
      </div>
    </div>
  );
}

// ─── Drag Overlay Card (the "lifted" version) ───
export function LeadCardOverlay({ lead }: { lead: Lead }) {
  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ scale: 0.98, rotate: 1.5 }}
      className={cn(
        "rounded-[var(--radius-md)] p-3",
        "bg-[var(--glass-bg-elevated)] border border-[var(--border-hover)]",
        "shadow-[var(--shadow-lg)]",
        "backdrop-blur-[20px]",
        "w-[264px]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[9px] font-medium text-[#0A0A0A]">
            {lead.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[var(--text-primary)] font-light truncate leading-tight">
            {lead.name}
          </p>
          {lead.notes && (
            <p className="text-[10px] text-[var(--text-muted)] font-light truncate mt-0.5">
              {lead.notes}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2.5">
        {lead.phone && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
            <Phone size={10} />
            <span className="tabular-nums">{lead.phone.slice(-4)}</span>
          </div>
        )}
        {lead.value && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--accent-mint)]">
            <DollarSign size={10} />
            <span className="font-medium tabular-nums">{lead.value}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
