"use client";

import React from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn, formatCurrency } from "@/lib/utils";
import { Download, FileText, CreditCard, Banknote } from "lucide-react";
import { todaysSales } from "@/lib/mock-data";
import { useTranslation } from "@/hooks/use-translation";

export function DailyReceipt() {
    const t = useTranslation();
    const totalSales = todaysSales.reduce((sum, sale) => sum + sale.amount, 0);
    const cashTotal = todaysSales
        .filter((s) => s.paymentMethod === "cash")
        .reduce((sum, s) => sum + s.amount, 0);
    const cardTotal = todaysSales
        .filter((s) => s.paymentMethod === "card")
        .reduce((sum, s) => sum + s.amount, 0);

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
                    <span className="text-[var(--text-tertiary)]">{t.dashboard.cash}</span>
                    <span className="text-[var(--text-primary)] font-medium">{formatCurrency(cashTotal)}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[11px]">
                    <CreditCard size={13} className="text-[var(--accent-lavender)]" />
                    <span className="text-[var(--text-tertiary)]">{t.dashboard.card}</span>
                    <span className="text-[var(--text-primary)] font-medium">{formatCurrency(cardTotal)}</span>
                </div>
            </div>

            {/* Transactions list — receipt-like */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6">
                <div className="space-y-0">
                    {todaysSales.map((sale, index) => (
                        <motion.div
                            key={sale.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                "flex items-center justify-between py-3",
                                index < todaysSales.length - 1 &&
                                "border-b border-dashed border-[var(--border-primary)]"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-[var(--text-primary)] font-light truncate">
                                    {sale.clientName}
                                </p>
                                <p className="text-[11px] text-[var(--text-tertiary)] font-light">
                                    {sale.service} · {sale.barberName}
                                </p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                                <p className="text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
                                    {sale.amount.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-[var(--text-muted)] font-light">
                                    {sale.time} · {sale.paymentMethod}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Footer — total */}
            <div className="pt-4 mt-4 border-t border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">
                        {t.dashboard.total} ({todaysSales.length} {t.dashboard.transactions.toLowerCase()})
                    </span>
                    <span className="text-lg text-[var(--text-primary)] font-light">
                        {formatCurrency(totalSales)}
                    </span>
                </div>
            </div>
        </GlassCard>
    );
}
