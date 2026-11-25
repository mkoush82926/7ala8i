"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCheck, Inbox, MessageCircle, RefreshCw, Send, Wifi, WifiOff, X } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { formatJOD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/components/team/shifts";
import {
  allowanceUsage,
  fallbackWaLink,
  filsToJod,
  monthStartIn,
  needsManualSend,
  parseMonthCost,
  recipientName,
  statusTone,
  type MonthCost,
  type OutboxRow,
} from "@/lib/messaging/dashboard";

const card = "flex flex-col gap-5 rounded-xl border border-line bg-card p-4 sm:p-6";
const h2 = "text-h3 m-0 text-ink";

type Filter = "action" | "scheduled" | "all";

interface Status {
  live: boolean;
  providers: string[];
  lastRunAt: string | null;
}

const OUTBOX_COLUMNS =
  "id, appointment_id, to_phone, channel, template, locale, payload, body, status, scheduled_for, sent_at, cost_fils, error, created_at";

/** Provider status, month cost vs allowance, and the delivery log with wa.me fallbacks. */
export function MessagingActivity() {
  const { t, locale, formatRelative, formatDate, formatNumber } = useTranslation();
  const tm = t.messaging;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const [filter, setFilter] = useState<Filter>("action");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<OutboxRow | null>(null);
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const month = useMemo(() => monthStartIn(new Date()), []);

  const status = useSupabaseQuery<Status>(
    async () => {
      const res = await supabase.rpc("messaging_status" as never);
      const d = (res.data ?? {}) as { live?: boolean; providers?: string[]; last_run_at?: string | null };
      return {
        data: { live: d.live === true, providers: Array.isArray(d.providers) ? d.providers : [], lastRunAt: d.last_run_at ?? null },
        error: res.error ? { message: res.error.message } : null,
      };
    },
    [supabase],
    { enabled: !!shopId, retryCount: 0 },
  );

  const cost = useSupabaseQuery<MonthCost>(
    async () => {
      const res = await supabase
        .from("message_cost_monthly" as never)
        .select("*")
        .eq("shop_id", shopId)
        .eq("month", month)
        .maybeSingle();
      return { data: parseMonthCost(res.data as Record<string, unknown> | null, month), error: res.error ? { message: res.error.message } : null };
    },
    [supabase, shopId, month],
    { enabled: !!shopId, retryCount: 0 },
  );

  // No live provider: due 'queued' rows also need a manual (wa.me) send.
  const manualQueued = status.data ? !status.data.live : false;
  const log = useSupabaseQuery<OutboxRow[]>(
    async () => {
      let q = supabase
        .from("message_outbox" as never)
        .select(OUTBOX_COLUMNS)
        .eq("shop_id", shopId);
      if (filter === "action") {
        q = manualQueued
          ? q.or(`status.in.(fallback,failed),and(status.eq.queued,scheduled_for.lte.${new Date().toISOString()})`)
          : q.in("status", ["fallback", "failed"]);
      }
      if (filter === "scheduled") q = q.in("status", ["queued", "sending"]);
      const res = await q.order(filter === "scheduled" ? "scheduled_for" : "created_at", { ascending: filter === "scheduled" }).limit(50);
      return { data: (res.data ?? []) as unknown as OutboxRow[], error: res.error ? { message: res.error.message } : null };
    },
    [supabase, shopId, filter, manualQueued],
    { enabled: !!shopId, retryCount: 0 },
  );

  function refreshAll() {
    log.refetch();
    cost.refetch();
  }

  async function markSent(row: OutboxRow) {
    setBusyId(row.id);
    try {
      const { error } = await supabase.rpc("mark_message_sent_manually" as never, { p_id: row.id } as never);
      if (error) throw error;
      toast.success(tm.markedSent);
      refreshAll();
    } catch (err) {
      toast.error(dbErrorMessage(t, err, tm.actionFailed));
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(row: OutboxRow) {
    const { error } = await supabase.rpc("cancel_queued_message" as never, { p_id: row.id } as never);
    if (error) throw new Error(dbErrorMessage(t, error, tm.actionFailed));
    toast.success(tm.dismissed);
    refreshAll();
  }

  const c = cost.data;
  const usage = c ? allowanceUsage(c) : null;
  const filters: { id: Filter; label: string }[] = [
    { id: "action", label: tm.filterAction },
    { id: "scheduled", label: tm.filterScheduled },
    { id: "all", label: tm.filterAll },
  ];

  return (
    <>
      {/* ── Connection ── */}
      <section aria-labelledby="msg-status" className={card}>
        <div className="flex items-start gap-3">
          {status.initialLoading ? (
            <Skeleton variant="circle" className="size-10" />
          ) : (
            <span
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
                status.data?.live ? "bg-brand-soft text-success-text" : "bg-warning-soft text-warning-text",
              )}
              aria-hidden="true"
            >
              {status.data?.live ? <Wifi size={18} /> : <WifiOff size={18} />}
            </span>
          )}
          <div className="min-w-0">
            <h2 id="msg-status" className={h2}>
              {status.data?.live ? tm.liveTitle : tm.manualTitle}
            </h2>
            <p className="m-0 mt-1 text-sm text-ink-soft">{status.data?.live ? tm.liveHelp : tm.manualHelp}</p>
            {status.data?.lastRunAt && (
              <p className="m-0 mt-1 text-xs text-ink-muted">
                {interpolate(tm.lastRun, { when: formatRelative(status.data.lastRunAt) })}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── This month ── */}
      <section aria-labelledby="msg-month" className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="msg-month" className={h2}>
              {tm.monthTitle}
            </h2>
            <p className="m-0 mt-1 text-sm text-ink-soft">{formatDate(`${month}T12:00:00`, { month: "long", year: "numeric" })}</p>
          </div>
          {c && (
            <p className="m-0 text-end">
              <span className="block text-lg font-extrabold text-ink">
                <bdi>{formatJOD(filsToJod(c.costFils), locale)}</bdi>
              </span>
              <span className="text-xs text-ink-muted">{tm.estimatedCost}</span>
            </p>
          )}
        </div>
        {cost.initialLoading ? (
          <ListSkeleton rows={2} />
        ) : cost.error ? (
          <EmptyState size="sm" tone="error" icon={AlertCircle} title={tm.loadFailed} action={{ label: t.common.retry, onClick: cost.refetch, icon: RefreshCw }} />
        ) : c && usage ? (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {interpolate(tm.allowanceUsed, { used: formatNumber(c.sentCount), total: formatNumber(c.allowance) })}
                </span>
                {usage.over && (
                  <Pill tone="danger" size="sm">
                    {tm.overAllowance}
                  </Pill>
                )}
              </div>
              <div
                role="progressbar"
                aria-label={tm.allowanceLabel}
                aria-valuemin={0}
                aria-valuemax={c.allowance}
                aria-valuenow={Math.min(c.sentCount, c.allowance)}
                className="h-2 overflow-hidden rounded-full bg-sunken"
              >
                <div
                  className={cn("h-full rounded-full", usage.over ? "bg-danger" : "bg-brand")}
                  style={{ width: `${Math.min(100, Math.round(usage.ratio * 100))}%` }}
                />
              </div>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={tm.statSent} value={formatNumber(c.sentCount)} />
              <Stat label={tm.statDelivered} value={formatNumber(c.deliveredCount)} />
              <Stat label={tm.statRead} value={formatNumber(c.readCount)} />
              <Stat label={tm.statManual} value={formatNumber(c.fallbackCount + c.failedCount)} />
            </dl>
          </>
        ) : null}
      </section>

      {/* ── Delivery log ── */}
      <section aria-labelledby="msg-log" className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="msg-log" className={h2}>
              {tm.logTitle}
            </h2>
            <p className="m-0 mt-1 text-sm text-ink-soft">{tm.logHelp}</p>
          </div>
          <button type="button" className="btn btn-secondary min-h-11 shrink-0" onClick={refreshAll} aria-label={tm.refresh}>
            <RefreshCw size={16} aria-hidden="true" className={cn(log.refreshing && "animate-spin")} />
            <span className="hidden sm:inline">{tm.refresh}</span>
          </button>
        </div>

        <div role="tablist" aria-label={tm.logTitle} className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "focus-ring min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                filter === f.id
                  ? "border-ink bg-inverse text-on-inverse"
                  : "border-line text-ink-soft hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {log.initialLoading ? (
          <ListSkeleton rows={4} />
        ) : log.error ? (
          <EmptyState size="sm" tone="error" icon={AlertCircle} title={tm.loadFailed} action={{ label: t.common.retry, onClick: log.refetch, icon: RefreshCw }} />
        ) : !log.data?.length ? (
          <EmptyState
            size="sm"
            icon={filter === "action" ? CheckCheck : Inbox}
            title={filter === "action" ? tm.emptyAction : tm.emptyLog}
            description={filter === "action" ? tm.emptyActionHint : tm.emptyLogHint}
          />
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {log.data.map((row) => {
              const name = recipientName(row);
              const wa = needsManualSend(row, { live: status.data ? status.data.live : undefined }) ? fallbackWaLink(row, siteUrl) : null;
              const templateLabel = (tm.templates as Record<string, string>)[row.template] ?? row.template;
              const statusLabel = (tm.statuses as Record<string, string>)[row.status] ?? row.status;
              const when = row.status === "queued" ? row.scheduled_for : row.sent_at ?? row.created_at;
              return (
                <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{templateLabel}</span>
                      <Pill tone={statusTone(row.status)} size="sm">
                        {statusLabel}
                      </Pill>
                      {row.channel === "sms" && (
                        <Pill tone="neutral" size="sm">
                          {tm.channelSms}
                        </Pill>
                      )}
                    </div>
                    <p className="m-0 mt-0.5 truncate text-xs text-ink-muted">
                      {[name || tm.client, row.status === "queued" ? interpolate(tm.scheduledFor, { when: formatRelative(when) }) : formatRelative(when)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {wa && (
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary min-h-11"
                        aria-label={interpolate(tm.sendOnWhatsappFor, { name: name || tm.client })}
                      >
                        <MessageCircle size={16} aria-hidden="true" />
                        {tm.sendOnWhatsapp}
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11"
                        onClick={() => markSent(row)}
                        disabled={busyId === row.id}
                        aria-label={tm.markSent}
                        title={tm.markSent}
                      >
                        <Send size={16} aria-hidden="true" />
                        <span className="hidden sm:inline">{tm.markSentShort}</span>
                      </button>
                      <button
                        type="button"
                        className="focus-ring inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
                        onClick={() => setDismissing(row)}
                        aria-label={tm.dismiss}
                        title={tm.dismiss}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!dismissing}
        onClose={() => setDismissing(null)}
        onConfirm={async () => {
          if (dismissing) await dismiss(dismissing);
        }}
        destructive
        title={tm.dismissTitle}
        description={tm.dismissDescription}
        confirmLabel={tm.dismiss}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sunken p-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="m-0 mt-0.5 text-lg font-bold text-ink">
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}
