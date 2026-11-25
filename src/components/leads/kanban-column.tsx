"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpolate, useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
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
 * One pipeline stage: a sunken lane (like the queue board) with white cards.
 * Fixed-width (snaps on phones), drop target for cards, and a
 * non-interactive hint when empty.
 */
export function KanbanColumn({ stage, leads, onLeadClick, editable = false, onAdd }: KanbanColumnProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, disabled: !editable });
  const headingId = `kanban-col-${stage.id}`;

  return (
    <section
      aria-labelledby={headingId}
      data-over={isOver || undefined}
      className={cn(
        "flex w-[min(288px,82vw)] shrink-0 snap-start flex-col rounded-xl bg-sunken p-2.5 ring-inset transition-[box-shadow,background-color] duration-150 motion-reduce:transition-none",
        isOver ? "bg-brand-soft/60 ring-2 ring-brand" : "ring-0",
      )}
    >
      {/* Stage accent + header */}
      <span aria-hidden="true" className="mx-1 mb-2.5 block h-1 rounded-full" style={{ background: stage.color }} />
      <div className="mb-2.5 flex items-center justify-between gap-2 ps-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h3 id={headingId} className="truncate text-sm font-semibold text-ink">
            {stage.label}
            <span className="sr-only"> ({leads.length})</span>
          </h3>
          <span aria-hidden="true" className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-soft shadow-xs">
            {leads.length}
          </span>
        </div>
        {editable && onAdd && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onAdd(stage.id)}
            aria-label={interpolate(t.leads.addToStage, { stage: stage.label })}
            title={interpolate(t.leads.addToStage, { stage: stage.label })}
            className="hover:bg-card"
          >
            <Plus aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex min-h-[140px] flex-1 flex-col gap-2">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} draggable={editable} onClick={() => onLeadClick(lead)} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div
            className={cn(
              "grid flex-1 place-items-center rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13px] font-medium text-ink-muted transition-colors duration-150 motion-reduce:transition-none",
              isOver ? "border-brand bg-card text-brand-text" : "border-line-strong/40",
            )}
          >
            {editable ? t.leads.dropHere : t.common.noData}
          </div>
        )}
      </div>
    </section>
  );
}
