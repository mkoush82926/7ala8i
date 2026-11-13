"use client";

import React from "react";
import { motion } from "framer-motion";
import { FileText, CreditCard, Banknote, Download, Printer, AlertTriangle, RefreshCw, Wallet } from "lucide-react";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { useDailySales, useShopSettings, type SaleItem } from "@/hooks/use-dashboard-data";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** RFC 4180 cell escaping, plus a guard against spreadsheet formula injection. Pure. */
export function escapeCsvValue(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Translucent layers derived from the inverted card's own foreground, so the
// card reads correctly in both themes (ink card in light, paper card in dark).
const tint = (pct: number) => `color-mix(in srgb, var(--brand-on-primary) ${pct}%, transparent)`;

function MethodRow({
  icon: Icon,
  label,
  count,
  total,
  delay,
}: {
  icon: typeof Banknote;
  label: string;
  count: number;
  total: string;
  delay: number;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 sm:px-5"
      style={{ background: tint(8) }}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: tint(12) }}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[14px] font-bold">{label}</p>
          <p className="m-0 text-[12px] font-semibold" style={{ color: tint(65) }}>
            {interpolate(t.dashboard.transactionsCount, { count })}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-[16px] font-extrabold tabular-nums">{total}</span>
    </motion.div>
  );
}

export function DailyReceipt() {
  const { t, isRTL, FFD, formatCurrency, formatTime, formatDate } = useTranslation();
  const { sales, loading, error, refetch, refreshing } = useDailySales();
  const { currency } = useShopSettings();
  const money = (n: number) => formatCurrency(n, currency);

  const sum = (list: SaleItem[]) => list.reduce((s, x) => s + x.amount, 0);
  const cash = sales.filter((s) => s.paymentMethod === "cash");
  const card = sales.filter((s) => s.paymentMethod === "card");
  const other = sales.filter((s) => s.paymentMethod !== "cash" && s.paymentMethod !== "card");
  const total = sum(sales);

  const methodLabel = (m: SaleItem["paymentMethod"]) =>
    m === "cash" ? t.dashboard.cash : m === "card" ? t.dashboard.card : t.dashboard.otherMethods;

  const handleExportCSV = () => {
    const header = [t.calendar.client, t.calendar.service, t.calendar.barber, t.dashboard.amount, t.calendar.time, t.dashboard.paymentMethod];
    const rows = sales.map((s) =>
      [s.clientName, s.service, s.barberName, s.amount.toFixed(2), formatTime(s.soldAt), methodLabel(s.paymentMethod)]
        .map((v) => escapeCsvValue(String(v)))
        .join(","),
    );
    // BOM so Excel opens Arabic names as UTF-8.
    const csv = "﻿" + [header.map(escapeCsvValue).join(","), ...rows].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const shell =
    "relative flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--brand-primary)] p-6 text-[var(--brand-on-primary)] sm:p-8";

  if (loading) {
    return (
      <div className={shell}>
        <SkeletonGroup className="flex flex-col gap-4 opacity-40">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-40" />
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
          <Skeleton className="mt-6 h-8 w-32" />
        </SkeletonGroup>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(shell, "items-center justify-center gap-3.5 text-center")} role="alert">
        <span className="grid size-11 place-items-center rounded-xl" style={{ background: tint(12) }}>
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <p className="m-0 text-[14px] font-bold">{t.dashboard.salesError}</p>
        <p className="m-0 text-[12px]" style={{ color: tint(65) }}>{t.error.message}</p>
        <button
          type="button"
          onClick={refetch}
          className="btn min-h-11 px-5 text-[12px]"
          style={{ background: tint(10), border: `1px solid ${tint(15)}`, color: "inherit" }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t.common.retry}
        </button>
      </div>
    );
  }

  const ghostBtn = "btn min-h-11 px-4 text-[12px] font-bold";
  const ghostStyle: React.CSSProperties = { background: tint(10), border: `1px solid ${tint(15)}`, color: "inherit" };

  return (
    <section aria-labelledby="daily-receipt-title" className={cn(shell, refreshing && "opacity-90")} aria-busy={refreshing || undefined}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[12px] font-bold" style={{ color: tint(60) }}>
            {formatDate(new Date(), "weekdayDay")}
          </p>
          <h2
            id="daily-receipt-title"
            className="m-0 text-[18px] font-extrabold"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.01em") }}
          >
            {t.dashboard.dailySummary}
          </h2>
        </div>
        <span className="grid size-9 place-items-center rounded-xl" style={{ background: tint(10) }}>
          <FileText size={16} aria-hidden="true" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <MethodRow icon={Banknote} label={t.dashboard.cash} count={cash.length} total={money(sum(cash))} delay={0.05} />
        <MethodRow icon={CreditCard} label={t.dashboard.card} count={card.length} total={money(sum(card))} delay={0.1} />
        {other.length > 0 && (
          <MethodRow icon={Wallet} label={t.dashboard.otherMethods} count={other.length} total={money(sum(other))} delay={0.15} />
        )}

        {sales.length === 0 ? (
          <p className="m-0 py-2 text-center text-[13px]" style={{ color: tint(60) }}>
            {t.dashboard.noSalesToday}
          </p>
        ) : (
          <ul className="m-0 mt-1 max-h-56 list-none overflow-y-auto p-0 pt-3" style={{ borderTop: `1px solid ${tint(12)}` }}>
            {sales.map((sale, i) => (
              <li
                key={sale.id}
                className="flex items-center justify-between gap-3 py-2"
                style={{ borderBottom: i < sales.length - 1 ? `1px solid ${tint(7)}` : "none" }}
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-bold">{sale.clientName || sale.service}</p>
                  <p className="m-0 text-[11px] tabular-nums" style={{ color: tint(60) }}>
                    {formatTime(sale.soldAt)} · {methodLabel(sale.paymentMethod)}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-bold tabular-nums">{money(sale.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${tint(12)}` }}>
        <div className="mb-4 flex items-end justify-between gap-3">
          <p className="m-0 text-[12px] font-bold" style={{ color: tint(60) }}>
            {t.dashboard.totalVolume}
          </p>
          <span
            className="text-[26px] font-black leading-none tabular-nums sm:text-[28px]"
            style={{ fontFamily: FFD }}
          >
            {money(total)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => window.print()} className={ghostBtn} style={ghostStyle} aria-label={t.dashboard.printSummary}>
            <Printer size={14} aria-hidden="true" />
            {t.common.pdf}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={sales.length === 0}
            className={cn(ghostBtn, "disabled:opacity-50")}
            style={ghostStyle}
            aria-label={t.dashboard.exportCsv}
          >
            <Download size={14} aria-hidden="true" />
            {t.common.csv}
          </button>
        </div>
      </div>
    </section>
  );
}
