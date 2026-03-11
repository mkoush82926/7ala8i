"use client";

import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassButton } from "@/components/ui/glass-button";
import { useLeadsStore, type LeadStage } from "@/store/leads-store";
import { KanbanColumn } from "./kanban-column";
import { LeadCard, LeadCardOverlay } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { Plus, List, Kanban, Upload } from "lucide-react";
import type { Lead } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";

function useStages() {
  const t = useTranslation();
  return [
    {
      id: "new" as LeadStage,
      label: t.leads.newLead,
      color: "var(--accent-blue)",
    },
    {
      id: "contacted" as LeadStage,
      label: t.leads.contacted,
      color: "var(--accent-lavender)",
    },
    {
      id: "booked" as LeadStage,
      label: t.leads.bookedPackage,
      color: "var(--accent-amber)",
    },
    {
      id: "completed" as LeadStage,
      label: t.leads.completedStage,
      color: "var(--accent-mint)",
    },
    {
      id: "regular" as LeadStage,
      label: t.leads.loyal,
      color: "var(--accent-rose)",
    },
  ];
}

export function KanbanBoard() {
  const { leads, moveLead, selectLead, drawerOpen, setDrawerOpen, addLead } =
    useLeadsStore();

  const t = useTranslation();
  const stages = useStages();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const activeLead = useMemo(
    () => leads.find((l) => l.id === activeId) || null,
    [leads, activeId],
  );

  const leadsByStage = useMemo(() => {
    const map: Record<LeadStage, Lead[]> = {
      new: [],
      contacted: [],
      booked: [],
      completed: [],
      regular: [],
    };
    leads.forEach((lead) => {
      map[lead.stage].push(lead);
    });
    return map;
  }, [leads]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = active.id as string;
    const overId = over.id as string;

    // Check if hovering over a column
    const overStage = stages.find((s) => s.id === overId);
    if (overStage) {
      const activeLead = leads.find((l) => l.id === activeLeadId);
      if (activeLead && activeLead.stage !== overStage.id) {
        moveLead(activeLeadId, overStage.id);
      }
      return;
    }

    // Check if hovering over another lead
    const overLead = leads.find((l) => l.id === overId);
    if (overLead) {
      const activeLead = leads.find((l) => l.id === activeLeadId);
      if (activeLead && activeLead.stage !== overLead.stage) {
        moveLead(activeLeadId, overLead.stage);
      }
    }
  }

  function handleDragEnd(_event: DragEndEvent) {
    setActiveId(null);
  }

  function handleNewLead() {
    const id = `l-${Date.now()}`;
    addLead({
      id,
      name: "New Lead",
      phone: "",
      stage: "new",
      createdAt: new Date().toISOString().split("T")[0],
    });
    const newLead = {
      id,
      name: "New Lead",
      phone: "",
      stage: "new" as LeadStage,
      createdAt: new Date().toISOString().split("T")[0],
    };
    selectLead(newLead);
  }

  return (
    <div className="space-y-8 h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] tracking-tight text-[var(--text-primary)] font-light">
            {t.leads.crmPipeline}
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1 font-light">
            {leads.length} {t.leads.leadsAcross} {stages.length}{" "}
            {t.leads.stages}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-[var(--bg-surface)] rounded-[var(--radius-sm)] p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "relative px-2.5 py-1.5 rounded-[var(--radius-sm)] cursor-pointer z-10",
                view === "kanban"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)]",
              )}
            >
              {view === "kanban" && (
                <motion.div
                  layoutId="leads-view-pill"
                  className="absolute inset-0 bg-[var(--bg-surface-active)] rounded-[var(--radius-sm)] border border-[var(--border-primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Kanban size={14} className="relative z-10" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "relative px-2.5 py-1.5 rounded-[var(--radius-sm)] cursor-pointer z-10",
                view === "list"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)]",
              )}
            >
              {view === "list" && (
                <motion.div
                  layoutId="leads-view-pill"
                  className="absolute inset-0 bg-[var(--bg-surface-active)] rounded-[var(--radius-sm)] border border-[var(--border-primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <List size={14} className="relative z-10" />
            </button>
          </div>

          <GlassButton
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
          >
            {t.leads.importCsv}
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={handleNewLead}
          >
            {t.leads.addNewLead}
          </GlassButton>
        </div>
      </div>

      {/* Kanban View */}
      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage[stage.id]}
                onLeadClick={selectLead}
              />
            ))}
          </div>

          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List View */
        <LeadListView leads={leads} onLeadClick={selectLead} stages={stages} />
      )}

      {/* Lead Detail Drawer */}
      <LeadDrawer />
    </div>
  );
}

