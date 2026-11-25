"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AlertTriangle, Kanban, List, Lock, Plus, Trash2, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { checkboxClasses } from "@/components/ui/recipes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useLeadsStore, type LeadDraft, type LeadStage } from "@/store/leads-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LEAD_STAGES, type Lead } from "@/lib/types";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { errorText } from "@/components/calendar/error-text";
import { KanbanColumn } from "./kanban-column";
import { useStages, type StageMeta } from "./stages";
import { LeadAvatar, LeadCardOverlay, StagePill } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { parseLeadsCsv, MAX_IMPORT_ROWS, MAX_IMPORT_BYTES } from "./lead-csv";

const isStage = (id: UniqueIdentifier | undefined | null): id is LeadStage =>
  typeof id === "string" && (LEAD_STAGES as readonly string[]).includes(id);

/** Drag preview: where the active card currently sits (local only, never persisted mid-drag). */
type DragPreview = { id: string; stage: LeadStage; overId: string | null } | null;

export function KanbanBoard() {
  const leads = useLeadsStore((s) => s.leads);
  const loading = useLeadsStore((s) => s.loading);
  const loaded = useLeadsStore((s) => s.loaded);
  const error = useLeadsStore((s) => s.error);
  const fetchLeads = useLeadsStore((s) => s.fetchLeads);
  const moveLead = useLeadsStore((s) => s.moveLead);
  const selectLead = useLeadsStore((s) => s.selectLead);
  const openCreate = useLeadsStore((s) => s.openCreate);
  const importLeads = useLeadsStore((s) => s.importLeads);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const role = useWorkspaceStore((s) => s.role);
  const canEdit = role === "shop_admin";

  const { t, formatNumber, formatCurrency } = useTranslation();
  const stages = useStages();
  const stageLabel = (id: LeadStage) => stages.find((s) => s.id === id)?.label ?? id;

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [preview, setPreview] = useState<DragPreview>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deep link from the topbar search / notifications: /leads?lead=<id> opens
  // that lead once loaded. The param is stripped once consumed, so choosing the
  // same result again changes the URL and re-opens the drawer.
  const linkedLeadId = useSearchParams().get("lead");
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!linkedLeadId || !loaded || loading) return;
    const lead = leads.find((l) => l.id === linkedLeadId);
    if (lead) selectLead(lead);
    else toast.error(t.common.linkNotFound);
    router.replace(pathname, { scroll: false });
    // Run once per link; leads/t only matter at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedLeadId, loaded, loading]);

  // Fallback fetch when the board mounts before (or without) the auth provider's prefetch.
  useEffect(() => {
    if (shopId && !loaded && !loading) fetchLeads();
  }, [shopId, loaded, loading, fetchLeads]);

  // Mouse: 5px move. Touch: long-press so horizontal swipes keep scrolling the board.
  // Keyboard: Space to pick up, arrows to move, Space to drop, Escape to cancel.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const leadsByStage = useMemo(() => {
    const map: Record<LeadStage, Lead[]> = { new: [], contacted: [], booked: [], completed: [], regular: [] };
    for (const lead of leads) {
      const stage = preview && lead.id === preview.id ? preview.stage : lead.stage;
      (map[stage] ?? map.new).push(lead);
    }
    return map;
  }, [leads, preview]);

  const activeLead = preview ? leads.find((l) => l.id === preview.id) ?? null : null;
  const nameOf = (id: UniqueIdentifier) => leads.find((l) => l.id === id)?.name ?? "";
  const stageOfTarget = (overId: UniqueIdentifier | undefined | null): LeadStage | null => {
    if (overId == null) return null;
    if (isStage(overId)) return overId;
    const overLead = leads.find((l) => l.id === overId);
    if (!overLead) return null;
    return preview && overLead.id === preview.id ? preview.stage : overLead.stage;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => interpolate(t.leads.dragStart, { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) => {
      const stage = stageOfTarget(over?.id);
      return stage ? interpolate(t.leads.dragOver, { name: nameOf(active.id), stage: stageLabel(stage) }) : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const stage = stageOfTarget(over?.id);
      return stage
        ? interpolate(t.leads.dragEnd, { name: nameOf(active.id), stage: stageLabel(stage) })
        : interpolate(t.leads.dragCancel, { name: nameOf(active.id) });
    },
    onDragCancel: ({ active }) => interpolate(t.leads.dragCancel, { name: nameOf(active.id) }),
  };

  function handleDragStart({ active }: DragStartEvent) {
    const lead = leads.find((l) => l.id === active.id);
    if (lead) setPreview({ id: lead.id, stage: lead.stage, overId: null });
  }

  // Only local preview state changes while dragging — no DB writes per column crossed.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!preview || !over) return;
    const stage = stageOfTarget(over.id);
    if (!stage) return;
    if (stage !== preview.stage || over.id !== preview.overId) {
      setPreview({ id: String(active.id), stage, overId: String(over.id) });
    }
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    const current = preview;
    setPreview(null);
    if (!current || !over) return;
    const original = leads.find((l) => l.id === active.id);
    const stage = stageOfTarget(over.id);
    if (!original || !stage) return;

    // Final order of the target column (as rendered), then move the card onto the hovered card.
    const column = leadsByStage[stage].map((l) => l.id);
    if (!column.includes(original.id)) column.push(original.id);
    let ordered = column;
    if (!isStage(over.id) && over.id !== original.id) {
      const from = column.indexOf(original.id);
      const to = column.indexOf(String(over.id));
      if (from !== -1 && to !== -1) ordered = arrayMove(column, from, to);
    }
    const index = ordered.indexOf(original.id);
    const sameSpot =
      stage === original.stage &&
      leads.filter((l) => l.stage === stage).findIndex((l) => l.id === original.id) === index;
    if (sameSpot) return;

    const result = await moveLead(original.id, stage, index);
    if (!result.ok) toast.error(errorText(t, result.code));
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error(interpolate(t.leads.importTooLarge, { max: MAX_IMPORT_ROWS }));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const parsed: LeadDraft[] = parseLeadsCsv(String(reader.result ?? ""));
      if (parsed.length === 0) {
        toast.error(t.leads.importEmpty);
        return;
      }
      if (parsed.length > MAX_IMPORT_ROWS) {
        toast.error(interpolate(t.leads.importTooLarge, { max: MAX_IMPORT_ROWS }));
        return;
      }
      setImporting(true);
      const result = await importLeads(parsed);
      setImporting(false);
      if (result.ok) toast.success(interpolate(t.leads.imported, { count: result.count }));
      else toast.error(errorText(t, result.code));
    };
    reader.onerror = () => toast.error(t.leads.importReadError);
    reader.readAsText(file);
  }

  const showSkeleton = (loading || (!loaded && !error)) && leads.length === 0;
  const pipelineValue = leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

  return (
    <div className="h-full space-y-5 pb-24 lg:space-y-6 lg:pb-8">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-h2 text-ink">{t.leads.crmPipeline}</h1>
          <p className="mt-1 text-meta text-ink-muted">
            <span className="font-semibold tabular-nums text-ink-soft">{formatNumber(leads.length)}</span>{" "}
            {leads.length === 1 ? t.leads.leadAcross : t.leads.leadsAcross} {formatNumber(stages.length)} {t.leads.stages}
            {pipelineValue > 0 && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-ink-disabled">·</span>
                <span className="font-semibold tabular-nums text-ink-soft">{formatCurrency(pipelineValue)}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel={t.calendar.viewMode}
            value={view}
            onChange={setView}
            options={[
              { value: "kanban", label: <Kanban aria-hidden="true" />, ariaLabel: t.leads.boardView },
              { value: "list", label: <List aria-hidden="true" />, ariaLabel: t.leads.listView },
            ]}
          />

          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFileChange}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleImportClick}
                loading={importing}
                aria-label={t.leads.importCsv}
                icon={<Upload aria-hidden="true" />}
                className="h-11 sm:h-9"
              >
                <span className="hidden sm:inline">{importing ? t.leads.importing : t.leads.importCsv}</span>
              </Button>
              <Button onClick={() => openCreate("new")} size="sm" icon={<Plus aria-hidden="true" />} className="h-11 flex-1 sm:h-9 sm:flex-none">
                {t.leads.addNewLead}
              </Button>
            </>
          )}
        </div>
      </header>

      {!canEdit && role !== null && (
        <p className="flex items-start gap-2.5 rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink-soft">
          <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
          {t.leads.readOnly}
        </p>
      )}

      {showSkeleton ? (
        <SkeletonGroup className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[min(288px,82vw)] shrink-0 space-y-2 rounded-xl bg-sunken p-2.5">
              <Skeleton className="mb-3 ms-1.5 h-4 w-24 bg-card" />
              <Skeleton variant="card" className="h-[92px] w-full rounded-xl bg-card" />
              <Skeleton variant="card" className="h-[92px] w-full rounded-xl bg-card" />
            </div>
          ))}
        </SkeletonGroup>
      ) : error && leads.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          tone="error"
          title={t.leads.loadError}
          description={errorText(t, error)}
          action={{ label: t.common.retry, onClick: () => fetchLeads() }}
        />
      ) : view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setPreview(null)}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t.leads.dragInstructions },
          }}
        >
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage[stage.id]}
                onLeadClick={selectLead}
                editable={canEdit}
                onAdd={openCreate}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <LeadListView
          leads={leads}
          stages={stages}
          canEdit={canEdit}
          onLeadClick={selectLead}
          onCreate={() => openCreate("new")}
        />
      )}

      <LeadDrawer />
    </div>
  );
}

