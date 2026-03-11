"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Clock, DollarSign, GripVertical,
  Pencil, Trash2, X, Loader2, Sparkles, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import { useServices, type ServiceItem } from "@/hooks/use-services";

const ICONS = ["✂️", "💈", "🧔", "💇", "🪒", "🧴", "💆", "🎨", "✨", "👑", "🧖", "💅"];

export default function ServicesPage() {
  const t = useTranslation();
  const { direction } = useThemeStore();
  const isRTL = direction === "rtl";
  const { services, loading, addService, updateService, deleteService, toggleActive, reorderServices } = useServices();

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("✂️");
  const [saving, setSaving] = useState(false);

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const filtered = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.name_ar && s.name_ar.includes(searchTerm)),
  );

  function openAdd() {
    setEditingService(null);
    setName(""); setNameAr(""); setDuration("30"); setPrice(""); setIcon("✂️");
    setShowForm(true);
  }

  function openEdit(s: ServiceItem) {
    setEditingService(s);
    setName(s.name);
    setNameAr(s.name_ar || "");
    setDuration(s.duration.toString());
    setPrice(s.price.toString());
    setIcon(s.icon || "✂️");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price.trim()) return;
    setSaving(true);
    const data = {
      name: name.trim(),
      name_ar: nameAr.trim() || null,
      duration: parseInt(duration) || 30,
      price: parseFloat(price) || 0,
      icon,
    };
    if (editingService) {
      await updateService(editingService.id, data);
    } else {
      await addService(data);
    }
    setSaving(false);
    setShowForm(false);
    setEditingService(null);
  }

  async function handleDelete(id: string) {
    const msg = (t as Record<string, Record<string, string>>).services?.deleteConfirm || "Delete this service?";
    if (!confirm(msg)) return;
    await deleteService(id);
  }

  function handleDragStart(id: string) {
    setDraggedId(id);
  }
  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverId(id);
  }
  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const ids = services.map((s) => s.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);
    reorderServices(reordered);
    setDraggedId(null);
    setDragOverId(null);
  }

  const svc = (t as Record<string, Record<string, string>>).services || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ display: "flex", flexDirection: "column", gap: 36 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between" style={{ gap: 20 }}>
        <div>
          <h2 className="tracking-tight text-[var(--text-primary)] font-bold" style={{ fontSize: 26 }}>
            {svc.title || "Services"}
          </h2>
          <p className="text-[var(--text-tertiary)]" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            {svc.subtitle || "Manage your barbershop service menu"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder={svc.title || "Search..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--bg-surface)] border border-transparent focus:border-[var(--accent-mint)]/30 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all"
            />
          </div>
          <button
            onClick={openAdd}
            className="h-[42px] px-5 rounded-xl bg-[var(--accent-mint)] text-[#0A0A0A] font-semibold text-[13px] flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">{svc.addService || "Add Service"}</span>
          </button>
        </div>
      </div>

      {/* Services grid */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ paddingTop: 80 }}>
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 80 }}>
          <div
            className="rounded-2xl flex items-center justify-center"
            style={{ width: 64, height: 64, background: "var(--accent-mint-muted)", marginBottom: 20 }}
          >
            <Sparkles size={28} className="text-[var(--accent-mint)]" />
          </div>
          <p className="text-[var(--text-secondary)] font-semibold" style={{ fontSize: 16, marginBottom: 8 }}>
            {svc.noServices || "No services yet"}
          </p>
          <p className="text-[var(--text-muted)]" style={{ fontSize: 13, maxWidth: 280 }}>
            {svc.noServicesDesc || "Add your first service to get started"}
          </p>
          <button
            onClick={openAdd}
            className="mt-6 h-10 px-6 rounded-xl bg-[var(--accent-mint)] text-[#0A0A0A] font-semibold text-[13px] flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus size={15} />
            {svc.addService || "Add Service"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 20 }}>
          {filtered.map((service) => (
            <div
              key={service.id}
              draggable
              onDragStart={() => handleDragStart(service.id)}
              onDragOver={(e) => handleDragOver(e, service.id)}
              onDrop={() => handleDrop(service.id)}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
              className={cn(
                "group relative rounded-2xl border border-[var(--border-primary)] bg-[var(--glass-bg)] backdrop-blur-xl p-[22px] transition-all duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]",
                draggedId === service.id && "opacity-40",
                dragOverId === service.id && "border-[var(--accent-mint)]/40 scale-[1.02]",
                !service.is_active && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between" style={{ marginBottom: 18 }}>
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-xl flex items-center justify-center text-lg cursor-grab active:cursor-grabbing"
                    style={{ width: 44, height: 44, background: "var(--accent-mint-muted)" }}
                  >
                    {service.icon || "✂️"}
                  </div>
                  <div>
                    <p className="text-[var(--text-primary)] font-semibold" style={{ fontSize: 14, marginBottom: 2 }}>
                      {isRTL && service.name_ar ? service.name_ar : service.name}
                    </p>
                    {service.name_ar && !isRTL && (
                      <p className="text-[var(--text-muted)]" style={{ fontSize: 11 }}>{service.name_ar}</p>
                    )}
                    {!isRTL && service.name && isRTL && (
                      <p className="text-[var(--text-muted)]" style={{ fontSize: 11 }}>{service.name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleActive(service.id, !service.is_active)}
                    className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-mint)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
                    title={service.is_active ? svc.inactive : svc.active}
                    aria-label={service.is_active ? (svc.deactivate || "Deactivate service") : (svc.activate || "Activate service")}
                  >
                    {service.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  </button>
                  <button
                    onClick={() => openEdit(service)}
                    className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-lavender)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
                    aria-label={svc.editService || "Edit service"}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-rose)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
                    aria-label={svc.delete || "Delete service"}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center" style={{ gap: 16 }}>
                <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                  <Clock size={13} />
                  <span style={{ fontSize: 12 }}>{service.duration} {svc.minutes || "min"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--accent-mint)] font-semibold">
                  <DollarSign size={13} />
                  <span style={{ fontSize: 12 }}>{service.price.toFixed(1)} JOD</span>
                </div>
                {!service.is_active && (
                  <span
                    className="text-[var(--accent-rose)] bg-[var(--accent-rose-muted)] px-2 py-0.5 rounded-full font-medium"
                    style={{ fontSize: 10 }}
                  >
                    {svc.inactive || "Inactive"}
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing",
                  isRTL ? "left-2" : "right-2",
                )}
              >
                <GripVertical size={14} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-2xl"
                style={{ padding: "28px 28px 24px" }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                  <h3 className="text-[var(--text-primary)] font-bold" style={{ fontSize: 18 }}>
                    {editingService ? (svc.editService || "Edit Service") : (svc.addService || "Add Service")}
                  </h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col" style={{ gap: 18 }}>
                  {/* Icon picker */}
                  <div>
                    <label className="text-[var(--text-tertiary)] font-medium block" style={{ fontSize: 12, marginBottom: 8 }}>
                      {svc.icon || "Icon"}
                    </label>
                    <div className="flex flex-wrap" style={{ gap: 8 }}>
                      {ICONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setIcon(ic)}
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all cursor-pointer border",
                            icon === ic
                              ? "bg-[var(--accent-mint-muted)] border-[var(--accent-mint)]/40 scale-110"
                              : "bg-[var(--bg-surface)] border-transparent hover:border-[var(--border-hover)]",
                          )}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="text-[var(--text-tertiary)] font-medium block" style={{ fontSize: 12, marginBottom: 8 }}>
                      {svc.serviceName || "Service Name"} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-transparent focus:border-[var(--accent-mint)]/30 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all"
                      placeholder="e.g. Haircut"
                    />
                  </div>

                  {/* Arabic Name */}
                  <div>
                    <label className="text-[var(--text-tertiary)] font-medium block" style={{ fontSize: 12, marginBottom: 8 }}>
                      {svc.serviceNameAr || "Service Name (Arabic)"}
                    </label>
                    <input
                      type="text"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      dir="rtl"
                      className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-transparent focus:border-[var(--accent-mint)]/30 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all"
                      placeholder="مثال: قص شعر"
                    />
                  </div>

                  {/* Duration + Price */}
                  <div className="grid grid-cols-2" style={{ gap: 12 }}>
                    <div>
                      <label className="text-[var(--text-tertiary)] font-medium block" style={{ fontSize: 12, marginBottom: 8 }}>
                        {svc.duration || "Duration"} ({svc.minutes || "min"})
                      </label>
                      <input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        min="5"
                        step="5"
                        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-transparent focus:border-[var(--accent-mint)]/30 text-[13px] text-[var(--text-primary)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[var(--text-tertiary)] font-medium block" style={{ fontSize: 12, marginBottom: 8 }}>
                        {svc.price || "Price"} (JOD) *
                      </label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        min="0"
                        step="0.5"
                        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-transparent focus:border-[var(--accent-mint)]/30 text-[13px] text-[var(--text-primary)] transition-all"
                      />
                    </div>
                  </div>

                  {/* Save */}
                  <button
                    type="submit"
                    disabled={saving || !name.trim() || !price.trim()}
                    className="h-11 rounded-xl bg-[var(--accent-mint)] text-[#0A0A0A] font-semibold text-[13px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                    style={{ marginTop: 8 }}
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                    {editingService ? (svc.editService || "Save Changes") : (svc.addService || "Add Service")}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
