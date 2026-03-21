"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LeadCard } from "./lead-card";
import type { Lead } from "@/lib/types";
import type { LeadStage } from "@/store/leads-store";

interface KanbanColumnProps {
  stage: { id: LeadStage; label: string; color: string };
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

/* ─────────────────────────────────────────────────────────────────
   Best Practices Applied:
   1. Column contrast — subtle bg #f7f9fb to distinguish from white cards
   3. Spacing — 8px gaps between cards (2× base unit)
   5. Column width fixed at 284px for consistent grid
   6. Grid-based — consistent column widths across all stages
   8. Drop zone "active" state via isOver ring highlight
───────────────────────────────────────────────────────────────── */
export function KanbanColumn({ stage, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <div
      style={{
        flexShrink: 0,
        width: 284,           // Practice #6 — fixed column width
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        // Practice #8 — isOver state
        outline: isOver ? "2px solid rgba(25,28,30,0.18)" : "2px solid transparent",
        outlineOffset: 2,
        transition: "outline-color 0.15s ease",
      }}
    >
      {/* Column Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, padding: "0 4px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Stage colour dot */}
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: stage.color, flexShrink: 0,
          }} />
          <span style={{
            // Practice #2 — 13px column label
            fontSize: 13, fontWeight: 700, color: "#191c1e",
            fontFamily: "Manrope, sans-serif",
          }}>
            {stage.label}
          </span>
        </div>
        {/* Count badge */}
        <span style={{
          padding: "2px 8px", borderRadius: 20,
          background: "#eceef0",
          // Practice #2 — 11px count
          fontSize: 11, fontWeight: 800, color: "#45464c",
        }}>
          {leads.length}
        </span>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 8,             // Practice #3 — 8px = 2× base unit
          minHeight: 120,
          padding: "4px 0",
        }}
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

        {/* Practice #4 — empty state that communicates what happens */}
        {leads.length === 0 && (
          <button
            style={{
              width: "100%",
              padding: "20px 16px",
              border: "2px dashed #dde0e4",
              borderRadius: 12,
              color: "#76777d",
              fontSize: 12, fontWeight: 600,
              background: "transparent",
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#f2f4f6";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#b8bcc4";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#dde0e4";
            }}
          >
            + Drop here to add
          </button>
        )}
      </div>
    </div>
  );
}
