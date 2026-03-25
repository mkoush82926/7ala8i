"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MessageCircle, ChevronLeft, ChevronRight,
  CheckCircle, Minus, UserPlus, Filter,
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getClients } from "@/lib/queries/clients";
import { DashboardSkeleton } from "@/components/ui/skeleton";

const avatarColors = [
  { bg: "#dde2f6", text: "#151b29" },
  { bg: "#d5e3fc", text: "#0d1c2e" },
  { bg: "#ffdea5", text: "#261900" },
  { bg: "#e0e3e5", text: "#191c1e" },
  { bg: "#151b29", text: "#ffffff" },
];

export default function ClientsPage() {
  const { t } = useTranslation();
  const { direction } = useThemeStore();
  const { shopId } = useWorkspaceStore();
  const isRTL = direction === "rtl";
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Record<string, unknown> | null>(null);

  const supabase = createClient();

  const { data, loading } = useSupabaseQuery(
    () => getClients(supabase, shopId, page, searchTerm),
    [shopId, page, searchTerm],
    { enabled: !!shopId },
  );

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  const clients = (data as unknown as Record<string, unknown>[]) ?? [];

  if (loading && page === 1) return <DashboardSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.4, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: 32 }}
    >
      {/* ── Page Header ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#191c1e", margin: 0 }}>
              {t.sidebar.clients}
            </h2>
            <p style={{ fontSize: 14, color: "#76777d", marginTop: 6, fontWeight: 400 }}>
              {isRTL ? "إدارة قاعدة بيانات" : "Manage your database of"}{" "}
              <strong style={{ color: "#191c1e" }}>{clients.length}</strong>{" "}
              {isRTL ? "عميل نشط" : "active clients"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#76777d", fontSize: 18 }}>search</span>
              <input
                type="text"
                placeholder={isRTL ? "البحث بالاسم أو الهاتف..." : "Search by name, phone, or email..."}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: 280, background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 24, padding: "10px 16px 10px 40px",
                  fontSize: 13, outline: "none", color: "#191c1e",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#191c1e";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(25,28,30,0.08)";
                  e.currentTarget.style.background = "#fff";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.background = "#f8fafc";
                }}
              />
            </div>
            <button className="btn btn-secondary" style={{ minHeight: "36px", padding: "0 16px" }}>
              <Filter size={14} />
              {isRTL ? "تصفية" : "Filters"}
            </button>
            <button className="btn btn-primary" style={{ minHeight: "36px" }}>
              <UserPlus size={14} />
              {isRTL ? "عميل جديد" : "New Client"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Client Grid ── */}
      {clients.length === 0 && !loading ? (
        <div style={{
          textAlign: "center", padding: "80px 0",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 56, color: "#c6c6cc" }}>group</span>
          <p style={{ fontWeight: 700, color: "#76777d", fontSize: 16 }}>
            {isRTL ? "لا يوجد عملاء بعد" : "No clients yet"}
          </p>
          <p style={{ fontSize: 13, color: "#b0b3b8", maxWidth: 320 }}>
            {isRTL ? "سيظهر العملاء هنا عند حجز مواعيدهم" : "Clients will appear here when they book appointments"}
          </p>
        </div>
      ) : (
        /* Practice #6 — grid respects content variation without breaking layout */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {clients.map((client: Record<string, unknown>, i: number) => {
            const colorScheme = avatarColors[i % avatarColors.length];
            const name = client.name as string ?? "—";
            const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
            const hasEmail = !!(client.email as string);
            const totalSpent = (client.total_spend as number) ?? 0;

            return (
              <motion.div
                key={client.id as string}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedClient(client)}
                style={{
                  // Practice #1 — white card on #f7f9fb bg with border + shadow
                  background: "#ffffff",
                  border: "1px solid #eceef0",
                  borderRadius: 16,
                  // Practice #3 — 24px = 6×4 base unit padding
                  padding: 24,
                  // Practice #5 — fixed min-height for grid consistency
                  minHeight: 180,
                  display: "flex", flexDirection: "column", gap: 16,
                  cursor: "pointer",
                  position: "relative", overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  transition: "border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
                }}
                // Practice #8 — hover, active states
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#d0d3d8";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.09)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#eceef0";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                }}
                onMouseDown={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "scale(0.98)";
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                }}
              >
                {/* Avatar + quick actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: colorScheme.bg, color: colorScheme.text,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      // Practice #2 — avatar initials ≥12px
                      fontSize: 14, fontWeight: 700,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 0.2s" }} className="group-actions">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: 8, background: "#f8fafc", border: "1px solid #eceef0",
                        borderRadius: "50%", cursor: "pointer",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>call</span>
                    </button>
                  </div>
                </div>

                {/* Practice #2 — name 16px bold (min body size), phone 13px */}
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 16, fontWeight: 700, color: "#191c1e",
                    margin: 0, lineHeight: 1.3,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {name}
                  </h3>
                  <p style={{ fontSize: 13, color: "#76777d", marginTop: 4, fontWeight: 400 }}>
                    {(client.phone as string) ?? "—"}
                  </p>
                </div>

                {/* Stats footer — isolated from card body by border */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingTop: 14, borderTop: "1px solid #f2f4f6",
                  marginTop: "auto",
                }}>
                  <div>
                    {/* Practice #2 — labels 9px UPPERCASE, values 13px bold */}
                    <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#b0b3b8", fontWeight: 700, display: "block" }}>
                      {isRTL ? "إجمالي الإنفاق" : "Total Spent"}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#191c1e", fontFamily: "Manrope, sans-serif" }}>
                      {totalSpent.toFixed(0)} JOD
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#b0b3b8", fontWeight: 700, display: "block" }}>
                      {isRTL ? "البريد" : "Email"}
                    </span>
                    {hasEmail ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#10b981", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : (
                      <Minus size={16} style={{ color: "#c6c6cc", marginTop: 2 }} />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {clients.length >= 20 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-on-surface-variant font-medium">
            {isRTL ? "عرض" : "Showing"}&nbsp;
            <span className="font-bold text-on-surface">{(page - 1) * 20 + 1} - {(page - 1) * 20 + clients.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary font-bold text-sm">
              {page}
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Client Detail Drawer ── */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
              onClick={() => setSelectedClient(null)}
            />
            <motion.div
              initial={{ x: isRTL ? -400 : 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? -400 : 400, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed top-0 ${isRTL ? "start-0" : "end-0"} w-full sm:w-[380px] h-full bg-surface-container-lowest border-s border-surface-container z-[60] overflow-y-auto shadow-2xl`}
            >
              <div className="p-6">
                {/* Close */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-on-surface" style={{ fontFamily: "Manrope, sans-serif" }}>
                    {isRTL ? "ملف العميل" : "Client Profile"}
                  </h3>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Avatar */}
                <div className="text-center mb-6">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-[20px] font-bold mx-auto mb-3"
                    style={{ background: "#000000", color: "#ffffff", fontFamily: "Manrope, sans-serif" }}
                  >
                    {(selectedClient.name as string)?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <h4 className="text-xl font-bold text-on-surface" style={{ fontFamily: "Manrope, sans-serif" }}>
                    {selectedClient.name as string}
                  </h4>
                </div>

                {/* Info */}
                <div className="space-y-4">
                  {[
                    { icon: "call", label: t.leads.phone, value: (selectedClient.phone as string) ?? "—" },
                    { icon: "mail", label: t.leads.email, value: (selectedClient.email as string) ?? "—" },
                    {
                      icon: "payments",
                      label: isRTL ? "إجمالي الإنفاق" : "Total Spend",
                      value: `${((selectedClient.total_spend as number) ?? 0).toFixed(2)} JOD`,
                    },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm">{field.icon}</span>
                        {field.label}
                      </label>
                      <div className="h-10 px-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center">
                        <span className="text-sm font-medium text-on-surface">{field.value}</span>
                      </div>
                    </div>
                  ))}

                  {Boolean(selectedClient.notes) && (
                    <div>
                      <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold mb-1.5 block">
                        {isRTL ? "ملاحظات" : "Notes"}
                      </label>
                      <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
                        <p className="text-sm text-on-surface-variant">{String(selectedClient.notes)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-8">
                  <button className="btn btn-primary" style={{ flex: 1, minHeight: 44 }}>
                    <MessageCircle size={15} />
                    WhatsApp
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }}>
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
