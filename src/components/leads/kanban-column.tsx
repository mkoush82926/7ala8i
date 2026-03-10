"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { LeadCard } from "./lead-card";
import type { Lead } from "@/lib/mock-data";
import type { LeadStage } from "@/store/leads-store";

interface KanbanColumnProps {
    stage: { id: LeadStage; label: string; color: string };
    leads: Lead[];
    onLeadClick: (lead: Lead) => void;
}

export function KanbanColumn({ stage, leads, onLeadClick }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.id,
    });

    return (
        <div
            className={cn(
                "flex-shrink-0 w-[280px] flex flex-col rounded-[var(--radius-lg)]",
                "bg-[var(--bg-surface)]/50 border border-[var(--border-primary)]",
                "transition-colors duration-200",
                isOver && "border-[var(--border-hover)] bg-[var(--bg-surface-hover)]/50"
            )}
        >
            {/* Column Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium">
                        {stage.label}
                    </span>
                </div>
                <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                        color: stage.color,
                        backgroundColor: `color-mix(in srgb, ${stage.color} 15%, transparent)`,
                    }}
                >
                    {leads.length}
                </span>
            </div>

            {/* Cards */}
            <div
                ref={setNodeRef}
                className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto"
            >
                <SortableContext
                    items={leads.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {leads.map((lead) => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            onClick={() => onLeadClick(lead)}
                        />
                    ))}
                </SortableContext>

                {leads.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[11px] text-[var(--text-muted)] font-light">
                        Drop leads here
                    </div>
                )}
            </div>
        </div>
    );
}