// ─── List View ───
function LeadListView({
  leads,
  onLeadClick,
  stages,
}: {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  stages: { id: LeadStage; label: string; color: string }[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { deleteLeads } = useLeadsStore();
  const t = useTranslation();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.length === leads.length ? [] : leads.map((l) => l.id),
    );
  };

  const stageColors: Record<string, string> = {
    new: "text-[var(--accent-blue)] bg-[var(--accent-blue-muted)]",
    contacted:
      "text-[var(--accent-lavender)] bg-[var(--accent-lavender-muted)]",
    booked: "text-[var(--accent-amber)] bg-[var(--accent-amber-muted)]",
    completed: "text-[var(--accent-mint)] bg-[var(--accent-mint-muted)]",
    regular: "text-[var(--accent-rose)] bg-[var(--accent-rose-muted)]",
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-primary)] bg-[var(--glass-bg)] backdrop-blur-[20px] overflow-hidden">
      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[var(--border-primary)] bg-[var(--bg-surface)]"
          >
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[12px] text-[var(--text-secondary)]">
                {selectedIds.length} {t.leads.selected}
              </span>
              <GlassButton
                variant="danger"
                size="sm"
                onClick={() => {
                  deleteLeads(selectedIds);
                  setSelectedIds([]);
                }}
              >
                {t.leads.deleteSelected}
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table header */}
      <div className="flex items-center border-b border-[var(--border-primary)] px-4 py-3">
        <div className="w-8 flex-shrink-0">
          <input
            type="checkbox"
            checked={selectedIds.length === leads.length && leads.length > 0}
            onChange={toggleAll}
            className="w-3.5 h-3.5 rounded border-[var(--border-primary)] bg-transparent accent-[var(--accent-mint)] cursor-pointer"
          />
        </div>
        <div className="flex-1 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider">
          {t.leads.name}
        </div>
        <div className="w-36 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider">
          {t.leads.phone}
        </div>
        <div className="w-28 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider">
          {t.leads.stage}
        </div>
        <div className="w-24 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider text-right">
          {t.leads.value}
        </div>
      </div>

      {/* Table body */}
      <div>
        {leads.map((lead, i) => (
          <motion.div
            key={lead.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              "flex items-center px-4 py-3 border-b border-[var(--border-primary)] last:border-b-0",
              "hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer",
              selectedIds.includes(lead.id) && "bg-[var(--bg-surface)]",
            )}
            onClick={() => onLeadClick(lead)}
          >
            <div
              className="w-8 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleSelect(lead.id);
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(lead.id)}
                onChange={() => toggleSelect(lead.id)}
                className="w-3.5 h-3.5 rounded border-[var(--border-primary)] bg-transparent accent-[var(--accent-mint)] cursor-pointer"
              />
            </div>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-medium text-[#0A0A0A]">
                  {lead.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-[var(--text-primary)] font-light truncate">
                  {lead.name}
                </p>
                {lead.notes && (
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {lead.notes}
                  </p>
                )}
              </div>
            </div>
            <div className="w-36 text-[12px] text-[var(--text-secondary)] font-light tabular-nums">
              {lead.phone}
            </div>
            <div className="w-28">
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize",
                  stageColors[lead.stage],
                )}
              >
                {stages.find((s) => s.id === lead.stage)?.label || lead.stage}
              </span>
            </div>
            <div className="w-24 text-right text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
              {lead.value ? `${lead.value} ${t.common.jod}` : "—"}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
