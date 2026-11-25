"use client";

import React, { useId, useMemo, useState } from "react";
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
import { Plus, Search, Clock, GripVertical, Pencil, Trash2, Sparkles, SlidersHorizontal, Home, EyeOff, Layers, MoreVertical } from "lucide-react";
import { Popover, PopoverMenuItem } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useServices, type ServiceItem } from "@/hooks/use-services";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { focusRing, inputClasses, fieldIconClasses } from "@/components/ui/recipes";
import { joinMeta, formatMinutesRange } from "@/lib/format";
import type { ServiceWrite, VariantDraft } from "@/lib/queries/services";
import { ServiceEditor } from "./service-editor";
import { BookingRulesDialog } from "./booking-rules-dialog";

const iconBtn = cn(
  "inline-flex size-11 lg:size-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunken hover:text-ink cursor-pointer",
  focusRing,
);

export default function ServicesPage() {
  const { t, isRTL, FF, locale, formatCurrency, formatNumber } = useTranslation();
  const svc = t.services;
  const {
    services, categories, rules, legacy, loading, error, currency, refetch,
    addService, updateService, removeService, toggleActive, reorderServices, saveRules,
  } = useServices();
  const role = useWorkspaceStore((s) => s.role);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const isAdmin = hydrated && role === "shop_admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServiceItem | null>(null);
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

  // Back office: one money/number style everywhere (Latin digits, "8 JOD"),
  // the same formatter the dashboard, clients and analytics use.
  const money = (n: number) => formatCurrency(n, currency || "JOD", { trimZeros: true });

  /** "from 5 JOD" / "8 JOD" / "Free" — its own column, never truncated. */
  const priceFor = (s: ServiceItem) => {
    const prices = s.variants.length ? s.variants.map((v) => v.price) : [s.price];
    const min = Math.min(...prices);
    return s.price_type === "free" ? svc.priceFree
      : s.price_type === "from" || min !== Math.max(...prices) ? interpolate(svc.fromPriceShort, { price: money(min) })
      : money(min);
  };

  /** "30–45 min · 3 options" */
  const metaFor = (s: ServiceItem) => {
    const durations = s.variants.length ? s.variants.map((v) => v.duration) : [s.duration];
    return joinMeta([
      formatMinutesRange(Math.min(...durations), Math.max(...durations), locale, "latn"),
      s.variants.length ? interpolate(svc.optionsCount, { count: s.variants.length }) : null,
    ]);
  };

  function openAdd() {
    setEditingService(null);
    setShowForm(true);
  }

  function openEdit(s: ServiceItem) {
    setEditingService(s);
    setShowForm(true);
  }

  async function handleSave(write: ServiceWrite, variants: VariantDraft[]) {
    return editingService
      ? updateService(editingService.id, write, legacy ? undefined : variants)
      : addService(write, variants);
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

  const rows = filtered.map((service) => (
    <ServiceRow
      key={service.id}
      service={service}
      sortable={canReorder}
      isAdmin={isAdmin}
      title={displayName(service)}
      subtitle={service.name_ar ? (isRTL ? service.name : service.name_ar) : null}
      meta={metaFor(service)}
      price={priceFor(service)}
      badges={{
        home: service.location_type === "home" ? svc.locationHome : null,
        hidden: service.is_active && !service.online_bookable ? svc.hiddenOnline : null,
      }}
      fontFamily={FF}
      labels={{
        reorder: interpolate(svc.reorderHandle, { name: displayName(service) }),
        edit: `${svc.editService}: ${displayName(service)}`,
        remove: `${svc.deleteService}: ${displayName(service)}`,
        toggle: `${svc.active}: ${displayName(service)}`,
        inactive: svc.inactive,
        durationLabel: svc.duration,
        variants: svc.sectionVariants,
        more: interpolate(svc.moreActions, { name: displayName(service) }),
        editShort: svc.editShort,
        removeShort: t.common.delete,
      }}
      onEdit={() => openEdit(service)}
      onDelete={() => setPendingDelete(service)}
      onToggle={() => void toggleActive(service.id, !service.is_active)}
    />
  ));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.05, 0.7, 0.1, 1] }}
      className="flex flex-col gap-5 lg:gap-6 motion-reduce:transform-none"
    >
      {/* Header: title + count · search · rules (secondary) · add (the one primary) */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-h2 text-ink">{svc.title}</h1>
            {!loading && services.length > 0 && (
              <Pill tone="neutral" size="md" className="tabular-nums">{formatNumber(services.length)}</Pill>
            )}
          </div>
          <p className="mt-1 text-[15px] text-ink-muted">{svc.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
            <label htmlFor={searchId} className="sr-only">
              {svc.searchPlaceholder}
            </label>
            <span aria-hidden className={fieldIconClasses}>
              <Search />
            </span>
            <input
              id={searchId}
              type="search"
              placeholder={svc.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputClasses({ withIcon: true, className: "h-11 rounded-full" })}
            />
          </div>
          {isAdmin && !legacy && (
            <Button
              variant="secondary"
              onClick={() => setShowRules(true)}
              aria-label={svc.bookingRules}
              title={svc.bookingRules}
              icon={<SlidersHorizontal aria-hidden />}
              className="max-md:w-11 max-md:px-0"
            >
              <span className="hidden md:inline">{svc.bookingRules}</span>
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={openAdd}
              aria-label={svc.addService}
              icon={<Plus aria-hidden />}
              className="max-sm:w-11 max-sm:px-0"
            >
              <span className="hidden sm:inline">{svc.addService}</span>
            </Button>
          )}
        </div>
      </header>

      {canReorder && (
        <p className="-mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
          <GripVertical size={14} aria-hidden className="shrink-0" />
          {svc.reorderHint}
        </p>
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
        <div className="overflow-hidden rounded-xl border border-line bg-card">
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

      <ServiceEditor
        open={showForm}
        service={editingService}
        categories={categories}
        currency={currency}
        legacy={legacy}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
      />

      <BookingRulesDialog open={showRules} rules={rules} onClose={() => setShowRules(false)} onSave={saveRules} />

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
  price: string;
  badges: { home: string | null; hidden: string | null };
  fontFamily: string;
  labels: {
    reorder: string;
    edit: string;
    remove: string;
    toggle: string;
    inactive: string;
    durationLabel: string;
    variants: string;
    more: string;
    editShort: string;
    removeShort: string;
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
  service, isAdmin, title, subtitle, meta, price, badges, fontFamily, labels,
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
        "group relative flex items-center gap-3 border-b border-line bg-card px-3 py-3.5 last:border-b-0 transition-colors hover:bg-sunken/60 sm:gap-4 sm:px-5 sm:py-4",
        dragging && "z-10 rounded-lg shadow-float ring-2 ring-brand",
      )}
    >
      {handle}

      {/* Only a shop-chosen icon earns a tile; no identical scissors on every row. */}
      {service.icon && (
        <div
          className={cn(
            "hidden size-11 shrink-0 items-center justify-center rounded-lg bg-sunken text-lg min-[420px]:flex",
            !service.is_active && "opacity-60",
          )}
          aria-hidden
        >
          {service.icon}
        </div>
      )}

      <div className={cn("min-w-0 flex-1", !service.is_active && "opacity-70")}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-title line-clamp-2 min-w-0 break-words text-ink" style={{ fontFamily }}>
            {title}
          </p>
          {!service.is_active && (
            <Pill tone="danger" size="sm">{labels.inactive}</Pill>
          )}
          {badges.hidden && (
            <Pill tone="neutral" size="sm" icon={<EyeOff />}>{badges.hidden}</Pill>
          )}
          {badges.home && (
            <Pill tone="brand" size="sm" icon={<Home />}>{badges.home}</Pill>
          )}
        </div>
        {subtitle && <p className="mt-0.5 truncate text-[13px] text-ink-muted">{subtitle}</p>}
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted tabular-nums">
          {service.variants.length ? <Layers size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
          <span className="sr-only">{labels.durationLabel}:</span>
          <span className="truncate">{meta}</span>
        </p>
      </div>

      <p className={cn("shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink", !service.is_active && "opacity-70")}>
        <bdi>{price}</bdi>
      </p>

      {isAdmin && (
        <div className="flex shrink-0 items-center gap-0.5">
          {/* The online-booking switch is always visible; edit/delete fade in on desktop hover. */}
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
                service.is_active ? "bg-brand" : "bg-line-strong",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-[inset-inline-start] duration-150 motion-reduce:transition-none",
                  service.is_active ? "start-[18px]" : "start-0.5",
                )}
              />
            </span>
          </button>
          <div className="hidden items-center gap-0.5 transition-opacity sm:flex lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
            <button type="button" onClick={onEdit} aria-label={labels.edit} title={labels.edit} className={iconBtn}>
              <Pencil size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={labels.remove}
              title={labels.remove}
              className={cn(iconBtn, "hover:bg-danger-soft hover:text-danger-text")}
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
          {/* Phones: edit / delete behind one kebab so the name and price keep their room. */}
          <Popover
            kind="menu"
            label={labels.more}
            className="sm:hidden"
            panelClassName="min-w-44"
            trigger={(p) => (
              <button type="button" {...p} aria-label={labels.more} className={iconBtn}>
                <MoreVertical size={16} aria-hidden />
              </button>
            )}
          >
            {(close) => (
              <>
                <PopoverMenuItem icon={<Pencil aria-hidden />} onClick={() => { close(); onEdit(); }}>
                  {labels.editShort}
                </PopoverMenuItem>
                <PopoverMenuItem tone="danger" icon={<Trash2 aria-hidden />} onClick={() => { close(); onDelete(); }}>
                  {labels.removeShort}
                </PopoverMenuItem>
              </>
            )}
          </Popover>
        </div>
      )}
    </li>
  );
}
