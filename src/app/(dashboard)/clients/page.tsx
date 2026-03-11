"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Phone,
  Mail,
  Star,
  Calendar,
  DollarSign,
  User,
  X,
  MessageCircle,
  Scissors,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getClients } from "@/lib/queries/clients";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";

const accentColors = [
  "var(--accent-mint)",
  "var(--accent-lavender)",
  "var(--accent-blue)",
  "var(--accent-amber)",
  "var(--accent-rose)",
];

export default function ClientsPage() {
  const t = useTranslation();
  const { direction } = useThemeStore();
  const { shopId } = useWorkspaceStore();
  const isRTL = direction === "rtl";
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Record<string, unknown> | null>(null);

  const supabase = createClient();

  const { data, loading, error } = useSupabaseQuery(
    () => getClients(supabase, shopId, page, searchTerm),
    [shopId, page, searchTerm],
    { enabled: !!shopId },
  );

  // Reset page when search changes
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  const clients = (data as unknown as Record<string, unknown>[]) ?? [];

  if (loading && page === 1) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.4, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] tracking-tight text-[var(--text-primary)] font-light">
            {t.sidebar.clients}
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] font-light mt-1">
            {clients.length} {isRTL ? "عميل" : "clients"}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search
            size={14}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            type="text"
            placeholder={t.common.search}
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full h-10 ps-9 pe-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-transparent focus:outline-none focus:border-[var(--border-primary)] focus:bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all"
          />
        </div>
      </div>

      {/* Empty State */}
      {!loading && clients.length === 0 && (
        <EmptyState
          icon={Users}
          title={isRTL ? "لا يوجد عملاء بعد" : "No clients yet"}
          description={
            isRTL
              ? "سيظهر العملاء هنا عند حجز مواعيدهم"
              : "Clients will appear here when they book appointments"
          }
        />
      )}

      {/* Client Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {clients.map((client: Record<string, unknown>, i: number) => {
          const color = accentColors[i % accentColors.length];
          const name = client.name as string;
          const initials = name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase();

          return (
            <motion.div
              key={client.id as string}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedClient(client)}
              className="glass-card-premium p-4 cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    color: color,
                  }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] font-light truncate">
                    {name}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] font-light">
                    {(client.phone as string) ?? "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 relative z-10">
                <div className="text-center p-2 rounded-lg bg-[var(--bg-surface)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-light">
                    {isRTL ? "إنفاق" : "Spent"}
                  </p>
                  <p className="text-[14px] text-[var(--text-primary)] font-light">
                    {((client.total_spend as number) ?? 0).toFixed(0)}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-[var(--bg-surface)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-light">
                    {isRTL ? "بريد" : "Email"}
                  </p>
                  <p className="text-[12px] text-[var(--text-primary)] font-light truncate">
                    {(client.email as string) ? "✓" : "—"}
                  </p>
                </div>
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                <button className="flex-1 h-7 rounded-lg bg-[var(--accent-mint-muted)] text-[var(--accent-mint)] text-[11px] flex items-center justify-center gap-1 hover:opacity-80 transition-opacity cursor-pointer">
                  <MessageCircle size={11} />
                  WhatsApp
                </button>
                <button className="flex-1 h-7 rounded-lg bg-[var(--bg-surface)] text-[var(--text-tertiary)] text-[11px] flex items-center justify-center gap-1 hover:text-[var(--text-secondary)] transition-colors cursor-pointer">
                  <Phone size={11} />
                  {isRTL ? "اتصال" : "Call"}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {clients.length >= 20 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-8 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-tertiary)] text-[12px] flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:border-[var(--border-hover)] transition-all"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="text-[12px] text-[var(--text-tertiary)]">
            Page {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="h-8 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-tertiary)] text-[12px] flex items-center gap-1 cursor-pointer hover:border-[var(--border-hover)] transition-all"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Client Detail Drawer */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
              onClick={() => setSelectedClient(null)}
            />
            <motion.div
              initial={{ x: isRTL ? -400 : 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? -400 : 400, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed top-0 ${isRTL ? "start-0" : "end-0"} w-full sm:w-[380px] h-full bg-[var(--bg-secondary)] border-s border-[var(--border-primary)] z-[60] overflow-y-auto`}
            >
              <div className="p-6">
                {/* Close */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[15px] text-[var(--text-primary)] font-light">
                    {isRTL ? "ملف العميل" : "Client Profile"}
                  </h3>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Avatar */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center text-[20px] font-light text-[#0A0A0A] mx-auto mb-3">
                    {(selectedClient.name as string)
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <h4 className="text-[16px] text-[var(--text-primary)] font-light">
                    {selectedClient.name as string}
                  </h4>
                </div>

                {/* Info fields */}
                <div className="space-y-4">
                  {[
                    {
                      icon: Phone,
                      label: t.leads.phone,
                      value: (selectedClient.phone as string) ?? "—",
                    },
                    {
                      icon: Mail,
                      label: t.leads.email,
                      value: (selectedClient.email as string) ?? "—",
                    },
                    {
                      icon: DollarSign,
                      label: isRTL ? "إجمالي الإنفاق" : "Total Spend",
                      value: `${((selectedClient.total_spend as number) ?? 0).toFixed(2)} JOD`,
                    },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-light flex items-center gap-1.5 mb-1">
                        <field.icon size={12} />
                        {field.label}
                      </label>
                      <div className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center">
                        <span className="text-[13px] text-[var(--text-primary)] font-light">
                          {field.value}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Notes */}
                  {Boolean(selectedClient.notes) && (
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-light mb-1 block">
                        {isRTL ? "ملاحظات" : "Notes"}
                      </label>
                      <div className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)]">
                        <p className="text-[13px] text-[var(--text-secondary)] font-light">
                          {String(selectedClient.notes)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-6">
                  <button className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[13px] font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer">
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                  <button className="flex-1 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-[13px] font-light flex items-center justify-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all cursor-pointer">
                    <Calendar size={14} />
                    {isRTL ? "حجز جديد" : "New Booking"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
