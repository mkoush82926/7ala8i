"use client";

import React, { useState, useMemo, useRef } from "react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { Plus, List, Kanban, Upload } from "lucide-react";
import type { Lead } from "@/lib/types";
import { useTranslation, headingTracking } from "@/hooks/use-translation";

// ─── CSV parsing for "Import CSV" ───
// Minimal RFC-4180-ish parser: handles quoted cells and escaped quotes ("").
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseLeadsCsv(text: string): Lead[] {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.indexOf("name");
  const phoneIdx = header.findIndex((h) => h === "phone" || h === "contact");
  const valueIdx = header.indexOf("value");
  const notesIdx = header.indexOf("notes");
  const hasHeader = nameIdx !== -1 || phoneIdx !== -1;
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line, i) => {
      const cells = parseCsvLine(line);
      const name = (hasHeader ? cells[nameIdx] : cells[0]) || "";
      const phone = (hasHeader ? cells[phoneIdx] : cells[1]) || "";
      const rawValue = hasHeader && valueIdx !== -1 ? parseFloat(cells[valueIdx]) : NaN;
      const notes = hasHeader && notesIdx !== -1 ? cells[notesIdx] : "";

      return {
        id: `import-${Date.now()}-${i}`,
        name,
        phone,
        stage: "new" as LeadStage,
        value: Number.isFinite(rawValue) ? rawValue : null,
        notes: notes || null,
        createdAt: new Date().toISOString().split("T")[0],
      };
    })
    .filter((lead) => lead.name.trim().length > 0);
}

function useStages() {
  const { t } = useTranslation();
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
  const { leads, moveLead, selectLead, drawerOpen, setDrawerOpen, addLead, importLeads } =
    useLeadsStore();

  const { t, isRTL, FFD } = useTranslation();
  const stages = useStages();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseLeadsCsv(text);
      if (parsed.length === 0) {
        toast("error", isRTL ? "لم يتم العثور على عملاء محتملين صالحين في هذا الملف" : "No valid leads found in that CSV file.");
        return;
      }
      importLeads(parsed);
    };
    reader.onerror = () => {
      toast("error", isRTL ? "تعذرت قراءة الملف" : "Could not read that file.");
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-8 h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2
            className="text-4xl font-extrabold text-[#1c1611]"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.016em") }}
          >
            {t.leads.crmPipeline}
          </h2>
          <p className="text-[#5a5147] mt-2 font-medium text-sm">
            {leads.length} {t.leads.leadsAcross} {stages.length}{" "}
            {t.leads.stages}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-[12px] bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center justify-center px-4 min-w-[44px] min-h-[36px] rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                view === "kanban"
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Kanban size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center justify-center px-4 min-w-[44px] min-h-[36px] rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                view === "list"
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <List size={16} />
            </button>
          </div>

          <div className="h-8 w-px bg-[var(--border-primary)] hidden md:block mx-1" />

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFileChange}
            className="hidden"
          />
          <button className="btn btn-secondary" onClick={handleImportClick}>
            <Upload size={15} />
            {t.leads.importCsv}
          </button>
          <button
            onClick={handleNewLead}
            className="btn btn-primary"
          >
            <Plus size={15} />
            {t.leads.addNewLead}
          </button>
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { deleteLeads } = useLeadsStore();
  const { t, isRTL } = useTranslation();

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
    <div className="rounded-xl border border-[#ede3cd] bg-white overflow-hidden">
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
                onClick={() => setConfirmDeleteOpen(true)}
              >
                {t.leads.deleteSelected}
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table header */}
      <div className="flex items-center border-b border-[#ede3cd] px-6 py-3 bg-[#f7f1e4]">
        <div className="w-8 flex-shrink-0">
          <input
            type="checkbox"
            checked={selectedIds.length === leads.length && leads.length > 0}
            onChange={toggleAll}
            className="w-3.5 h-3.5 rounded-[8px] cursor-pointer"
          />
        </div>
        <div className="flex-1 text-[11px] text-[#5a5147] font-bold uppercase tracking-wider">
          {t.leads.name}
        </div>
        <div className="w-36 text-[11px] text-[#5a5147] font-bold uppercase tracking-wider">
          {t.leads.phone}
        </div>
        <div className="w-28 text-[11px] text-[#5a5147] font-bold uppercase tracking-wider">
          {t.leads.stage}
        </div>
        <div className="w-24 text-[11px] text-[#5a5147] font-bold uppercase tracking-wider text-end">
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
              "flex items-center px-6 py-4 border-b border-[#ede3cd] last:border-b-0",
              "hover:bg-[#f7f1e4] transition-colors cursor-pointer",
              selectedIds.includes(lead.id) && "bg-[#f7f1e4]",
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
                className="w-3.5 h-3.5 rounded-[8px] cursor-pointer"
              />
            </div>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: "#f7f1e4", color: "#1c1611", fontFamily: "var(--font-intervar), sans-serif" }}
              >
                {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1c1611] truncate">
                  {lead.name}
                </p>
                {lead.notes && (
                  <p className="text-xs text-[#5a5147] truncate">
                    {lead.notes}
                  </p>
                )}
              </div>
            </div>
            <div className="w-36 text-sm text-[#5a5147] font-medium tabular-nums">
              {lead.phone}
            </div>
            <div className="w-28">
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize",
                  stageColors[lead.stage],
                )}
              >
                {stages.find((s) => s.id === lead.stage)?.label || lead.stage}
              </span>
            </div>
            <div className="w-24 text-end text-sm text-[#1c1611] font-bold tabular-nums">
              {lead.value ? `${lead.value} ${t.common.jod}` : "—"}
            </div>
          </motion.div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          deleteLeads(selectedIds);
          setSelectedIds([]);
        }}
        title={
          isRTL
            ? `حذف ${selectedIds.length} من العملاء المحتملين؟`
            : `Delete ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"}?`
        }
        description={
          isRTL
            ? "لا يمكن التراجع عن هذا الإجراء."
            : "This action cannot be undone."
        }
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        destructive
      />
    </div>
  );
}
