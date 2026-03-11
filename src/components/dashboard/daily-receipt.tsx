"use client";

import React from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn, formatCurrency } from "@/lib/utils";
import { Download, FileText, CreditCard, Banknote, Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { getTodayAppointments } from "@/lib/queries/appointments";

interface Sale {
  id: string;
  clientName: string;
  service: string;
  barberName: string;
  amount: number;
  time: string;
  paymentMethod: "cash" | "card";
}

export function DailyReceipt() {
  const t = useTranslation();
  const { shopId } = useWorkspaceStore();
  const supabase = createClient();

  const { data: rawAppts, loading } = useSupabaseQuery(
    () => getTodayAppointments(supabase, shopId),
    [shopId],
    { enabled: !!shopId },
  );

  // Map completed appointments to sales entries
  const sales: Sale[] = ((rawAppts as Record<string, unknown>[]) ?? [])
    .filter((a) => (a.status as string) === "completed")
    .map((a) => ({
      id: a.id as string,
      clientName: a.client_name as string,
      service: "Appointment",
      barberName: "Barber",
      amount: Number(a.price),
      time: new Date(a.start_time as string).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      paymentMethod: "cash" as const,
    }));

  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const cashTotal = sales
    .filter((s) => s.paymentMethod === "cash")
    .reduce((sum, s) => sum + s.amount, 0);
  const cardTotal = sales
    .filter((s) => s.paymentMethod === "card")
    .reduce((sum, s) => sum + s.amount, 0);

  if (loading) {
    return (
      <GlassCard hoverable={false} padding="lg" className="flex flex-col h-full items-center justify-center">
        <Loader2 size={24} className="text-[var(--accent-mint)] animate-spin" />
      </GlassCard>
    );
  }

  return (
    <GlassCard hoverable={false} padding="lg" className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)] font-light tracking-wide uppercase">
            {t.dashboard.dailySummary}
          </p>
          <p className="text-lg text-[var(--text-primary)] font-light mt-0.5">
            {formatCurrency(totalSales)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <GlassButton size="sm" icon={<FileText size={13} />}>
            PDF
          </GlassButton>
          <GlassButton size="sm" icon={<Download size={13} />}>
            CSV
          </GlassButton>
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[11px]">
          <Banknote size={13} className="text-[var(--accent-mint)]" />
          <span className="text-[var(--text-tertiary)]">
            {t.dashboard.cash}
          </span>
          <span className="text-[var(--text-primary)] font-medium">
            {formatCurrency(cashTotal)}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[11px]">
          <CreditCard size={13} className="text-[var(--accent-lavender)]" />
          <span className="text-[var(--text-tertiary)]">
            {t.dashboard.card}
          </span>
          <span className="text-[var(--text-primary)] font-medium">
            {formatCurrency(cardTotal)}
          </span>
        </div>
      </div>

      {/* Transactions list */}
      <div className="flex-1 overflow-y-auto -mx-6 px-6">
        {sales.length === 0 ? (
          <p className="text-[12px] text-[var(--text-muted)] text-center py-8">
            No completed sales today yet
          </p>
        ) : (
          <div className="space-y-0">
            {sales.map((sale, index) => (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center justify-between py-3",
                  index < sales.length - 1 &&
                    "border-b border-dashed border-[var(--border-primary)]",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] font-light truncate">
                    {sale.clientName}
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)] font-light">
                    {sale.service}
                  </p>
                </div>
                <div className="text-end ms- flex-shrink-0">
                  <p className="text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
                    {sale.amount.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-light">
                    {sale.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — total */}
      <div className="pt-4 mt-4 border-t border-[var(--border-primary)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">
            {t.dashboard.total} ({sales.length}{" "}
            {t.dashboard.transactions.toLowerCase()})
          </span>
          <span className="text-lg text-[var(--text-primary)] font-light">
            {formatCurrency(totalSales)}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
