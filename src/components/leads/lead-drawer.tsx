"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassButton } from "@/components/ui/glass-button";
import { useLeadsStore, type LeadStage } from "@/store/leads-store";
import { toast } from "@/components/ui/toast";
import {
  X,
  Phone,
  Mail,
  DollarSign,
  StickyNote,
  Trash2,
  Save,
  Calendar,
  User,
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";

export function LeadDrawer() {
  const { selectedLead, drawerOpen, setDrawerOpen, updateLead, deleteLead } =
    useLeadsStore();
  const t = useTranslation();
  const isRTL = useThemeStore((s) => s.direction) === "rtl";

  const stageOptions: { value: LeadStage; label: string; color: string }[] = [
    { value: "new", label: t.leads.newLead, color: "var(--accent-blue)" },
    {
      value: "contacted",
      label: t.leads.contacted,
      color: "var(--accent-lavender)",
    },
    {
      value: "booked",
      label: t.leads.bookedPackage,
      color: "var(--accent-amber)",
    },
    {
      value: "completed",
      label: t.leads.completedStage,
      color: "var(--accent-mint)",
    },
    { value: "regular", label: t.leads.loyal, color: "var(--accent-rose)" },
  ];

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    value: "",
    stage: "new" as LeadStage,
    notes: "",
  });

  useEffect(() => {
    if (selectedLead) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: selectedLead.name || "",
        phone: selectedLead.phone || "",
        email: selectedLead.email || "",
        value: selectedLead.value?.toString() || "",
        stage: selectedLead.stage,
        notes: selectedLead.notes || "",
      });
    }
  }, [selectedLead]);

  const handleSave = () => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, {
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
      value: form.value ? parseFloat(form.value) : undefined,
      stage: form.stage,
      notes: form.notes || undefined,
    });
    toast("success", t.leads.leadUpdated);
  };

  const handleDelete = () => {
    if (!selectedLead) return;
    deleteLead(selectedLead.id);
    toast("info", t.leads.leadDeleted);
  };

  return (
    <AnimatePresence>
      {drawerOpen && selectedLead && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-50"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: isRTL ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRTL ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "fixed top-0 h-screen w-[420px] z-50",
              "bg-[var(--bg-secondary)] flex flex-col",
              isRTL
                ? "left-0 border-e border-[var(--border-primary)]"
                : "right-0 border-s border-[var(--border-primary)]",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
              <h3 className="text-[14px] text-[var(--text-primary)] font-medium">
                {t.leads.leadProfile}
              </h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Avatar + Name */}
            <div className="px-6 py-6 flex items-center gap-4 border-b border-[var(--border-primary)]">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center flex-shrink-0">
                <span className="text-[14px] font-medium text-[#0A0A0A]">
                  {form.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2) || "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full text-[16px] text-[var(--text-primary)] font-light bg-transparent focus:outline-none border-b border-transparent focus:border-[var(--border-hover)] transition-colors pb-0.5"
                  placeholder="Lead Name"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {t.leads.created} {selectedLead.createdAt}
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-5">
                {/* Stage */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-2">
                    <User size={12} />
                    {t.leads.stage}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {stageOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setForm((f) => ({ ...f, stage: opt.value }))
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer",
                          form.stage === opt.value
                            ? "border-current"
                            : "border-transparent bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
                        )}
                        style={
                          form.stage === opt.value
                            ? {
                                color: opt.color,
                                backgroundColor: `color-mix(in srgb, ${opt.color} 15%, transparent)`,
                              }
                            : undefined
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-1.5">
                    <Phone size={12} />
                    {t.leads.phone}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                    placeholder="+962..."
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-1.5">
                    <Mail size={12} />
                    {t.leads.email}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                    placeholder="email@example.com"
                  />
                </div>

                {/* Value */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-1.5">
                    <DollarSign size={12} />
                    {t.leads.dealValue}
                  </label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, value: e.target.value }))
                    }
                    className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                    placeholder="0.00"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-1.5">
                    <StickyNote size={12} />
                    {t.leads.notes}
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    className="w-full h-24 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors resize-none"
                    placeholder="Wedding groom, VIP package, allergies..."
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-[var(--border-primary)] flex items-center justify-between">
              <GlassButton
                variant="danger"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={handleDelete}
              >
                {t.common.delete}
              </GlassButton>
              <GlassButton
                variant="primary"
                size="md"
                icon={<Save size={14} />}
                onClick={handleSave}
              >
                {t.common.save}
              </GlassButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
