"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Search, Clock, GripVertical, Pencil, Trash2, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { useServices, type ServiceItem, type ServiceInputData } from "@/hooks/use-services";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ServiceSchema } from "@/lib/validations";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const ICONS = ["✂️", "💈", "🧔", "💇", "🪒", "🧴", "💆", "🎨", "✨", "👑", "🧖", "💅"];

type FormField = "name" | "name_ar" | "duration" | "price";
type FormErrors = Partial<Record<FormField, string>>;

const iconBtn =
  "inline-flex size-11 lg:size-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-brass)] cursor-pointer";

export default function ServicesPage() {
  const { t, isRTL, FF, formatCurrency, formatDuration } = useTranslation();
  const svc = t.services;
  const {
    services, loading, error, currency, refetch,
    addService, updateService, removeService, toggleActive, reorderServices,
  } = useServices();
  const role = useWorkspaceStore((s) => s.role);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const isAdmin = hydrated && role === "shop_admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServiceItem | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("✂️");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const searchId = useId();

  const query = searchTerm.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? services.filter(
            (s) => s.name.toLowerCase().includes(query) || (s.name_ar ?? "").toLowerCase().includes(query),
          )
        : services,
    [services, query],
  );
  // Drag-to-reorder only makes sense on the full, unfiltered list.
  const canReorder = isAdmin && !query && services.length > 1;

  const displayName = (s: ServiceItem) => (isRTL && s.name_ar ? s.name_ar : s.name);

  function resetForm(s: ServiceItem | null) {
    setEditingService(s);
    setName(s?.name ?? "");
    setNameAr(s?.name_ar ?? "");
    setDuration(String(s?.duration ?? 30));
    setPrice(s ? String(s.price) : "");
    setIcon(s?.icon || "✂️");
    setErrors({});
  }

  function openAdd() {
    resetForm(null);
    setShowForm(true);
  }

  function openEdit(s: ServiceItem) {
    resetForm(s);
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
  }

  function validate(): ServiceInputData | null {
    const parsed = ServiceSchema.safeParse({
      name,
      name_ar: nameAr.trim() || null,
      duration: duration.trim() === "" ? Number.NaN : Number(duration),
      price: price.trim() === "" ? Number.NaN : Number(price),
    });
    if (parsed.success) {
      setErrors({});
      return {
        name: parsed.data.name,
        name_ar: parsed.data.name_ar ?? null,
        duration: parsed.data.duration,
        price: parsed.data.price,
        icon,
      };
    }
    const next: FormErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as FormField;
      if (next[field]) continue;
      next[field] =
        field === "name" ? svc.errName
        : field === "name_ar" ? svc.errNameAr
        : field === "duration" ? svc.errDuration
        : svc.errPrice;
    }
    setErrors(next);
    // Move focus to the first invalid field.
    const first = (["name", "name_ar", "duration", "price"] as FormField[]).find((f) => next[f]);
    if (first) document.getElementById(`${formId}-${first}`)?.focus();
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const data = validate();
    if (!data) return;
    setSaving(true);
    const ok = editingService ? await updateService(editingService.id, data) : await addService(data);
    setSaving(false);
    // Keep the dialog (and the typed values) open when the save failed.
    if (ok) {
      setShowForm(false);
      setEditingService(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const result = await removeService(pendingDelete.id);
    if (!result) throw new Error(svc.deleteFailed);
  }

  // ─── Reorder (pointer, touch and keyboard) ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => services.map((s) => s.id), [services]);
  const nameById = (id: string | number) => {
    const s = services.find((x) => x.id === id);
    return s ? displayName(s) : "";
  };
  const position = (id: string | number) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => interpolate(svc.reorderPicked, { name: nameById(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? interpolate(svc.reorderMoved, { name: nameById(active.id), position: position(over.id), total: ids.length })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? interpolate(svc.reorderDropped, { name: nameById(active.id), position: position(over.id), total: ids.length })
        : undefined,
    onDragCancel: () => svc.reorderCancelled,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    void reorderServices(arrayMove(ids, from, to));
  }

  const fieldError = (f: FormField) =>
    errors[f] ? (
      <p id={`${formId}-${f}-error`} className="field-error" role="alert">
        {errors[f]}
      </p>
    ) : null;
  const fieldA11y = (f: FormField) => ({
    id: `${formId}-${f}`,
    "aria-invalid": errors[f] ? true : undefined,
    "aria-describedby": errors[f] ? `${formId}-${f}-error` : undefined,
  });

  const rows = filtered.map((service) => (
    <ServiceRow
      key={service.id}
      service={service}
      sortable={canReorder}
      isAdmin={isAdmin}
      title={displayName(service)}
      subtitle={service.name_ar ? (isRTL ? service.name : service.name_ar) : null}
      meta={`${formatDuration(service.duration)} · ${formatCurrency(service.price, currency)}`}
      fontFamily={FF}
      labels={{
        reorder: interpolate(svc.reorderHandle, { name: displayName(service) }),
        edit: `${svc.editService}: ${displayName(service)}`,
        remove: `${svc.deleteService}: ${displayName(service)}`,
        toggle: `${svc.active}: ${displayName(service)}`,
        inactive: svc.inactive,
        durationLabel: svc.duration,
      }}
      onEdit={() => openEdit(service)}
      onDelete={() => setPendingDelete(service)}
      onToggle={() => void toggleActive(service.id, !service.is_active)}
    />
  ));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col gap-6 sm:gap-9"
    >
      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className="font-extrabold text-[var(--text-primary)]"
            style={{ fontFamily: FF, fontSize: 32, letterSpacing: headingTracking(isRTL, "0.016em") }}
          >
            {svc.title}
          </h2>
          <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">{svc.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <label htmlFor={searchId} className="sr-only">
              {svc.searchPlaceholder}
            </label>
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            />
            <input
              id={searchId}
              type="search"
              placeholder={svc.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] ps-10 pe-4 text-base font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:outline-none focus:shadow-[var(--shadow-focus)] sm:text-sm"
            />
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={openAdd}
              aria-label={svc.addService}
              className="btn btn-primary shrink-0 px-4 sm:px-5 text-[14px] font-bold"
            >
              <Plus size={16} aria-hidden />
              <span className="hidden sm:inline">{svc.addService}</span>
            </button>
          )}
        </div>
      </div>

      {canReorder && (
        <p className="-mt-2 text-xs text-[var(--text-muted)] sm:-mt-5">{svc.reorderHint}</p>
      )}

      {/* List */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : error && services.length === 0 ? (
        <EmptyState
          tone="error"
          title={svc.loadFailed}
          action={{ label: t.common.retry, onClick: () => void refetch() }}
        />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={svc.noServices}
          description={svc.noServicesDesc}
          action={isAdmin ? { label: svc.addService, onClick: openAdd, icon: Plus } : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Search}
          title={svc.noResults}
          action={{ label: svc.clearSearch, onClick: () => setSearchTerm("") }}
        />
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]"
          aria-busy={saving || undefined}
        >
          {canReorder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              accessibility={{ announcements, screenReaderInstructions: { draggable: svc.reorderInstructions } }}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul role="list">{rows}</ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ul role="list">{rows}</ul>
          )}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={showForm}
        onClose={closeForm}
        title={editingService ? svc.editService : svc.addService}
        initialFocusRef={nameRef}
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        footer={
          <DialogFooter>
            <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>
              {t.common.cancel}
            </button>
            <button type="submit" form={formId} className="btn btn-primary font-bold" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
              {editingService ? svc.saveChanges : svc.addService}
            </button>
          </DialogFooter>
        }
      >
        <form id={formId} onSubmit={handleSave} noValidate className="flex flex-col gap-5">
          {/* Icon picker */}
          <fieldset>
            <legend className="field-label">{svc.icon}</legend>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  aria-pressed={icon === ic}
                  className={cn(
                    "flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-buttons)] border text-lg transition-all",
                    icon === ic
                      ? "border-[var(--accent-brass)] bg-[var(--bg-secondary)]"
                      : "border-transparent bg-[var(--bg-secondary)]/60 hover:border-[var(--border-primary)]",
                  )}
                >
                  <span aria-hidden>{ic}</span>
                  <span className="sr-only">{`${svc.icon} ${ICONS.indexOf(ic) + 1}`}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${formId}-name`} className="field-label">
              {svc.serviceName} <span aria-hidden>*</span>
            </label>
            <input
              ref={nameRef}
              {...fieldA11y("name")}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              autoComplete="off"
              className="field-input"
              placeholder={svc.namePlaceholder}
            />
            {fieldError("name")}
          </div>

          <div>
            <label htmlFor={`${formId}-name_ar`} className="field-label">
              {svc.serviceNameAr}
            </label>
            <input
              {...fieldA11y("name_ar")}
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir="rtl"
              lang="ar"
              maxLength={100}
              autoComplete="off"
              className="field-input"
              placeholder={svc.nameArPlaceholder}
            />
            {fieldError("name_ar")}
          </div>

          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-duration`} className="field-label">
                {svc.duration} ({svc.minutes})
              </label>
              <input
                {...fieldA11y("duration")}
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={5}
                max={480}
                step={5}
                className="field-input"
              />
              {fieldError("duration")}
            </div>
            <div>
              <label htmlFor={`${formId}-price`} className="field-label">
                {svc.price} ({currency}) <span aria-hidden>*</span>
              </label>
              <input
                {...fieldA11y("price")}
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                min={0}
                step="0.5"
                className="field-input"
              />
              {fieldError("price")}
            </div>
          </div>
        </form>
      </Dialog>

      {/* Delete / archive confirmation */}
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        destructive
        title={pendingDelete ? `${svc.deleteService}: ${displayName(pendingDelete)}` : svc.deleteService}
        description={svc.deleteArchiveNote}
        confirmLabel={t.common.delete}
        errorMessage={svc.deleteFailed}
      />
    </motion.div>
  );
}