// ─── List View (table from md, stacked cards on phones) ───
function LeadListView({
  leads,
  stages,
  canEdit,
  onLeadClick,
  onCreate,
}: {
  leads: Lead[];
  stages: StageMeta[];
  canEdit: boolean;
  onLeadClick: (lead: Lead) => void;
  onCreate: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteLeads = useLeadsStore((s) => s.deleteLeads);
  const { t, formatCurrency } = useTranslation();

  // Drop selections for leads that no longer exist (deleted elsewhere / refetched).
  const visibleSelected = selectedIds.filter((id) => leads.some((l) => l.id === id));
  const allSelected = leads.length > 0 && visibleSelected.length === leads.length;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const toggleAll = () => setSelectedIds(allSelected ? [] : leads.map((l) => l.id));
  const stageLabel = (id: LeadStage) => stages.find((s) => s.id === id)?.label ?? id;

  const confirmBulkDelete = async () => {
    const ids = visibleSelected;
    const result = await deleteLeads(ids);
    if (!result.ok) throw new Error(errorText(t, result.code));
    setSelectedIds([]);
    toast.success(interpolate(t.leads.bulkDeleted, { count: ids.length }));
  };

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t.leads.emptyTitle}
        description={t.leads.emptyDescription}
        action={canEdit ? { label: t.leads.addNewLead, onClick: onCreate, icon: Plus } : undefined}
      />
    );
  }

  const checkbox = (lead: Lead) =>
    canEdit && (
      <input
        type="checkbox"
        checked={visibleSelected.includes(lead.id)}
        onChange={() => toggleSelect(lead.id)}
        aria-label={interpolate(t.leads.selectLead, { name: lead.name })}
        className={cn(checkboxClasses, "shrink-0 cursor-pointer")}
      />
    );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      {/* Bulk actions */}
      {canEdit && visibleSelected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-soft-line bg-brand-soft px-4 py-2.5">
          <span className="text-sm font-semibold text-brand-pressed" aria-live="polite">
            <span className="tabular-nums">{visibleSelected.length}</span> {t.leads.selected}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              {t.leads.clearSelection}
            </Button>
            <Button variant="destructive" size="sm" icon={<Trash2 aria-hidden="true" />} onClick={() => setConfirmDeleteOpen(true)}>
              {t.leads.deleteSelected}
            </Button>
          </div>
        </div>
      )}

      {/* Table (md+) */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="bg-sunken/60">
            <th scope="col" className="h-10 w-12 px-4 text-start">
              {canEdit && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={t.leads.selectAll}
                  className={cn(checkboxClasses, "cursor-pointer")}
                />
              )}
            </th>
            {[t.leads.name, t.leads.phone, t.leads.stage].map((h) => (
              <th key={h} scope="col" className="h-10 px-4 text-start text-xs font-semibold text-ink-muted">
                {h}
              </th>
            ))}
            <th scope="col" className="h-10 px-4 text-end text-xs font-semibold text-ink-muted">
              {t.leads.value}
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className={cn(
                "h-14 border-t border-line transition-colors duration-150 hover:bg-sunken/60 motion-reduce:transition-none",
                visibleSelected.includes(lead.id) && "bg-brand-soft/40 hover:bg-brand-soft/60",
              )}
            >
              <td className="px-4">{checkbox(lead)}</td>
              <td className="px-4 py-1.5">
                <button
                  type="button"
                  onClick={() => onLeadClick(lead)}
                  aria-haspopup="dialog"
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <LeadAvatar lead={lead} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{lead.name}</span>
                    {lead.notes && <span className="block max-w-[320px] truncate text-[13px] text-ink-muted">{lead.notes}</span>}
                  </span>
                </button>
              </td>
              <td className="px-4 font-medium tabular-nums text-ink-soft">
                <span dir="ltr">{lead.phone || "—"}</span>
              </td>
              <td className="px-4">
                <StagePill stage={lead.stage} label={stageLabel(lead.stage)} />
              </td>
              <td className="px-4 text-end font-semibold tabular-nums text-ink">{lead.value ? formatCurrency(lead.value) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* List rows (phones) */}
      <ul className="divide-y divide-line md:hidden">
        {leads.map((lead) => (
          <li
            key={lead.id}
            className={cn("flex items-center gap-3 px-4 py-3 active:bg-sunken", visibleSelected.includes(lead.id) && "bg-brand-soft/40")}
          >
            {canEdit && checkbox(lead)}
            <button
              type="button"
              onClick={() => onLeadClick(lead)}
              aria-haspopup="dialog"
              className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <LeadAvatar lead={lead} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold text-ink">{lead.name}</span>
                  {!!lead.value && <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(lead.value)}</span>}
                </span>
                <span className="mt-1 flex items-center justify-between gap-2">
                  <span dir="ltr" className="truncate text-[13px] tabular-nums text-ink-muted">
                    {lead.phone || "—"}
                  </span>
                  <StagePill stage={lead.stage} label={stageLabel(lead.stage)} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
        title={interpolate(t.leads.bulkDeleteTitle, { count: visibleSelected.length })}
        description={t.leads.deleteDescription}
        confirmLabel={t.common.delete}
        destructive
      />
    </div>
  );
}
