"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpolate, useTranslation } from "@/hooks/use-translation";
import type { Lead } from "@/lib/types";
import type { LeadStage } from "@/store/leads-store";
import { LeadCard } from "./lead-card";
import type { StageMeta } from "./stages";

interface KanbanColumnProps {
  stage: StageMeta;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  /** Shop admins only: drag + "add to this stage". */
  editable?: boolean;
  onAdd?: (stage: LeadStage) => void;
}

/**
 * One pipeline stage. Fixed-width (snaps on phones), drop target for cards,
 * and a non-interactive hint when empty.
 */
export function KanbanColumn({ stage, leads, onLeadClick, editable = false, onAdd }: KanbanColumnProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, disabled: !editable });
  const headingId = `kanban-col-${stage.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex w-[min(284px,82vw)] shrink-0 snap-start flex-col rounded-[12px] outline-2 outline-offset-2 transition-[outline-color] duration-150",
        isOver ? "outline outline-[var(--border-primary)]" : "outline-transparent",
      )}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: stage.color }} aria-hidden="true" />
          <h3 id={headingId} className="truncate text-[13px] font-bold text-[var(--text-primary)]">
            {stage.label}
            <span className="sr-only"> ({leads.length})</span>
          </h3>
          <span
            aria-hidden="true"
            className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[var(--text-primary)]"
          >
            {leads.length}
          </span>
        </div>
        {editable && onAdd && (
          <button
            type="button"
            onClick={() => onAdd(stage.id)}
            aria-label={interpolate(t.leads.addToStage, { stage: stage.label })}
            title={interpolate(t.leads.addToStage, { stage: stage.label })}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex min-h-[120px] flex-1 flex-col gap-2 py-1">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} draggable={editable} onClick={() => onLeadClick(lead)} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div
            className={cn(
              "rounded-[12px] border-2 border-dashed px-4 py-5 text-center text-[12px] font-semibold text-[var(--text-secondary)] transition-colors",
              isOver
                ? "border-[var(--border-primary)] bg-[var(--bg-secondary)]"
                : "border-[var(--border-subtle)]",
            )}
          >
            {editable ? t.leads.dropHere : t.common.noData}
          </div>
        )}
      </div>
    </section>
  );
}