// ─── Row ───

interface ServiceRowProps {
  service: ServiceItem;
  sortable: boolean;
  isAdmin: boolean;
  title: string;
  subtitle: string | null;
  meta: string;
  fontFamily: string;
  labels: {
    reorder: string;
    edit: string;
    remove: string;
    toggle: string;
    inactive: string;
    durationLabel: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function ServiceRow(props: ServiceRowProps) {
  // Hooks can't be conditional: a sortable row and a static row are separate
  // components sharing the same body.
  return props.sortable ? <SortableServiceRow {...props} /> : <ServiceRowBody {...props} />;
}

function SortableServiceRow(props: ServiceRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.service.id,
  });
  return (
    <ServiceRowBody
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      handle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={props.labels.reorder}
          className={cn(iconBtn, "cursor-grab touch-none active:cursor-grabbing")}
        >
          <GripVertical size={16} aria-hidden />
        </button>
      }
    />
  );
}

function ServiceRowBody({
  service, isAdmin, title, subtitle, meta, fontFamily, labels,
  onEdit, onDelete, onToggle, rowRef, style, dragging, handle,
}: ServiceRowProps & {
  rowRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
  handle?: React.ReactNode;
}) {
  return (
    <li
      ref={rowRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-3 last:border-b-0 transition-colors hover:bg-[var(--bg-secondary)] sm:gap-4 sm:px-6 sm:py-3.5",
        dragging && "z-10 shadow-lg ring-1 ring-[var(--accent-brass)]",
      )}
    >
      {handle}

      <div
        className={cn(
          "hidden size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-lg min-[420px]:flex",
          !service.is_active && "opacity-60",
        )}
        aria-hidden
      >
        {service.icon || "✂️"}
      </div>

      <div className={cn("min-w-0 flex-1", !service.is_active && "opacity-70")}>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold text-[var(--text-primary)]" style={{ fontFamily }}>
            {title}
          </p>
          {!service.is_active && (
            <span className="shrink-0 rounded-full bg-[var(--accent-rose-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-rose)]">
              {labels.inactive}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{subtitle}</p>}
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] tabular-nums">
          <Clock size={12} aria-hidden />
          <span className="sr-only">{labels.durationLabel}:</span>
          {meta}
        </p>
      </div>

      {isAdmin && (
        // Always visible below lg (touch); revealed on hover/focus on desktop.
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <button
            type="button"
            role="switch"
            aria-checked={service.is_active}
            onClick={onToggle}
            aria-label={labels.toggle}
            title={labels.toggle}
            className={iconBtn}
          >
            <span
              aria-hidden
              className={cn(
                "relative inline-block h-5 w-9 rounded-full transition-colors",
                service.is_active ? "bg-[var(--accent-mint)]" : "bg-[var(--border-primary)]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-[var(--bg-primary)] shadow transition-all",
                  service.is_active ? "start-[18px]" : "start-0.5",
                )}
              />
            </span>
          </button>
          <button type="button" onClick={onEdit} aria-label={labels.edit} title={labels.edit} className={iconBtn}>
            <Pencil size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={labels.remove}
            title={labels.remove}
            className={cn(iconBtn, "hover:text-[var(--accent-rose)]")}
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}
