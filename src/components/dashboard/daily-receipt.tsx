"use client";

import React from "react";
import { CreditCard, Banknote, Download, Printer, AlertTriangle, RefreshCw, Wallet } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useDailySales, useShopSettings, type SaleItem } from "@/hooks/use-dashboard-data";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** RFC 4180 cell escaping, plus a guard against spreadsheet formula injection. Pure. */
export function escapeCsvValue(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function MethodRow({
  icon: Icon,
  label,
  count,
  total,
}: {
  icon: typeof Banknote;
  label: string;
  count: number;
  total: string;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-ink">{label}</p>
          <p className="m-0 text-[13px] text-ink-muted">{interpolate(t.dashboard.transactionsCount, { count })}</p>
        </div>
      </div>
      <bdi className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{total}</bdi>
    </li>
  );
}

/** Today's takings by payment method, the sales list, the day total and export (v2 panel). */
export function DailyReceipt() {
  const { t, formatCurrency, formatTime, formatDate } = useTranslation();
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
    const csv = "\uFEFF" + [header.map(escapeCsvValue).join(","), ...rows].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const panelProps = {
    title: <span id="daily-receipt-title">{t.dashboard.dailySummaryTitle}</span>,
    description: formatDate(new Date(), "weekdayDay"),
    className: "flex flex-col",
    bodyClassName: "flex flex-col",
  };

  if (loading) {
    return (
      <Panel {...panelProps} aria-labelledby="daily-receipt-title">
        <SkeletonGroup className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
          <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        </SkeletonGroup>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel {...panelProps} aria-labelledby="daily-receipt-title">
        <EmptyState
          bare
          size="sm"
          tone="error"
          icon={AlertTriangle}
          title={t.dashboard.salesError}
          description={t.error.message}
          action={{ label: t.common.retry, onClick: refetch, icon: RefreshCw }}
        />
      </Panel>
    );
  }

  return (
    <Panel
      {...panelProps}
      aria-labelledby="daily-receipt-title"
      aria-busy={refreshing || undefined}
      className={cn(panelProps.className, "transition-opacity duration-200 motion-reduce:transition-none", refreshing && "opacity-80")}
      action={
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => window.print()}
            aria-label={t.dashboard.printSummary}
            title={t.dashboard.printSummary}
            icon={<Printer aria-hidden="true" />}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleExportCSV}
            disabled={sales.length === 0}
            aria-label={t.dashboard.exportCsv}
            title={t.dashboard.exportCsv}
            icon={<Download aria-hidden="true" />}
          />
        </>
      }
    >
      <ul className="m-0 list-none divide-y divide-line p-0">
        <MethodRow icon={Banknote} label={t.dashboard.cash} count={cash.length} total={money(sum(cash))} />
        <MethodRow icon={CreditCard} label={t.dashboard.card} count={card.length} total={money(sum(card))} />
        {other.length > 0 && (
          <MethodRow icon={Wallet} label={t.dashboard.otherMethods} count={other.length} total={money(sum(other))} />
        )}
      </ul>

      {sales.length === 0 ? (
        <p className="m-0 mt-2 rounded-lg bg-sunken px-4 py-3 text-center text-sm text-ink-muted">{t.dashboard.noSalesToday}</p>
      ) : (
        <ul className="m-0 mt-2 max-h-56 list-none overflow-y-auto rounded-lg bg-sunken/60 p-0 px-3">
          {sales.map((sale) => (
            <li key={sale.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium text-ink">
                  <bdi>{sale.clientName || sale.service}</bdi>
                </p>
                <p className="m-0 text-xs tabular-nums text-ink-muted">
                  {formatTime(sale.soldAt)} · {methodLabel(sale.paymentMethod)}
                </p>
              </div>
              <bdi className="shrink-0 text-sm font-semibold tabular-nums text-ink">{money(sale.amount)}</bdi>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-4">
        <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
          <p className="m-0 text-sm font-medium text-ink-muted">{t.dashboard.totalVolume}</p>
          {/* text-h3, not text-stat: the KPI row stays the loudest numbers on the page */}
          <bdi className="text-h3 tabular-nums text-ink">{money(total)}</bdi>
        </div>
      </div>
    </Panel>
  );
}
