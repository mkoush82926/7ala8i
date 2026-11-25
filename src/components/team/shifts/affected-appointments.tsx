"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { enqueueMessages, type EnqueueMessageResult } from "@/lib/messaging-stub";
import { findAffectedAppointments, queryWindow, type ScheduleChange } from "./schedule-logic";

interface ApptRow {
  id: string;
  start_time: string;
  end_time: string;
  barber_id: string | null;
  status: string | null;
  client_name: string | null;
  service_name: string | null;
  clients: { phone: string | null; name: string | null } | null;
}

function changeBounds(change: ScheduleChange): { start: string; end: string } {
  switch (change.type) {
    case "closure":
      return { start: change.start, end: change.end };
    case "special_hours": {
      const sorted = [...change.dates].sort();
      return { start: sorted[0], end: sorted[sorted.length - 1] };
    }
    case "shift_override":
      return { start: change.date, end: change.date };
    case "time_off":
      return { start: change.startIso.slice(0, 10), end: change.endIso.slice(0, 10) };
  }
}

/**
 * Bookings a schedule change leaves outside working time, with a bulk
 * WhatsApp notify. Messages go through enqueueMessage() (1C outbox; until it
 * lands, each one becomes a wa.me link the owner taps to send).
 */
export function AffectedAppointments({ change, title }: { change: ScheduleChange | null; title?: string }) {
  const { t, locale, formatDate, formatTime } = useTranslation();
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const shopName = useWorkspaceStore((s) => s.shopName);
  const tz = useWorkspaceStore((s) => s.timezone) || "Asia/Amman";
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Record<string, EnqueueMessageResult>>({});
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const bounds = change ? changeBounds(change) : null;
  const query = useSupabaseQuery<ApptRow[]>(
    async () => {
      if (!bounds) return { data: [], error: null };
      const w = queryWindow(bounds.start, bounds.end);
      const res = await supabase
        .from("appointments")
        .select("id, start_time, end_time, barber_id, status, client_name, service_name, clients(phone, name)")
        .eq("shop_id", shopId)
        .gte("start_time", w.from)
        .lt("start_time", w.to)
        .order("start_time", { ascending: true })
        .limit(500);
      return { data: (res.data ?? []) as unknown as ApptRow[], error: res.error ? { message: res.error.message } : null };
    },
    [supabase, shopId, bounds?.start, bounds?.end],
    { enabled: !!change && !!shopId, retryCount: 0 },
  );

  const affected = useMemo(
    () => (change && query.data ? findAffectedAppointments(query.data, change, tz) : []),
    [change, query.data, tz],
  );
  const chosen = selected ?? new Set(affected.filter((a) => a.clients?.phone).map((a) => a.id));

  if (!change) return null;

  const messageFor = (a: ApptRow) =>
    interpolate(t.shifts.notifyTemplate, {
      name: a.client_name || a.clients?.name || "",
      shop: shopName,
      date: formatDate(a.start_time, { weekday: "long", day: "numeric", month: "long", timeZone: tz }),
      time: formatTime(a.start_time, { timeZone: tz }),
    });

  async function notify() {
    const rows = affected.filter((a) => chosen.has(a.id));
    if (!rows.length || sending) return;
    setSending(true);
    try {
      const res = await enqueueMessages(
        rows.map((a) => ({
          shopId,
          to: a.clients?.phone,
          template: "schedule_change" as const,
          body: messageFor(a),
          locale,
          appointmentId: a.id,
        })),
      );
      const map: Record<string, EnqueueMessageResult> = {};
      rows.forEach((a, i) => (map[a.id] = res[i]));
      setResults((prev) => ({ ...prev, ...map }));
      const queued = res.filter((r) => r.status === "queued").length;
      const fallback = res.filter((r) => r.status === "fallback").length;
      if (queued) toast.success(interpolate(t.shifts.notifyQueued, { count: queued }));
      if (fallback) toast.info(interpolate(t.shifts.notifyFallback, { count: fallback }));
      if (!queued && !fallback) toast.error(t.shifts.notifyNone);
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-line bg-sunken p-4">
      <h4 className="m-0 text-sm font-bold text-ink">{title ?? t.shifts.affectedTitle}</h4>

      {query.initialLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : query.error ? (
        <EmptyState
          size="sm"
          tone="error"
          bare
          icon={AlertCircle}
          title={t.shifts.affectedLoadFailed}
          action={{ label: t.common.retry, onClick: query.refetch }}
        />
      ) : affected.length === 0 ? (
        <p className="m-0 flex items-center gap-2 text-sm text-ink-soft">
          <CheckCircle2 size={16} aria-hidden="true" className="text-brand-text" />
          {t.shifts.affectedNone}
        </p>
      ) : (
        <>
          <p className="m-0 text-sm text-ink-soft">{interpolate(t.shifts.affectedCount, { count: affected.length })}</p>
          <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
            {affected.map((a) => {
              const phone = a.clients?.phone;
              const result = results[a.id];
              const id = `aff-${a.id}`;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-card px-3 py-2">
                  <input
                    id={id}
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-brand"
                    checked={chosen.has(a.id)}
                    disabled={!phone || sending}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(a.id);
                      else next.delete(a.id);
                      setSelected(next);
                    }}
                  />
                  <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block truncate text-sm font-medium text-ink">
                      {a.client_name || a.clients?.name || t.shifts.walkInClient}
                    </span>
                    <span className="block text-[12px] text-ink-soft">
                      {formatDate(a.start_time, { weekday: "short", day: "numeric", month: "short", timeZone: tz })} ·{" "}
                      {formatTime(a.start_time, { timeZone: tz })}
                      {a.service_name ? ` · ${a.service_name}` : ""}
                      {!phone ? ` · ${t.shifts.noPhone}` : ""}
                    </span>
                  </label>
                  {result?.status === "fallback" && (
                    <a
                      href={result.waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpened((s) => new Set(s).add(a.id))}
                      className="btn btn-secondary min-h-11 px-3 text-sm"
                    >
                      {opened.has(a.id) ? <CheckCircle2 size={15} aria-hidden="true" /> : <ExternalLink size={15} aria-hidden="true" />}
                      {opened.has(a.id) ? t.shifts.whatsappOpened : t.shifts.openWhatsapp}
                    </a>
                  )}
                  {result?.status === "queued" && (
                    <span className="text-[12px] font-medium text-ink-soft">{t.shifts.queued}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => void notify()}
            disabled={sending || chosen.size === 0}
            aria-busy={sending || undefined}
            className="btn btn-secondary w-full sm:w-fit"
          >
            {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <MessageCircle size={16} aria-hidden="true" />}
            {interpolate(t.shifts.notifySelected, { count: chosen.size })}
          </button>
        </>
      )}
    </section>
  );
}
