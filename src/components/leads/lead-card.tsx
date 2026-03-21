"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Phone, DollarSign, ChevronRight } from "lucide-react";
import type { Lead } from "@/lib/types";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

/* ─────────────────────────────────────────────────────────────────
   Best Practices Applied:
   1. Good contrast — white card on #f7f9fb bg + border + hover-shadow
   2. Font sizes — 14px name (bold), 12px notes, 11px meta
   3. Spacing system — 4px base unit: 16px padding, 12px gap, 12px meta
   4. Fixed height — min-h defined so empty-content cards stay consistent
   5. Card interactions — default / hover / active / dragging states
   6. Content variation — graceful fallback when phone/value absent
───────────────────────────────────────────────────────────────── */
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
      style={{
        ...style,
        // Practice #1 — contrast card from background
        background: "#ffffff",
        border: "1px solid #eceef0",
        borderRadius: 12,
        padding: "16px",          // Practice #3 — 16px = 4×4 base unit
        cursor: "pointer",
        position: "relative",
        minHeight: 72,             // Practice #5 — fixed min-height
        // Practice #8 — card states
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging
          ? `${style.transform} scale(0.98)`
          : style.transform,
        boxShadow: isDragging
          ? "0 20px 40px rgba(0,0,0,0.14)"
          : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "border-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease",
      }}
      // Hover handled via onMouseEnter/Leave for inline-style compat
      onMouseEnter={(e) => {
        if (!isDragging) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#b8bcc4";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#eceef0";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
          (e.currentTarget as HTMLDivElement).style.transform = "";
        }
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(0.99)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
      }}
      onClick={onClick}
    >
      {/* Drag Handle — revealed on hover */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute", top: 12, right: 12,
          opacity: 0, transition: "opacity 0.2s",
          cursor: "grab",
        }}
        className="group-hover:opacity-100"
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
      >
        <GripVertical size={14} style={{ color: "#b8bcc4" }} />
      </div>

      {/* Lead Info */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Avatar */}
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#dde2f6", color: "#151b29",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Manrope, sans-serif",
            // Practice #2 — font size ≥ 12px for avatars
            fontSize: 12, fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            // Practice #2 — 14px name with bold weight
            fontSize: 14, fontWeight: 700, color: "#191c1e",
            fontFamily: "Manrope, sans-serif",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            margin: 0, lineHeight: 1.4,
          }}>
            {lead.name}
          </p>
          {lead.notes && (
            <p style={{
              // Practice #2 — notes 2px less than name
              fontSize: 12, color: "#76777d", marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              lineHeight: 1.5,
            }}>
              {lead.notes}
            </p>
          )}
        </div>

        <ChevronRight size={15} style={{ color: "#c6c6cc", flexShrink: 0 }} />
      </div>

      {/* Meta Row — Practice #6: content variation handled gracefully */}
      {(lead.phone || lead.value) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginTop: 12, paddingTop: 12,
          borderTop: "1px solid #f2f4f6",  // subtle separator
        }}>
          {lead.phone && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              // Practice #2 — meta 11px
              fontSize: 11, color: "#45464c", fontWeight: 500,
            }}>
              <Phone size={10} />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                ···{lead.phone.slice(-4)}
              </span>
            </div>
          )}
          {lead.value && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 700, color: "#191c1e",
            }}>
              <DollarSign size={10} />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {lead.value} JOD
              </span>
            </div>
          )}
          <span style={{
            fontSize: 10, color: "#c6c6cc",
            marginLeft: "auto",
          }}>
            {lead.createdAt}
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
      style={{
        borderRadius: 12, padding: 16,
        background: "#ffffff",
        border: "1px solid rgba(25,28,30,0.15)",
        boxShadow: "0 24px 48px rgba(0,0,0,0.14)",
        width: 284,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#191c1e", color: "#ffffff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#191c1e", margin: 0 }}>
            {lead.name}
          </p>
          {lead.notes && (
            <p style={{ fontSize: 12, color: "#76777d", marginTop: 2 }}>
              {lead.notes}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
